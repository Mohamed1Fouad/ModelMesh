"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface UsageStats {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  averageLatencyMs: number;
  byProvider: Array<{
    providerId: string;
    providerName: string;
    requests: number;
    cost: number;
    tokens: number;
    monthlyCost: number;
    monthlyQuotaCost: number | null;
  }>;
  byTaskType: Array<{
    taskType: string;
    requests: number;
    cost: number;
    tokens: number;
  }>;
  byModel: Array<{
    modelId: string;
    modelName: string;
    providerName: string;
    requests: number;
    cost: number;
    tokens: number;
    monthlyCost: number;
    monthlyQuotaCost: number | null;
  }>;
}

interface UsageRecord {
  id: string;
  timestamp: Date;
  provider: { name: string; displayName: string };
  model: { name: string };
  taskType: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  latencyMs: number;
  status: string;
  routingReason: string | null;
}

export function UsageClient({ stats, recent }: { stats: UsageStats; recent: UsageRecord[] }) {
  const [days, setDays] = useState(7);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Usage & Analytics</h2>
            <p className="text-muted-foreground">Track tokens, costs, and request patterns.</p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1 text-sm ${
                  days === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Requests", value: stats.totalRequests.toLocaleString() },
          { label: "Total Tokens", value: stats.totalTokens.toLocaleString() },
          { label: "Total Cost", value: `$${stats.totalCost.toFixed(4)}` },
          { label: "Avg Latency", value: `${stats.averageLatencyMs}ms` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold tracking-tight">By Provider</h3>
          <div className="space-y-3">
            {stats.byProvider.map((p) => {
              const pct = p.monthlyQuotaCost && p.monthlyQuotaCost > 0
                ? Math.min((p.monthlyCost / p.monthlyQuotaCost) * 100, 100)
                : null;
              const barColor = pct === null ? "bg-primary" : pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div key={p.providerId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-32 font-medium text-sm">{p.providerName}</div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full`}
                          style={{
                            width: `${
                              stats.totalCost > 0 ? (p.cost / stats.totalCost) * 100 : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground ml-3">
                      {p.requests.toLocaleString()} reqs · ${p.cost.toFixed(4)}
                    </div>
                  </div>
                  {p.monthlyQuotaCost !== null && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-[140px]">
                        <div
                          className={`h-full ${barColor} rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`${pct! >= 100 ? "text-red-500" : pct! >= 80 ? "text-amber-500" : "text-emerald-500"} whitespace-nowrap`}>
                        ${p.monthlyCost.toFixed(2)} / ${p.monthlyQuotaCost.toFixed(2)} ({pct!.toFixed(0)}%)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {stats.byProvider.length === 0 && (
              <p className="text-sm text-muted-foreground">No provider usage data yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold tracking-tight">By Model</h3>
          <div className="space-y-3">
            {stats.byModel.map((m) => {
              const pct = m.monthlyQuotaCost && m.monthlyQuotaCost > 0
                ? Math.min((m.monthlyCost / m.monthlyQuotaCost) * 100, 100)
                : null;
              const barColor = pct === null ? "bg-emerald-500" : pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div key={m.modelId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-32 font-medium text-sm truncate" title={m.modelName}>{m.modelName}</div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full`}
                          style={{
                            width: `${
                              stats.totalCost > 0 ? (m.cost / stats.totalCost) * 100 : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground ml-3">
                      {m.requests.toLocaleString()} reqs · ${m.cost.toFixed(4)}
                    </div>
                  </div>
                  {m.monthlyQuotaCost !== null && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-[140px]">
                        <div
                          className={`h-full ${barColor} rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`${pct! >= 100 ? "text-red-500" : pct! >= 80 ? "text-amber-500" : "text-emerald-500"} whitespace-nowrap`}>
                        ${m.monthlyCost.toFixed(2)} / ${m.monthlyQuotaCost.toFixed(2)} ({pct!.toFixed(0)}%)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {stats.byModel.length === 0 && (
              <p className="text-sm text-muted-foreground">No model usage data yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold tracking-tight">By Task Type</h3>
          <div className="space-y-3">
            {stats.byTaskType.map((t) => (
              <div key={t.taskType} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-32 font-medium text-sm capitalize">{t.taskType}</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full"
                      style={{
                        width: `${
                          stats.totalCost > 0 ? (t.cost / stats.totalCost) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t.requests.toLocaleString()} reqs · ${t.cost.toFixed(4)}
                </div>
              </div>
            ))}
            {stats.byTaskType.length === 0 && (
              <p className="text-sm text-muted-foreground">No task type data yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold tracking-tight">Recent Requests</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 text-left">Time</th>
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
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 text-xs text-muted-foreground">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
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
              {recent.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No requests yet. Send some traffic to see data here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
