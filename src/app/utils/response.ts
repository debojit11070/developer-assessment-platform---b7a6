import type { Response } from "express";

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: unknown;
}

export function ok<T>(res: Response, data: T, message = "Operation successful", status = 200): Response {
  const body: ApiSuccess<T> = { success: true, message, data };
  return res.status(status).json(body);
}

export function created<T>(res: Response, data: T, message = "Resource created"): Response {
  return ok(res, data, message, 201);
}

export function fail(res: Response, message: string, status = 500, errors?: unknown): Response {
  const body: ApiError = { success: false, message };
  if (errors !== undefined) body.errors = errors;
  return res.status(status).json(body);
}
