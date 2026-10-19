import { config } from "../../../config/env.js";
import { AppError } from "../../utils/errors.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export function isAiConfigured(): boolean {
  return config.ai.apiKey !== "";
}

function headers(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-goog-api-key": config.ai.apiKey,
  };
}

function buildBody(system: string, messages: LlmMessage[], maxTokens: number) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: maxTokens,
      // Skip "thinking" so the token budget goes to the visible answer.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function extractText(json: GeminiResponse): string {
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

/** Single-shot completion. Throws on any failure; callers decide on a fallback. */
export async function complete(
  system: string,
  messages: LlmMessage[],
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  const res = await fetch(`${BASE_URL}/${config.ai.model}:generateContent`, {
    method: "POST",
    headers: headers(),
    body: buildBody(system, messages, opts.maxTokens ?? 300),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
  });
  if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);
  return extractText((await res.json()) as GeminiResponse);
}

/**
 * Streams text deltas from the model. Aborting `signal` cancels the upstream request.
 * Throws AppError before the first yield if the upstream rejects the request.
 */
export async function* streamText(
  system: string,
  messages: LlmMessage[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(`${BASE_URL}/${config.ai.model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: headers(),
    body: buildBody(system, messages, config.ai.chatMaxTokens),
    signal,
  });
  if (!res.ok || !res.body) {
    // eslint-disable-next-line no-console
    console.error("[AI] upstream error", res.status);
    throw new AppError("The AI assistant is temporarily unavailable", 502);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const text = extractText(JSON.parse(line.slice(5).trim()) as GeminiResponse);
        if (text) yield text;
      } catch {
        // ignore malformed keep-alive lines
      }
    }
  }
}
