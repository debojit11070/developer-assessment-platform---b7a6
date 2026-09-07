import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { generalLimiter } from "./middlewares/rateLimit.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import problemRoutes from "./modules/problems/problems.routes.js";
import assessmentRoutes from "./modules/assessments/assessments.routes.js";
import attemptRoutes from "./modules/attempts/attempts.routes.js";
import paymentRoutes from "./modules/payments/payments.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import docsRoutes from "./modules/docs/docs.routes.js";
import { ok } from "./utils/response.js";

export function createApp(): Application {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com"],
          "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
          "img-src": ["'self'", "data:", "https:"],
          "connect-src": ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(generalLimiter);

  app.get("/", (_req, res) =>
    ok(res, { name: "Developer Assessment Platform API", version: "1.0.0" }, "API running"),
  );

  app.get("/api/v1/health", (_req, res) =>
    ok(res, { status: "ok" }, "API is healthy"),
  );

  // Stripe webhook must read the raw body before JSON parser kicks in
  app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));

  // Now the JSON parser for everything else
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/problems", problemRoutes);
  app.use("/api/v1/assessments", assessmentRoutes);
  app.use("/api/v1", attemptRoutes);
  app.use("/api/v1/payments", paymentRoutes);
  app.use("/api/v1/admin", adminRoutes);

  app.use("/api/docs", docsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
