import { z } from "zod";

export const initiatePaymentSchema = z.object({
  assessmentId: z.string().uuid(),
  purpose: z.enum(["ASSESSMENT_FEE", "PREMIUM_JOB_POSTING", "OTHER"]).default("ASSESSMENT_FEE"),
});

export type InitiatePaymentDto = z.infer<typeof initiatePaymentSchema>;
