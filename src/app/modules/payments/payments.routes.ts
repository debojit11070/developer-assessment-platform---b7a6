import { Router } from "express";
import * as ctrl from "./payments.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validate.js";
import { initiatePaymentSchema } from "./payments.validation.js";
import { paymentsLimiter } from "../../middlewares/rateLimit.js";

const router = Router();

router.post(
  "/initiate",
  auth,
  authorize("CANDIDATE", "COMPANY"),
  paymentsLimiter,
  validateBody(initiatePaymentSchema),
  ctrl.initiatePayment,
);
router.get("/:id", auth, ctrl.getPaymentById);
router.get("/me/list", auth, ctrl.myPayments);
router.get("/success", ctrl.paymentSuccess);
router.get("/cancel", ctrl.paymentCancel);

// Webhook: raw body is already parsed in app.ts via express.raw
router.post("/webhook", ctrl.stripeWebhook);

export default router;
