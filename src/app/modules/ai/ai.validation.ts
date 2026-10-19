import { z } from "zod";

export const MAX_CHAT_MESSAGE_LENGTH = 1000;

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
      }),
    )
    .min(1)
    .max(12)
    .refine((m) => m[m.length - 1].role === "user", "The last message must be from the user"),
});

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const recommendQuerySchema = z.object({
  assessmentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(10).default(4),
});

export type ChatDto = z.infer<typeof chatSchema>;
export type SuggestQuery = z.infer<typeof suggestQuerySchema>;
export type RecommendQuery = z.infer<typeof recommendQuerySchema>;
