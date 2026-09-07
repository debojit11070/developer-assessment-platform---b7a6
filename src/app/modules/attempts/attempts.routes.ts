import { Router } from "express";
import { z } from "zod";
import * as ctrl from "./attempts.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validate.js";
import {
  createInvitationSchema,
  evaluateAttemptSchema,
  submitAnswerSchema,
} from "./attempts.validation.js";

const invitationIdSchema = z.object({ invitationId: z.string().uuid() });

const router = Router();

// Invitations
router.post(
  "/invitations",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(createInvitationSchema),
  ctrl.createInvitation,
);
router.get(
  "/invitations/me",
  auth,
  authorize("CANDIDATE"),
  ctrl.listMyInvitations,
);
router.post(
  "/invitations/:action(accept|decline)",
  auth,
  authorize("CANDIDATE"),
  validateBody(invitationIdSchema),
  ctrl.respondToInvitation,
);

// Attempts
router.post(
  "/attempts/start/:invitationId",
  auth,
  authorize("CANDIDATE"),
  ctrl.startAttempt,
);
router.get(
  "/attempts/assessment/:assessmentId/me",
  auth,
  authorize("CANDIDATE"),
  ctrl.getMyAttemptByAssessment,
);
router.post(
  "/attempts/:attemptId/answer",
  auth,
  authorize("CANDIDATE"),
  validateBody(submitAnswerSchema),
  ctrl.saveAnswer,
);
router.post(
  "/attempts/:attemptId/submit",
  auth,
  authorize("CANDIDATE"),
  ctrl.submitAttempt,
);
router.post(
  "/attempts/:attemptId/evaluate",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(evaluateAttemptSchema),
  ctrl.evaluateAttempt,
);
router.get(
  "/attempts/assessment/:assessmentId/all",
  auth,
  authorize("COMPANY", "ADMIN"),
  ctrl.listAttemptsForAssessment,
);

export default router;
