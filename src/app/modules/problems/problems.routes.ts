import { Router } from "express";
import * as ctrl from "./problems.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import { validateBody, validateQuery } from "../../middlewares/validate.js";
import {
  createProblemSchema,
  updateProblemSchema,
  listProblemsQuerySchema,
} from "./problems.validation.js";

const router = Router();

// Public list & get
router.get("/", validateQuery(listProblemsQuerySchema), ctrl.listProblems);
router.get("/:id", ctrl.getProblemById);

// Authenticated write
router.post(
  "/",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(createProblemSchema),
  ctrl.createProblem,
);
router.patch(
  "/:id",
  auth,
  authorize("COMPANY", "ADMIN"),
  validateBody(updateProblemSchema),
  ctrl.updateProblem,
);
router.delete(
  "/:id",
  auth,
  authorize("COMPANY", "ADMIN"),
  ctrl.softDeleteProblem,
);

export default router;
