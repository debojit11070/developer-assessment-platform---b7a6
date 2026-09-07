import { z } from "zod";

export const createInvitationSchema = z.object({
  assessmentId: z.string().uuid(),
  candidateId: z.string().uuid(),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});

export const acceptInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

export const submitAnswerSchema = z.object({
  problemId: z.string().uuid(),
  mcqOption: z.string().optional(),
  writtenAnswer: z.string().optional(),
  codeAnswer: z.string().optional(),
  codeLanguage: z.string().optional(),
}).refine((d) => d.mcqOption !== undefined || d.writtenAnswer !== undefined || d.codeAnswer !== undefined, {
  message: "Provide one answer type (mcqOption, writtenAnswer, or codeAnswer)",
});

export const evaluateAttemptSchema = z.object({
  manualScores: z
    .array(
      z.object({
        problemId: z.string().uuid(),
        pointsAwarded: z.number().int().min(0),
        feedback: z.string().optional(),
      }),
    )
    .optional(),
});

export type CreateInvitationDto = z.infer<typeof createInvitationSchema>;
export type SubmitAnswerDto = z.infer<typeof submitAnswerSchema>;
