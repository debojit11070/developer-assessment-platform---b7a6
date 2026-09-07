import { Router } from "express";
import * as ctrl from "./users.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import {
  updateMeSchema,
  updateCandidateProfileSchema,
  updateCompanyProfileSchema,
} from "./users.validation.js";
import { validateBody } from "../../middlewares/validate.js";

const router = Router();

router.get("/me", auth, ctrl.getMe);
router.patch("/me", auth, validateBody(updateMeSchema), ctrl.updateMe);

router.get(
  "/candidates/:id/profile",
  ctrl.getCandidateProfile,
);
router.patch(
  "/candidates/me/profile",
  auth,
  authorize("CANDIDATE"),
  validateBody(updateCandidateProfileSchema),
  ctrl.updateCandidateProfile,
);

router.get("/companies/:id/profile", ctrl.getCompanyProfile);
router.patch(
  "/companies/me/profile",
  auth,
  authorize("COMPANY"),
  validateBody(updateCompanyProfileSchema),
  ctrl.updateCompanyProfile,
);

export default router;
