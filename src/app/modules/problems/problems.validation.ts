import { z } from "zod";

export const createProblemSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  type: z.enum(["MCQ", "WRITTEN", "CODING"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
  tags: z.array(z.string()).optional(),
  timeLimitSec: z.number().int().positive().optional(),
  memoryLimitMb: z.number().int().positive().optional(),
  starterCode: z.string().optional(),
  testCases: z
    .array(
      z.object({
        input: z.string(),
        expectedOutput: z.string(),
        isHidden: z.boolean().optional(),
      }),
    )
    .optional(),
  referenceAnswer: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctOption: z.string().optional(),
  points: z.number().int().positive().max(1000).default(10),
  language: z.string().optional(),
});

export const updateProblemSchema = createProblemSchema.partial();

export const listProblemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  type: z.enum(["MCQ", "WRITTEN", "CODING"]).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  sortBy: z.enum(["createdAt", "title", "difficulty"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateProblemDto = z.infer<typeof createProblemSchema>;
export type UpdateProblemDto = z.infer<typeof updateProblemSchema>;
export type ListProblemsQuery = z.infer<typeof listProblemsQuerySchema>;
