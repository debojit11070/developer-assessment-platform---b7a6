import type { Request, Response } from "express";
import * as service from "./auth.service.js";
import { ok } from "../../utils/response.js";

export async function register(req: Request, res: Response): Promise<void> {
  const result = await service.registerUser(req.body);
  ok(res, result, "Registered successfully", 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await service.loginUser(req.body.email, req.body.password);
  ok(res, result, "Logged in successfully");
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const tokens = await service.refreshAccessToken(req.body.refreshToken);
  ok(res, { tokens }, "Token refreshed");
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (!req.user) return;
  await service.logoutUser(req.user.sub);
  ok(res, null, "Logged out successfully");
}
