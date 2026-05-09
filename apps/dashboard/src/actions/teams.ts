"use server";

import { prisma } from "@modelmesh/db";
import { revalidatePath } from "next/cache";

export async function getTeams() {
  return prisma.team.findMany({
    include: {
      members: { include: { user: { select: { id: true, email: true, name: true, avatar: true } } } },
      providers: { include: { provider: true } },
      budgets: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTeam(id: string) {
  return prisma.team.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, email: true, name: true, avatar: true } } } },
      providers: { include: { provider: true } },
      budgets: true,
      invitations: { where: { accepted: false, expiresAt: { gt: new Date() } } },
    },
  });
}

export async function createTeam(data: { name: string; slug: string; description?: string }) {
  const team = await prisma.team.create({
    data: {
      name: data.name,
      slug: data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      description: data.description,
    },
  });
  revalidatePath("/teams");
  return team;
}

export async function updateTeam(id: string, data: { name?: string; description?: string; enabled?: boolean }) {
  const team = await prisma.team.update({ where: { id }, data });
  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
  return team;
}

export async function deleteTeam(id: string) {
  await prisma.team.delete({ where: { id } });
  revalidatePath("/teams");
}

export async function createInvitation(teamId: string, data: { email: string; role?: string }) {
  const token = crypto.randomUUID();
  const invitation = await prisma.teamInvitation.create({
    data: {
      teamId,
      email: data.email,
      role: data.role ?? "developer",
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  revalidatePath(`/teams/${teamId}`);
  return invitation;
}

export async function updateMemberRole(memberId: string, role: string) {
  const member = await prisma.teamMember.update({ where: { id: memberId }, data: { role } });
  revalidatePath("/teams");
  return member;
}

export async function removeMember(memberId: string) {
  await prisma.teamMember.delete({ where: { id: memberId } });
  revalidatePath("/teams");
}
