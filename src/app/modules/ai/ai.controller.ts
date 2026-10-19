import type { Request, Response } from "express";
import { ok } from "../../utils/response.js";
import { AppError } from "../../utils/errors.js";
import { isAiConfigured, streamText } from "./ai.llm.js";
import { CHAT_SYSTEM_PROMPT } from "./ai.knowledge.js";
import { recommendAssessments, suggestAssessments } from "./ai.service.js";
import type { ChatDto, RecommendQuery, SuggestQuery } from "./ai.validation.js";

function getQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery?: T }).validatedQuery as T;
}

/** POST /ai/chat — streams the reply as Server-Sent Events: `data: {"text":"..."}` then `data: [DONE]`. */
export async function chat(req: Request, res: Response): Promise<void> {
  if (!isAiConfigured()) throw new AppError("AI assistant is not configured", 503);
  const { messages } = req.body as ChatDto;

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  const stream = streamText(CHAT_SYSTEM_PROMPT, messages, controller.signal);
  // Pull the first chunk before sending headers so upstream failures become a normal JSON error.
  let first: IteratorResult<string>;
  try {
    first = await stream.next();
  } catch (err) {
    if (controller.signal.aborted) return;
    throw err instanceof AppError ? err : new AppError("The AI assistant is temporarily unavailable", 502);
  }

  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  try {
    if (!first.done) {
      send({ text: first.value });
      for await (const text of stream) send({ text });
    }
    res.write("data: [DONE]\n\n");
  } catch {
    if (!controller.signal.aborted) send({ error: "The response was interrupted" });
  }
  res.end();
}

export async function suggest(req: Request, res: Response): Promise<void> {
  const { q, limit } = getQuery<SuggestQuery>(req);
  ok(res, await suggestAssessments(q, limit), "Suggestions fetched");
}

export async function recommendations(req: Request, res: Response): Promise<void> {
  const { assessmentId, limit } = getQuery<RecommendQuery>(req);
  const candidateId = req.user?.role === "CANDIDATE" ? req.user.sub : undefined;
  ok(res, await recommendAssessments(limit, assessmentId, candidateId), "Recommendations fetched");
}
