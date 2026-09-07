import { z } from "zod";

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  role: z.enum(["CANDIDATE", "COMPANY", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING"]).optional(),
  sortBy: z.enum(["createdAt", "email", "fullName"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const adminUpdateUserSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING"]).optional(),
  role: z.enum(["CANDIDATE", "COMPANY", "ADMIN"]).optional(),
  fullName: z.string().min(2).max(100).optional(),
});

export const adminAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  actorId: z.string().uuid().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
