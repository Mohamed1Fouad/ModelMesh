import { prisma } from "@modelmesh/db";
import { getUsageStats, getRecentUsage } from "@/actions/usage";
import { ProvidersCard } from "@/components/providers-card";
import { StatsCards } from "@/components/stats-cards";
import { RecentUsage } from "@/components/recent-usage";
import { DashboardNav } from "@/components/dashboard-nav";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [providerCount, modelCount, stats, recent] = await Promise.all([
    prisma.provider.count(),
    prisma.model.count(),
    getUsageStats(7),
    getRecentUsage(20),
  ]);

  const atRiskProviders = stats.byProvider.filter(
    (p) => p.monthlyQuotaCost !== null && p.monthlyQuotaCost > 0 && (p.monthlyCost / p.monthlyQuotaCost) >= 0.8
  );

  const atRiskModels = stats.byModel.filter(
    (m) => m.monthlyQuotaCost !== null && m.monthlyQuotaCost > 0 && (m.monthlyCost / m.monthlyQuotaCost) >= 0.8
  );

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

        {(atRiskProviders.length > 0 || atRiskModels.length > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-900">Quota Alerts</span>
              <Badge variant="warning">{atRiskProviders.length + atRiskModels.length}</Badge>
            </div>
            <div className="space-y-2">
              {atRiskProviders.map((p) => {
                const pct = ((p.monthlyCost / (p.monthlyQuotaCost ?? 1)) * 100).toFixed(0);
                return (
                  <div key={p.providerId} className="flex items-center justify-between text-sm text-amber-800">
                    <span>Provider <strong>{p.providerName}</strong> at {pct}% of monthly quota</span>
                    <span>${p.monthlyCost.toFixed(2)} / ${p.monthlyQuotaCost?.toFixed(2)}</span>
                  </div>
                );
              })}
              {atRiskModels.map((m) => {
                const pct = ((m.monthlyCost / (m.monthlyQuotaCost ?? 1)) * 100).toFixed(0);
                return (
                  <div key={m.modelId} className="flex items-center justify-between text-sm text-amber-800">
                    <span>Model <strong>{m.modelName}</strong> at {pct}% of monthly quota</span>
                    <span>${m.monthlyCost.toFixed(2)} / ${m.monthlyQuotaCost?.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <StatsCards
          providers={providerCount}
          models={modelCount}
          requests={stats.totalRequests}
          cost={stats.totalCost}
          tokens={stats.totalTokens}
          latency={stats.averageLatencyMs}
        />

        <RecentUsage records={recent} />

        <ProvidersCard />
      </main>
    </div>
  );
}
