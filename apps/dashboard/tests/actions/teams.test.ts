import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTeams, getTeam, createTeam, updateTeam, deleteTeam, createInvitation, updateMemberRole, removeMember } from "../../src/actions/teams.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamInvitation: {
      create: vi.fn(),
    },
    teamMember: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@modelmesh/db";
import { revalidatePath } from "next/cache";

describe("teams actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTeams returns teams with relations", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValue([{ id: "t1" }] as any);
    const result = await getTeams();
    expect(result).toHaveLength(1);
    expect(prisma.team.findMany).toHaveBeenCalledWith({
      include: {
        members: { include: { user: { select: { id: true, email: true, name: true, avatar: true } } } },
        providers: { include: { provider: true } },
        budgets: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("getTeam returns single with relations", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: "t1" } as any);
    const result = await getTeam("t1");
    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: "t1" },
      include: {
        members: { include: { user: { select: { id: true, email: true, name: true, avatar: true } } } },
        providers: { include: { provider: true } },
        budgets: true,
        invitations: { where: { accepted: false, expiresAt: { gt: expect.any(Date) } } },
      },
    });
  });

  it("createTeam sanitizes slug", async () => {
    vi.mocked(prisma.team.create).mockResolvedValue({ id: "t1", name: "Eng", slug: "eng-team" } as any);
    const result = await createTeam({ name: "Eng", slug: "Eng Team!" });
    expect(prisma.team.create).toHaveBeenCalledWith({
      data: { name: "Eng", slug: "eng-team-", description: undefined },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/teams");
  });

  it("updateTeam patches and revalidates", async () => {
    vi.mocked(prisma.team.update).mockResolvedValue({ id: "t1" } as any);
    await updateTeam("t1", { name: "New", enabled: false });
    expect(prisma.team.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { name: "New", description: undefined, enabled: false } });
    expect(revalidatePath).toHaveBeenCalledWith("/teams");
    expect(revalidatePath).toHaveBeenCalledWith("/teams/t1");
  });

  it("deleteTeam removes and revalidates", async () => {
    vi.mocked(prisma.team.delete).mockResolvedValue({} as any);
    await deleteTeam("t1");
    expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/teams");
  });

  it("createInvitation with defaults", async () => {
    vi.mocked(prisma.teamInvitation.create).mockResolvedValue({ id: "i1" } as any);
    const result = await createInvitation("t1", { email: "a@b.com" });
    expect(prisma.teamInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ teamId: "t1", email: "a@b.com", role: "developer" }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/teams/t1");
  });

  it("createInvitation with custom role", async () => {
    vi.mocked(prisma.teamInvitation.create).mockResolvedValue({ id: "i1" } as any);
    await createInvitation("t1", { email: "a@b.com", role: "admin" });
    expect(prisma.teamInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "admin" }),
    });
  });

  it("updateMemberRole updates and revalidates", async () => {
    vi.mocked(prisma.teamMember.update).mockResolvedValue({ id: "m1", role: "admin" } as any);
    const result = await updateMemberRole("m1", "admin");
    expect(result.role).toBe("admin");
    expect(prisma.teamMember.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { role: "admin" } });
    expect(revalidatePath).toHaveBeenCalledWith("/teams");
  });

  it("removeMember deletes and revalidates", async () => {
    vi.mocked(prisma.teamMember.delete).mockResolvedValue({} as any);
    await removeMember("m1");
    expect(prisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/teams");
  });
});
