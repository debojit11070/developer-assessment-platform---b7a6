import { AssessmentStatus, Difficulty } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { complete, isAiConfigured } from "./ai.llm.js";
import { SUGGEST_RERANK_SYSTEM_PROMPT } from "./ai.knowledge.js";

const CATALOG_LIMIT = 200;
const DIFFICULTY_RANK: Record<Difficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  priceCents: number;
  currency: string;
  tags: string[];
  difficulty: Difficulty;
  problemTitles: string[];
}

export type PublicItem = Omit<CatalogItem, "description" | "problemTitles"> & { reason?: string };

async function loadCatalog(): Promise<CatalogItem[]> {
  const rows = await prisma.assessment.findMany({
    where: { status: AssessmentStatus.PUBLISHED, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: CATALOG_LIMIT,
    include: {
      problems: { include: { problem: { select: { title: true, tags: true, difficulty: true } } } },
    },
  });
  return rows.map((a) => {
    const problems = a.problems.map((p) => p.problem);
    const hardest = problems.reduce<Difficulty>(
      (max, p) => (DIFFICULTY_RANK[p.difficulty] > DIFFICULTY_RANK[max] ? p.difficulty : max),
      "EASY",
    );
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      durationMin: a.durationMin,
      priceCents: a.priceCents,
      currency: a.currency,
      tags: [...new Set(problems.flatMap((p) => p.tags.map((t) => t.toLowerCase())))],
      difficulty: hardest,
      problemTitles: problems.map((p) => p.title),
    };
  });
}

function toPublic(item: CatalogItem, reason?: string): PublicItem {
  const { description: _d, problemTitles: _p, ...rest } = item;
  return reason ? { ...rest, reason } : rest;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 1);
}

function scoreForQuery(item: CatalogItem, query: string, tokens: string[]): number {
  const title = item.title.toLowerCase();
  const desc = item.description.toLowerCase();
  const problems = item.problemTitles.join(" ").toLowerCase();
  let score = title.includes(query) ? 8 : 0;
  for (const t of tokens) {
    if (title.includes(t)) score += 5;
    if (item.tags.some((tag) => tag === t)) score += 4;
    else if (item.tags.some((tag) => tag.includes(t))) score += 2;
    if (problems.includes(t)) score += 2;
    if (desc.includes(t)) score += 1;
  }
  return score;
}

/** Optional LLM re-rank of already keyword-matched candidates. Any failure keeps the keyword order. */
async function rerank(query: string, candidates: CatalogItem[]): Promise<CatalogItem[] | null> {
  if (!isAiConfigured() || candidates.length < 2) return null;
  try {
    const list = candidates
      .map((c, i) => `${i + 1}. ${c.title} | ${c.difficulty} | ${c.tags.join(", ")}`)
      .join("\n");
    const text = await complete(
      SUGGEST_RERANK_SYSTEM_PROMPT,
      [{ role: "user", content: `Query: ${query.slice(0, 100)}\nCandidates:\n${list}` }],
      { maxTokens: 60, timeoutMs: 3000 },
    );
    const match = text.match(/\[[\d,\s]*\]/);
    if (!match) return null;
    const order = [...new Set(JSON.parse(match[0]) as number[])]
      .map((n) => candidates[n - 1])
      .filter((c): c is CatalogItem => !!c);
    return order.length ? order : null;
  } catch {
    return null;
  }
}

export async function suggestAssessments(
  q: string,
  limit: number,
): Promise<{ items: PublicItem[]; reranked: boolean }> {
  const query = q.toLowerCase();
  const tokens = tokenize(query);
  const catalog = await loadCatalog();
  const matched = catalog
    .map((item) => ({ item, score: scoreForQuery(item, query, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.item);

  const reranked = await rerank(q, matched);
  return {
    items: (reranked ?? matched).slice(0, limit).map((i) => toPublic(i)),
    reranked: reranked !== null,
  };
}

export async function recommendAssessments(
  limit: number,
  assessmentId?: string,
  candidateId?: string,
): Promise<{ items: PublicItem[]; personalized: boolean }> {
  const catalog = await loadCatalog();
  const reference = assessmentId ? catalog.find((a) => a.id === assessmentId) : undefined;

  const tagWeights = new Map<string, number>();
  const bump = (tags: string[], w: number) => tags.forEach((t) => tagWeights.set(t, (tagWeights.get(t) ?? 0) + w));
  if (reference) bump(reference.tags, 3);

  const attempted = new Set<string>();
  let personalized = false;
  if (candidateId) {
    const attempts = await prisma.attempt.findMany({
      where: { candidateId },
      select: { assessmentId: true, passed: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const byId = new Map(catalog.map((c) => [c.id, c]));
    for (const a of attempts) {
      attempted.add(a.assessmentId);
      const past = byId.get(a.assessmentId);
      if (past) {
        bump(past.tags, a.passed ? 2 : 1);
        personalized = true;
      }
    }
  }

  const scored = catalog
    .filter((c) => c.id !== assessmentId && !attempted.has(c.id))
    .map((item, index) => {
      const shared = item.tags.filter((t) => tagWeights.has(t));
      let score = shared.reduce((s, t) => s + (tagWeights.get(t) ?? 0), 0);
      if (reference && shared.length) {
        score += 2 - Math.abs(DIFFICULTY_RANK[item.difficulty] - DIFFICULTY_RANK[reference.difficulty]);
      }
      // catalog is newest-first; position is the tiebreaker so users with no signal get fresh items
      return { item, shared, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit);

  return {
    items: scored.map(({ item, shared, score }) =>
      toPublic(item, score > 0 ? `Shares topics: ${shared.slice(0, 3).join(", ")}` : undefined),
    ),
    personalized,
  };
}
