import type { Request, Response } from "express";
import { prisma } from "../../../config/prisma.js";
import { ok, created } from "../../utils/response.js";
import { NotFoundError, ForbiddenError } from "../../utils/errors.js";
import type { ListProblemsQuery } from "./problems.validation.js";

const PUBLIC_PROBLEM_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  difficulty: true,
  tags: true,
  timeLimitSec: true,
  memoryLimitMb: true,
  starterCode: true,
  points: true,
  language: true,
  createdAt: true,
  updatedAt: true,
};

function getQuery(req: Request): ListProblemsQuery {
  return (req as Request & { validatedQuery?: ListProblemsQuery }).validatedQuery ?? {
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    order: "desc",
  };
}

export async function createProblem(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const problem = await prisma.problem.create({
    data: { ...req.body, createdById: req.user.sub },
  });
  created(res, problem, "Problem created");
}

export async function getProblemById(req: Request, res: Response): Promise<void> {
  const problem = await prisma.problem.findFirst({
    where: { id: req.params.id, deletedAt: null },
  });
  if (!problem) throw new NotFoundError("Problem not found");

  const safe = { ...problem } as Record<string, unknown>;
  if (problem.type === "MCQ") {
    safe.correctOption = undefined;
  }
  if (problem.type === "CODING") {
    safe.testCases = (problem.testCases as unknown[]) ?? [];
  }
  if (problem.type === "WRITTEN") {
    safe.referenceAnswer = undefined;
  }
  ok(res, safe, "Problem fetched");
}

export async function listProblems(req: Request, res: Response): Promise<void> {
  const q = getQuery(req);
  const where: Record<string, unknown> = { deletedAt: null };
  if (q.type) where.type = q.type;
  if (q.difficulty) where.difficulty = q.difficulty;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: "insensitive" } },
      { description: { contains: q.search, mode: "insensitive" } },
      { tags: { has: q.search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      orderBy: { [q.sortBy]: q.order },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: PUBLIC_PROBLEM_SELECT,
    }),
    prisma.problem.count({ where }),
  ]);

  ok(res, {
    items,
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  }, "Problems fetched");
}

export async function updateProblem(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const existing = await prisma.problem.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) throw new NotFoundError("Problem not found");
  if (existing.createdById !== req.user.sub && req.user.role !== "ADMIN") {
    throw new ForbiddenError("You can only update your own problems");
  }
  const updated = await prisma.problem.update({
    where: { id: req.params.id },
    data: req.body,
  });
  ok(res, updated, "Problem updated");
}

export async function softDeleteProblem(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const existing = await prisma.problem.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) throw new NotFoundError("Problem not found");
  if (existing.createdById !== req.user.sub && req.user.role !== "ADMIN") {
    throw new ForbiddenError("You can only delete your own problems");
  }
  await prisma.problem.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      actorId: req.user.sub,
      action: "problem.deleted",
      resource: "problem",
      resourceId: req.params.id,
    },
  });
  ok(res, null, "Problem deleted");
}
