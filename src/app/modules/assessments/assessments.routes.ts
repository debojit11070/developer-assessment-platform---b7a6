import { Router } from "express";
import * as ctrl from "./assessments.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import { validateBody, validateQuery } from "../../middlewares/validate.js";
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  listAssessmentsQuerySchema,
  publishAssessmentSchema,
} from "./assessments.validation.js";

const router = Router();

router.get("/", validateQuery(listAssessmentsQuerySchema), ctrl.listAssessments);
router.get("/:id", ctrl.getAssessmentById);

router.post(
  "/",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(createAssessmentSchema),
  ctrl.createAssessment,
);
router.patch(
  "/:id",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(updateAssessmentSchema),
  ctrl.updateAssessment,
);
router.patch(
  "/:id/status",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(publishAssessmentSchema),
  ctrl.changeStatus,
);
router.delete(
  "/:id",
  auth,
  authorize("COMPANY", "ADMIN"),
  ctrl.softDeleteAssessment,
);

export default router;
