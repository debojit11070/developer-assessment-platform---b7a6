import { Router } from "express";
import * as ctrl from "./admin.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import { validateBody, validateQuery } from "../../middlewares/validate.js";
import { catchAsync } from "../../utils/asyncHandler.js";
import {
  adminAuditQuerySchema,
  adminUpdateUserSchema,
  adminUserListQuerySchema,
} from "./admin.validation.js";

const router = Router();
router.use(auth, authorize("ADMIN"));

router.get("/users", validateQuery(adminUserListQuerySchema), catchAsync(ctrl.listUsers));
router.patch("/users/:id", validateBody(adminUpdateUserSchema), catchAsync(ctrl.changeUserRole));
router.delete("/users/:id", catchAsync(ctrl.softDeleteUser));

router.get("/dashboard-stats", catchAsync(ctrl.dashboardStats));
router.get("/audit-logs", validateQuery(adminAuditQuerySchema), catchAsync(ctrl.auditLogs));

export default router;
