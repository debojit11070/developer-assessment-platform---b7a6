import { z } from "zod";

export const createAssessmentSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  durationMin: z.number().int().min(5).max(360).default(60),
  passingScore: z.number().int().min(0).max(100).default(60),
  priceCents: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("usd"),
  problems: z
    .array(
      z.object({
        problemId: z.string().uuid(),
        order: z.number().int().min(0).optional(),
        points: z.number().int().min(1).optional(),
      }),
    )
    .min(1, "At least one problem is required"),
});

export const updateAssessmentSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  durationMin: z.number().int().min(5).max(360).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  problems: z
    .array(
      z.object({
        problemId: z.string().uuid(),
        order: z.number().int().min(0).optional(),
        points: z.number().int().min(1).optional(),
      }),
    )
    .optional(),
});

export const listAssessmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(["createdAt", "title", "priceCents"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const publishAssessmentSchema = z.object({
  status: z.enum(["PUBLISHED", "ARCHIVED", "DRAFT"]),
});

export type CreateAssessmentDto = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentDto = z.infer<typeof updateAssessmentSchema>;
export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;
