import type { Request, Response } from "express";
import { AttemptStatus, InvitationStatus, AssessmentStatus } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { ok, created } from "../../utils/response.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../utils/errors.js";
import type { CreateInvitationDto, SubmitAnswerDto } from "./attempts.validation.js";

// =========== INVITATIONS ===========

export async function createInvitation(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const data: CreateInvitationDto = req.body;

  const assessment = await prisma.assessment.findUnique({
    where: { id: data.assessmentId },
  });
  if (!assessment || assessment.deletedAt) throw new NotFoundError("Assessment not found");
  if (
    assessment.createdById !== req.user.sub &&
    req.user.role !== "ADMIN"
  ) {
    throw new ForbiddenError("You can only invite to your own assessments");
  }

  const candidate = await prisma.user.findUnique({ where: { id: data.candidateId } });
  if (!candidate || candidate.role !== "CANDIDATE") {
    throw new BadRequestError("Candidate not found or invalid role");
  }

  const expiresAt = new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      assessmentId: data.assessmentId,
      candidateId: data.candidateId,
      invitedById: req.user.sub,
      expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.sub,
      action: "invitation.created",
      resource: "invitation",
      resourceId: invitation.id,
      meta: { assessmentId: data.assessmentId, candidateId: data.candidateId },
    },
  });

  created(res, invitation, "Invitation created");
}

export async function listMyInvitations(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const items = await prisma.invitation.findMany({
    where: { candidateId: req.user.sub },
    include: { assessment: { select: { id: true, title: true, durationMin: true } } },
    orderBy: { invitedAt: "desc" },
  });
  ok(res, { items }, "Invitations fetched");
}

export async function respondToInvitation(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const { invitationId } = req.body;
  const action: "ACCEPTED" | "DECLINED" = req.params.action === "accept" ? "ACCEPTED" : "DECLINED";

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { assessment: true },
  });
  if (!invitation) throw new NotFoundError("Invitation not found");
  if (invitation.candidateId !== req.user.sub) throw new ForbiddenError("Not your invitation");
  if (invitation.status !== InvitationStatus.PENDING) {
    throw new BadRequestError(`Invitation already ${invitation.status}`);
  }
  if (new Date() > invitation.expiresAt) {
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.EXPIRED },
    });
    throw new BadRequestError("Invitation expired");
  }
  if (invitation.assessment.status !== AssessmentStatus.PUBLISHED) {
    throw new BadRequestError("Assessment is not available");
  }

  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: action },
  });
  ok(res, updated, `Invitation ${action.toLowerCase()}`);
}

// =========== ATTEMPTS ===========

export async function startAttempt(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const invitationId = req.params.invitationId;

  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { id: invitationId },
      include: { assessment: { include: { problems: { include: { problem: true } } } } },
    });
    if (!invitation) throw new NotFoundError("Invitation not found");
    if (invitation.candidateId !== req.user!.sub) throw new ForbiddenError("Not your invitation");
    if (invitation.status !== InvitationStatus.ACCEPTED) {
      throw new BadRequestError("Invitation must be accepted first");
    }
    // Prevent duplicate attempts
    const existing = await tx.attempt.findUnique({ where: { invitationId } });
    if (existing) {
      return ok(res, existing, "Attempt already started");
    }

    const expiresAt = new Date(
      Date.now() + invitation.assessment.durationMin * 60 * 1000,
    );

    const attempt = await tx.attempt.create({
      data: {
        invitationId,
        candidateId: invitation.candidateId,
        assessmentId: invitation.assessmentId,
        expiresAt,
        totalPoints: invitation.assessment.problems.reduce((sum, ap) => sum + ap.points, 0),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: "attempt.started",
        resource: "attempt",
        resourceId: attempt.id,
      },
    });

    return ok(res, attempt, "Attempt started", 201);
  }).then(() => undefined).catch((e) => { throw e; });
}

export async function getMyAttemptByAssessment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const attempt = await prisma.attempt.findFirst({
    where: { candidateId: req.user.sub, assessmentId: req.params.assessmentId },
    include: { answers: true },
  });
  if (!attempt) throw new NotFoundError("Attempt not found");
  ok(res, attempt, "Attempt fetched");
}

export async function saveAnswer(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const data: SubmitAnswerDto = req.body;
  const attempt = await prisma.attempt.findUnique({
    where: { id: req.params.attemptId },
    include: { assessment: { include: { problems: true } } },
  });
  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.candidateId !== req.user.sub) throw new ForbiddenError("Not your attempt");
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new BadRequestError("Attempt is not in progress");
  }
  if (new Date() > attempt.expiresAt) {
    throw new BadRequestError("Attempt expired");
  }
  const linked = attempt.assessment.problems.find((p) => p.problemId === data.problemId);
  if (!linked) throw new BadRequestError("Problem not part of this assessment");

  const answer = await prisma.answer.upsert({
    where: { attemptId_problemId: { attemptId: attempt.id, problemId: data.problemId } },
    create: {
      attemptId: attempt.id,
      problemId: data.problemId,
      mcqOption: data.mcqOption,
      writtenAnswer: data.writtenAnswer,
      codeAnswer: data.codeAnswer,
      codeLanguage: data.codeLanguage,
    },
    update: {
      mcqOption: data.mcqOption,
      writtenAnswer: data.writtenAnswer,
      codeAnswer: data.codeAnswer,
      codeLanguage: data.codeLanguage,
    },
  });
  ok(res, answer, "Answer saved");
}

