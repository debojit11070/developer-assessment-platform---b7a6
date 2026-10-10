import { Router } from "express";
import * as ctrl from "./users.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import {
  updateMeSchema,
  updateCandidateProfileSchema,
  updateCompanyProfileSchema,
} from "./users.validation.js";
import { validateBody } from "../../middlewares/validate.js";
import { catchAsync } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/me", auth, catchAsync(ctrl.getMe));
router.patch("/me", auth, validateBody(updateMeSchema), catchAsync(ctrl.updateMe));

router.get("/candidates/:id/profile", catchAsync(ctrl.getCandidateProfile));
router.patch(
  "/candidates/me/profile",
  auth,
  authorize("CANDIDATE"),
  validateBody(updateCandidateProfileSchema),
  catchAsync(ctrl.updateCandidateProfile),
);

router.get("/companies/:id/profile", catchAsync(ctrl.getCompanyProfile));
router.patch(
  "/companies/me/profile",
  auth,
  authorize("COMPANY"),
  validateBody(updateCompanyProfileSchema),
  catchAsync(ctrl.updateCompanyProfile),
);

export default router;
