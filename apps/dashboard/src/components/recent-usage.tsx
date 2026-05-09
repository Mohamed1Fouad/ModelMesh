"use client";

import { Badge } from "@/components/ui/badge";

interface UsageRecord {
  id: string;
  timestamp: Date;
  provider: { name: string; displayName: string } | null;
  model: { name: string } | null;
  taskType: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  latencyMs: number;
  status: string;
  routingReason: string | null;
}

export function RecentUsage({ records }: { records: UsageRecord[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold tracking-tight">Recent Requests</h3>
        <a href="/usage" className="text-sm text-muted-foreground hover:text-foreground transition-colors">View all →</a>
      </div>
      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 text-left">Provider</th>
                <th className="py-2 text-left">Model</th>
                <th className="py-2 text-left">Task</th>
                <th className="py-2 text-left">Tokens</th>
                <th className="py-2 text-left">Cost</th>
                <th className="py-2 text-left">Latency</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.provider?.displayName ?? "Unknown"}</td>
                  <td className="py-2">{r.model?.name ?? "Unknown"}</td>
                  <td className="py-2 capitalize">{r.taskType}</td>
                  <td className="py-2">{r.totalTokens.toLocaleString()}</td>
                  <td className="py-2">${r.cost.toFixed(5)}</td>
                  <td className="py-2">{r.latencyMs}ms</td>
                  <td className="py-2">
                    <Badge
                      variant={
                        r.status === "success"
                          ? "success"
                          : r.status === "cached"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No usage data yet. Send requests to the gateway to see activity here.</p>
      )}
    </div>
  );
}
