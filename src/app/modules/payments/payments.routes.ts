import { Router } from "express";
import * as ctrl from "./payments.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validate.js";
import { initiatePaymentSchema } from "./payments.validation.js";
import { paymentsLimiter } from "../../middlewares/rateLimit.js";
import { catchAsync } from "../../utils/asyncHandler.js";

const router = Router();

router.post(
  "/initiate",
  auth,
  authorize("CANDIDATE", "COMPANY"),
  paymentsLimiter,
  validateBody(initiatePaymentSchema),
  catchAsync(ctrl.initiatePayment),
);
router.get("/success", catchAsync(ctrl.paymentSuccess));
router.get("/cancel", catchAsync(ctrl.paymentCancel));
router.get("/me/list", auth, catchAsync(ctrl.myPayments));
router.get("/:id", auth, catchAsync(ctrl.getPaymentById));

// Webhook: raw body is already parsed in app.ts via express.raw
router.post("/webhook", catchAsync(ctrl.stripeWebhook));

export default router;
