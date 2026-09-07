import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    fullName: z.string().min(2).max(100),
    role: z.enum(["CANDIDATE", "COMPANY"]),
    companyName: z.string().min(2).max(200).optional(),
  })
  .refine((d) => (d.role === "COMPANY" ? !!d.companyName : true), {
    message: "companyName is required for COMPANY role",
    path: ["companyName"],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
