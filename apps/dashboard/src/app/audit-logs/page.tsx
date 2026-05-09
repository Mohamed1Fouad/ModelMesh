import { getAuditLogs, getAuditSummary } from "@/actions/audit";
import { AuditLogsClient } from "./audit-logs-client";
import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const { logs, total } = await getAuditLogs({ limit: 100 });
  const summary = await getAuditSummary(7);

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
          <h2 className="text-2xl font-semibold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">Track every change across your organization.</p>
        </div>

        <AuditLogsClient logs={logs} total={total} summary={summary} />
      </main>
    </div>
  );
}
