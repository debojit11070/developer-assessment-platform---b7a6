import { Router } from "express";
import * as ctrl from "./admin.controller.js";
import { auth, authorize } from "../../middlewares/auth.js";
import { validateBody, validateQuery } from "../../middlewares/validate.js";
import {
  adminAuditQuerySchema,
  adminUpdateUserSchema,
  adminUserListQuerySchema,
} from "./admin.validation.js";

const router = Router();
router.use(auth, authorize("ADMIN"));

router.get("/users", validateQuery(adminUserListQuerySchema), ctrl.listUsers);
router.patch("/users/:id", validateBody(adminUpdateUserSchema), ctrl.changeUserRole);
router.delete("/users/:id", ctrl.softDeleteUser);

router.get("/dashboard-stats", ctrl.dashboardStats);
router.get("/audit-logs", validateQuery(adminAuditQuerySchema), ctrl.auditLogs);

export default router;
