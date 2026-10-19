import { Router } from "express";
import * as ctrl from "./ai.controller.js";
import { optionalAuth } from "../../middlewares/auth.js";
import { aiChatLimiter, aiSuggestLimiter } from "../../middlewares/rateLimit.js";
import { validateBody, validateQuery } from "../../middlewares/validate.js";
import { catchAsync } from "../../utils/asyncHandler.js";
import { chatSchema, recommendQuerySchema, suggestQuerySchema } from "./ai.validation.js";

const router = Router();

router.post("/chat", aiChatLimiter, validateBody(chatSchema), catchAsync(ctrl.chat));
router.get("/suggest", aiSuggestLimiter, validateQuery(suggestQuerySchema), catchAsync(ctrl.suggest));
router.get(
  "/recommendations",
  aiSuggestLimiter,
  optionalAuth,
  validateQuery(recommendQuerySchema),
  catchAsync(ctrl.recommendations),
);

export default router;
