import { Router } from "express";
import * as ctrl from "./assessments.controller.js";
import { auth, authorize, optionalAuth } from "../../middlewares/auth.js";
import { validateBody, validateQuery } from "../../middlewares/validate.js";
import { catchAsync } from "../../utils/asyncHandler.js";
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  listAssessmentsQuerySchema,
  publishAssessmentSchema,
} from "./assessments.validation.js";

const router = Router();

router.get("/", optionalAuth, validateQuery(listAssessmentsQuerySchema), catchAsync(ctrl.listAssessments));
router.get("/:id", optionalAuth, catchAsync(ctrl.getAssessmentById));

router.post(
  "/",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(createAssessmentSchema),
  catchAsync(ctrl.createAssessment),
);
router.patch(
  "/:id",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(updateAssessmentSchema),
  catchAsync(ctrl.updateAssessment),
);
router.patch(
  "/:id/status",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(publishAssessmentSchema),
  catchAsync(ctrl.changeStatus),
);
router.delete(
  "/:id",
  auth,
  authorize("COMPANY", "ADMIN"),
  catchAsync(ctrl.softDeleteAssessment),
);

export default router;
