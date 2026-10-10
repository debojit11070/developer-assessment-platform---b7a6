import type { Request, Response } from "express";
import { prisma } from "../../../config/prisma.js";
import { ok } from "../../utils/response.js";
import { NotFoundError } from "../../utils/errors.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new NotFoundError();
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    include: {
      candidateProfile: true,
      companyProfile: true,
    },
  });
  if (!user) throw new NotFoundError("User not found");

  const { passwordHash, refreshToken, ...safe } = user;
  void passwordHash;
  void refreshToken;
  ok(res, safe, "Profile fetched");
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new NotFoundError();
  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data: req.body,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      bio: true,
      avatarUrl: true,
      updatedAt: true,
    },
  });
  ok(res, user, "Profile updated");
}

export async function getCandidateProfile(req: Request, res: Response): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: req.params.id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
  });
  if (!profile) throw new NotFoundError("Candidate profile not found");
  ok(res, profile, "Candidate profile fetched");
}

export async function updateCandidateProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new NotFoundError();
  // Registration always creates a profile row for CANDIDATE users, so this is an
  // update, not an upsert — `upsert` would validate `create`'s required fields
  // even though the row already exists and only `update` would ever run.
  const updated = await prisma.candidateProfile.update({
    where: { userId: req.user.sub },
    data: req.body,
  });
  ok(res, updated, "Candidate profile updated");
}

export async function getCompanyProfile(req: Request, res: Response): Promise<void> {
  const profile = await prisma.companyProfile.findUnique({
    where: { userId: req.params.id },
    include: {
      user: {
        select: { id: true, fullName: true, avatarUrl: true },
      },
    },
  });
  if (!profile) throw new NotFoundError("Company profile not found");
  ok(res, profile, "Company profile fetched");
}

export async function updateCompanyProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new NotFoundError();
  // Registration always creates a profile row for COMPANY users (see the note
  // in updateCandidateProfile above for why this must be `update`, not `upsert`).
  const updated = await prisma.companyProfile.update({
    where: { userId: req.user.sub },
    data: req.body,
  });
  ok(res, updated, "Company profile updated");
}
