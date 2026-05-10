import { getRoutingRules } from "@/actions/routing-rules";
import { RoutingClient } from "./routing-client";
import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function RoutingPage() {
  const rawRules = await getRoutingRules();
  const rules = rawRules.map((r) => ({
    ...r,
    condition: r.condition as Record<string, unknown>,
    action: r.action as Record<string, unknown>,
  }));

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
      <main className="max-w-7xl mx-auto px-6 py-8">
        <RoutingClient rules={rules} />
      </main>
    </div>
  );
}
