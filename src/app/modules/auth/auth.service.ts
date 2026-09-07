import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { issueTokens, verifyRefreshToken } from "../../utils/jwt.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors.js";

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  // role-specific
  companyName?: string;
}

export async function registerUser(input: RegisterInput) {
  const { email, password, fullName, role, companyName } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("Email is already registered");

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role,
        status: role === "ADMIN" ? "ACTIVE" : "ACTIVE",
      },
    });

    if (role === "COMPANY") {
      if (!companyName) throw new BadRequestError("companyName is required for COMPANY role");
      await tx.companyProfile.create({
        data: { userId: user.id, companyName },
      });
    } else if (role === "CANDIDATE") {
      await tx.candidateProfile.create({
        data: { userId: user.id, headline: "" },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "user.registered",
        resource: "user",
        resourceId: user.id,
        meta: { role },
      },
    });

    return user;
  });

  const tokens = issueTokens({ sub: result.id, email: result.email, role: result.role });
  return {
    user: sanitizeUser(result),
    tokens,
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) throw new UnauthorizedError("Invalid credentials");
  if (user.status !== "ACTIVE") throw new UnauthorizedError("Account is not active");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid credentials");

  const tokens = issueTokens({ sub: user.id, email: user.email, role: user.role });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "user.login",
      resource: "user",
      resourceId: user.id,
    },
  });

  return { user: sanitizeUser(user), tokens };
}

export async function refreshAccessToken(refreshToken: string) {
  if (!refreshToken) throw new UnauthorizedError("Missing refresh token");
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }
  if (!payload.sub) throw new UnauthorizedError("Malformed token");

  const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
  if (!user || user.deletedAt || user.status !== "ACTIVE") throw new UnauthorizedError("Account not active");
  if (user.refreshToken !== refreshToken) throw new UnauthorizedError("Refresh token revoked");

  const tokens = issueTokens({ sub: user.id, email: user.email, role: user.role });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });
  return tokens;
}

export async function logoutUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
  await prisma.auditLog.create({
    data: { actorId: userId, action: "user.logout", resource: "user", resourceId: userId },
  });
}

function sanitizeUser<T extends { passwordHash?: string; refreshToken?: string | null }>(u: T) {
  const { passwordHash, refreshToken, ...rest } = u;
  void passwordHash;
  void refreshToken;
  return rest;
}
