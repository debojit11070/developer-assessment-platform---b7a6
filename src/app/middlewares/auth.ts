import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config/env.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import { prisma } from "../../config/prisma.js";
import type { UserRole } from "@prisma/client";

export interface AuthPayload {
  sub: string;
  role: UserRole;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function auth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }
  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export function authorize(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenError("You do not have permission to perform this action");
    }
    next();
  };
}

/**
 * Optional auth: attaches `req.user` if a valid token is present, otherwise continues.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const token = header.split(" ")[1];
      const payload = jwt.verify(token, config.jwt.accessSecret) as AuthPayload;
      req.user = payload;
    } catch {
      // ignore — treat as anonymous
    }
  }
  next();
}

/**
 * Confirms the JWT user actually exists and is active. Use after `auth` when needed.
 */
export async function ensureActiveUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    throw new UnauthorizedError("Account is not active");
  }
  next();
}
