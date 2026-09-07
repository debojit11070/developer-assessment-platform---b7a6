import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";
import { fail } from "../utils/response.js";

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    fail(res, err.message, err.status, err.errors);
    return;
  }
  if (err instanceof ZodError) {
    fail(res, "Validation failed", 400, err.flatten());
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      fail(res, "Resource already exists", 409, { target: err.meta?.target });
      return;
    }
    if (err.code === "P2025") {
      fail(res, "Resource not found", 404);
      return;
    }
  }
  // eslint-disable-next-line no-console
  console.error("[UNHANDLED ERROR]", err);
  fail(res, "Internal server error", 500);
}
