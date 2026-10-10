import { Router } from "express";
import * as ctrl from "./problems.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import { validateBody, validateQuery } from "../../middlewares/validate.js";
import { catchAsync } from "../../utils/asyncHandler.js";
import {
  createProblemSchema,
  updateProblemSchema,
  listProblemsQuerySchema,
} from "./problems.validation.js";

const router = Router();

// Public list & get
router.get("/", validateQuery(listProblemsQuerySchema), catchAsync(ctrl.listProblems));
router.get("/:id", catchAsync(ctrl.getProblemById));

// Authenticated write
router.post(
  "/",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(createProblemSchema),
  catchAsync(ctrl.createProblem),
);
router.patch(
  "/:id",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(updateProblemSchema),
  catchAsync(ctrl.updateProblem),
);
router.delete(
  "/:id",
  auth,
  authorize("COMPANY", "ADMIN"),
  catchAsync(ctrl.softDeleteProblem),
);

export default router;
