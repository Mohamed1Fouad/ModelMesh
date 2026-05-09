import { prisma } from "@modelmesh/db";
import { getUsageStats, getRecentUsage, getHealthHistory } from "@/actions/usage";
import { ProvidersCard } from "@/components/providers-card";
import { StatsCards } from "@/components/stats-cards";
import { RecentUsage } from "@/components/recent-usage";
import { HealthStatus } from "@/components/health-status";
import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [providerCount, modelCount, stats, recent, health] = await Promise.all([
    prisma.provider.count(),
    prisma.model.count(),
    getUsageStats(7),
    getRecentUsage(20),
    getHealthHistory(24),
  ]);

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
          <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
          <p className="text-muted-foreground">Monitor your AI providers, routing decisions, and usage in real time.</p>
        </div>

        <StatsCards
          providers={providerCount}
          models={modelCount}
          requests={stats.totalRequests}
          cost={stats.totalCost}
          tokens={stats.totalTokens}
          latency={stats.averageLatencyMs}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentUsage records={recent} />
          </div>
          <div>
            <HealthStatus health={health} />
          </div>
        </div>

        <ProvidersCard />
      </main>
    </div>
  );
}
