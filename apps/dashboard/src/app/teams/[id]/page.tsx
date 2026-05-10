import { getTeam } from "@/actions/teams";
import { TeamDetailClient } from "./team-detail-client";
import { DashboardNav } from "@/components/dashboard-nav";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeam(id);
  if (!team) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
            M
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ModelMesh</h1>
        </div>
        <DashboardNav />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{team.name}</h2>
          <p className="text-muted-foreground">@{team.slug} &middot; {team.members.length} members</p>
        </div>

        <TeamDetailClient team={team} />
      </main>
    </div>
  );
}