async function autoEvaluateMCQ(
  attemptId: string,
  assessmentId: string,
): Promise<{ score: number; total: number }> {
  const problems = await prisma.problem.findMany({
    where: { assessmentProblems: { some: { assessmentId } } },
  });
  const answers = await prisma.answer.findMany({ where: { attemptId } });
  let score = 0;
  let total = 0;
  for (const ap of problems) {
    if (ap.type === "MCQ" && ap.correctOption) {
      total += ap.points;
      const ans = answers.find((a) => a.problemId === ap.id);
      const correct = !!ans && ans.mcqOption === ap.correctOption;
      if (correct) score += ap.points;
      await prisma.answer.upsert({
        where: { attemptId_problemId: { attemptId, problemId: ap.id } },
        create: {
          attemptId,
          problemId: ap.id,
          mcqOption: ans?.mcqOption,
          isCorrect: correct,
          pointsAwarded: correct ? ap.points : 0,
        },
        update: {
          isCorrect: correct,
          pointsAwarded: correct ? ap.points : 0,
        },
      });
    }
  }
  return { score, total };
}

export async function submitAttempt(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const attempt = await prisma.attempt.findUnique({
    where: { id: req.params.attemptId },
    include: { assessment: true },
  });
  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.candidateId !== req.user.sub) throw new ForbiddenError("Not your attempt");
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new BadRequestError("Attempt is not in progress");
  }

  await prisma.$transaction(async (tx) => {
    const { score, total } = await autoEvaluateMCQ(attempt.id, attempt.assessmentId);

    const assessed = await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        status: AttemptStatus.SUBMITTED,
        submittedAt: new Date(),
        score,
        totalPoints: total || attempt.totalPoints,
      },
    });

    if (assessed.totalPoints && assessed.totalPoints > 0) {
      const pct = Math.round((score / assessed.totalPoints) * 100);
      await tx.attempt.update({
        where: { id: attempt.id },
        data: {
          passed: pct >= attempt.assessment.passingScore,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: "attempt.submitted",
        resource: "attempt",
        resourceId: attempt.id,
      },
    });
  });

  const final = await prisma.attempt.findUnique({
    where: { id: req.params.attemptId },
    include: { answers: true },
  });
  ok(res, final, "Attempt submitted");
}

export async function evaluateAttempt(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const attempt = await prisma.attempt.findUnique({
    where: { id: req.params.attemptId },
    include: { assessment: { include: { problems: true } } },
  });
  if (!attempt) throw new NotFoundError("Attempt not found");
  if (
    attempt.assessment.createdById !== req.user.sub &&
    req.user.role !== "ADMIN"
  ) {
    throw new ForbiddenError("You can only evaluate attempts for your assessments");
  }
  if (attempt.status !== AttemptStatus.SUBMITTED) {
    throw new BadRequestError("Only SUBMITTED attempts can be evaluated");
  }

  const manual = (req.body.manualScores ?? []) as Array<{
    problemId: string;
    pointsAwarded: number;
    feedback?: string;
  }>;

  await prisma.$transaction(async (tx) => {
    let totalScore = attempt.score ?? 0;
    for (const m of manual) {
      const ap = attempt.assessment.problems.find((p) => p.problemId === m.problemId);
      if (!ap) continue;
      const previous = await tx.answer.findUnique({
        where: { attemptId_problemId: { attemptId: attempt.id, problemId: m.problemId } },
      });
      totalScore = totalScore - (previous?.pointsAwarded ?? 0) + m.pointsAwarded;
      await tx.answer.upsert({
        where: { attemptId_problemId: { attemptId: attempt.id, problemId: m.problemId } },
        create: {
          attemptId: attempt.id,
          problemId: m.problemId,
          pointsAwarded: m.pointsAwarded,
          feedback: m.feedback,
        },
        update: { pointsAwarded: m.pointsAwarded, feedback: m.feedback },
      });
    }
    const totalPoints = attempt.assessment.problems.reduce((s, p) => s + p.points, 0);
    const pct = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
    await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        score: totalScore,
        totalPoints,
        passed: pct >= attempt.assessment.passingScore,
        status: AttemptStatus.EVALUATED,
        evaluatedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: "attempt.evaluated",
        resource: "attempt",
        resourceId: attempt.id,
      },
    });
  });

  const final = await prisma.attempt.findUnique({
    where: { id: req.params.attemptId },
    include: { answers: true },
  });
  ok(res, final, "Attempt evaluated");
}

export async function listAttemptsForAssessment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const assessment = await prisma.assessment.findUnique({
    where: { id: req.params.assessmentId },
  });
  if (!assessment || assessment.deletedAt) throw new NotFoundError("Assessment not found");
  if (
    assessment.createdById !== req.user.sub &&
    req.user.role !== "ADMIN"
  ) {
    throw new ForbiddenError("Not your assessment");
  }
  const items = await prisma.attempt.findMany({
    where: { assessmentId: req.params.assessmentId },
    include: {
      candidate: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { startedAt: "desc" },
  });
  ok(res, { items }, "Attempts fetched");
}
