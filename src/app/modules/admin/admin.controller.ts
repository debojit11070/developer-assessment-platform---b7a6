import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { ok } from "../../utils/response.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import type { AdminUserListQuery } from "./admin.validation.js";

function getQ(req: Request): AdminUserListQuery {
  return (req as Request & { validatedQuery?: AdminUserListQuery }).validatedQuery ?? {
    page: 1,
    limit: 20,
    sortBy: "createdAt",
    order: "desc",
  };
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const q = getQ(req);
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (q.role) where.role = q.role;
  if (q.status) where.status = q.status;
  if (q.search) {
    where.OR = [
      { email: { contains: q.search, mode: "insensitive" } },
      { fullName: { contains: q.search, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { [q.sortBy]: q.order },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.user.count({ where }),
  ]);
  ok(res, {
    items,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  }, "Users fetched");
}

export async function changeUserRole(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const updates = req.body as { role?: "CANDIDATE" | "COMPANY" | "ADMIN"; status?: "ACTIVE" | "SUSPENDED" | "PENDING"; fullName?: string };
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user || user.deletedAt) throw new NotFoundError("User not found");

  const updated = await prisma.user.update({ where: { id: req.params.id }, data: updates });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.sub,
      action: "user.updated",
      resource: "user",
      resourceId: user.id,
      meta: { updates, prevRole: user.role },
    },
  });

  const { passwordHash, refreshToken, ...safe } = updated;
  void passwordHash;
  void refreshToken;
  ok(res, safe, "User updated");
}

export async function softDeleteUser(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  if (req.user.sub === req.params.id) {
    throw new ForbiddenError("You cannot delete your own account");
  }
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user || user.deletedAt) throw new NotFoundError("User not found");
  await prisma.user.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), status: "SUSPENDED", refreshToken: null },
  });
  await prisma.auditLog.create({
    data: {
      actorId: req.user.sub,
      action: "user.deleted",
      resource: "user",
      resourceId: user.id,
    },
  });
  ok(res, null, "User deleted");
}

export async function dashboardStats(_req: Request, res: Response): Promise<void> {
  const [
    totalUsers,
    totalCandidates,
    totalCompanies,
    totalAssessments,
    totalAttempts,
    totalPaymentsSucceeded,
    totalPaymentsAgg,
    recentSignups,
    attemptsByStatus,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "CANDIDATE" } }),
    prisma.user.count({ where: { role: "COMPANY" } }),
    prisma.assessment.count(),
    prisma.attempt.count(),
    prisma.payment.count({ where: { status: "SUCCEEDED" } }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amountCents: true },
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    }),
    prisma.attempt.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  ok(res, {
    users: { total: totalUsers, candidates: totalCandidates, companies: totalCompanies },
    assessments: { total: totalAssessments },
    attempts: { total: totalAttempts, byStatus: attemptsByStatus },
    payments: {
      succeededCount: totalPaymentsSucceeded,
      totalRevenueCents: totalPaymentsAgg._sum.amountCents ?? 0,
    },
    recentSignups,
  }, "Dashboard stats");
}

export async function auditLogs(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const where: Prisma.AuditLogWhereInput = {};
  if (req.query.actorId) where.actorId = String(req.query.actorId);
  if (req.query.resource) where.resource = String(req.query.resource);
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) (where.createdAt as Record<string, Date>).gte = new Date(String(req.query.from));
    if (req.query.to) (where.createdAt as Record<string, Date>).lte = new Date(String(req.query.to));
  }
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, email: true, fullName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  ok(res, {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }, "Audit logs fetched");
}
