import type { Request, Response } from "express";
import { AssessmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { ok, created } from "../../utils/response.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import type {
  CreateAssessmentDto,
  ListAssessmentsQuery,
  UpdateAssessmentDto,
} from "./assessments.validation.js";

function getQ(req: Request): ListAssessmentsQuery {
  return (req as Request & { validatedQuery?: ListAssessmentsQuery }).validatedQuery ?? {
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    order: "desc",
  };
}

export async function createAssessment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const data: CreateAssessmentDto = req.body;

  // Ensure all problems exist
  const found = await prisma.problem.findMany({
    where: { id: { in: data.problems.map((p) => p.problemId) }, deletedAt: null },
  });
  if (found.length !== data.problems.length) {
    throw new BadRequestError("One or more problems not found");
  }

  const assessment = await prisma.$transaction(async (tx) => {
    const a = await tx.assessment.create({
      data: {
        title: data.title,
        description: data.description,
        durationMin: data.durationMin,
        passingScore: data.passingScore,
        priceCents: data.priceCents,
        currency: data.currency,
        createdById: req.user!.sub,
      },
    });
    for (const [i, p] of data.problems.entries()) {
      await tx.assessmentProblem.create({
        data: {
          assessmentId: a.id,
          problemId: p.problemId,
          order: p.order ?? i,
          points: p.points ?? undefined,
        },
      });
    }
    return a;
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.sub,
      action: "assessment.created",
      resource: "assessment",
      resourceId: assessment.id,
    },
  });

  created(res, assessment, "Assessment created");
}

export async function getAssessmentById(req: Request, res: Response): Promise<void> {
  const a = await prisma.assessment.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: {
      problems: {
        include: {
          problem: {
            select: {
              id: true,
              title: true,
              type: true,
              difficulty: true,
              description: true,
              points: true,
              timeLimitSec: true,
              memoryLimitMb: true,
              starterCode: true,
              language: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!a) throw new NotFoundError("Assessment not found");
  ok(res, a, "Assessment fetched");
}

export async function listAssessments(req: Request, res: Response): Promise<void> {
  const q = getQ(req);
  const where: Prisma.AssessmentWhereInput = {
    deletedAt: null,
    status: q.status ?? AssessmentStatus.PUBLISHED,
  };
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: "insensitive" } },
      { description: { contains: q.search, mode: "insensitive" } },
    ];
  }
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    where.priceCents = {};
    if (q.minPrice !== undefined) where.priceCents.gte = q.minPrice;
    if (q.maxPrice !== undefined) where.priceCents.lte = q.maxPrice;
  }

  const [items, total] = await Promise.all([
    prisma.assessment.findMany({
      where,
      orderBy: { [q.sortBy]: q.order },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        problems: { select: { id: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    }),
    prisma.assessment.count({ where }),
  ]);

  ok(res, {
    items: items.map((a) => ({ ...a, problemCount: a.problems.length })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  }, "Assessments fetched");
}

export async function updateAssessment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const data: UpdateAssessmentDto = req.body;
  const existing = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) throw new NotFoundError("Assessment not found");
  if (existing.createdById !== req.user.sub && req.user.role !== "ADMIN") {
    throw new ForbiddenError("You can only update your own assessments");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const a = await tx.assessment.update({
      where: { id: req.params.id },
      data: {
        title: data.title,
        description: data.description,
        durationMin: data.durationMin,
        passingScore: data.passingScore,
        priceCents: data.priceCents,
        currency: data.currency,
      },
    });
    if (data.problems) {
      await tx.assessmentProblem.deleteMany({ where: { assessmentId: req.params.id } });
      for (const [i, p] of data.problems.entries()) {
        await tx.assessmentProblem.create({
          data: {
            assessmentId: req.params.id,
            problemId: p.problemId,
            order: p.order ?? i,
            points: p.points ?? undefined,
          },
        });
      }
    }
    return a;
  });

  ok(res, updated, "Assessment updated");
}

export async function changeStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const existing = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) throw new NotFoundError("Assessment not found");
  if (existing.createdById !== req.user.sub && req.user.role !== "ADMIN") {
    throw new ForbiddenError("You can only change status of your own assessments");
  }
  const updated = await prisma.assessment.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      publishedAt: req.body.status === "PUBLISHED" ? new Date() : existing.publishedAt,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: req.user.sub,
      action: "assessment.status_changed",
      resource: "assessment",
      resourceId: req.params.id,
      meta: { status: updated.status },
    },
  });
  ok(res, updated, "Assessment status updated");
}

export async function softDeleteAssessment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const existing = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) throw new NotFoundError("Assessment not found");
  if (existing.createdById !== req.user.sub && req.user.role !== "ADMIN") {
    throw new ForbiddenError("You can only delete your own assessments");
  }
  await prisma.assessment.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      actorId: req.user.sub,
      action: "assessment.deleted",
      resource: "assessment",
      resourceId: req.params.id,
    },
  });
  ok(res, null, "Assessment deleted");
}
