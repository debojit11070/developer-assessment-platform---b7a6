import { Router } from "express";
import * as ctrl from "./auth.controller.js";
import { authLimiter } from "../../middlewares/rateLimit.js";
import { auth } from "../../middlewares/auth.js";

const router = Router();

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new account (CANDIDATE or COMPANY)
 */
router.post("/register", authLimiter, ctrl.register);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Email/password login
 */
router.post("/login", authLimiter, ctrl.login);

/**
 * @openapi
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Issue a new access token using a refresh token
 */
router.post("/refresh-token", authLimiter, ctrl.refresh);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     summary: Invalidate current refresh token
 */
router.post("/logout", auth, ctrl.logout);

export default router;
