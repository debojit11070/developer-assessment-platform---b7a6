import { z } from "zod";

export const updateMeSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateMeDto = z.infer<typeof updateMeSchema>;

export const updateCandidateProfileSchema = z.object({
  headline: z.string().max(200).optional(),
  skills: z.array(z.string().min(1)).max(50).optional(),
  githubUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  resumeUrl: z.string().url().optional(),
});
export type UpdateCandidateProfileDto = z.infer<typeof updateCandidateProfileSchema>;

export const updateCompanyProfileSchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  size: z.string().max(50).optional(),
  about: z.string().max(2000).optional(),
});
export type UpdateCompanyProfileDto = z.infer<typeof updateCompanyProfileSchema>;
