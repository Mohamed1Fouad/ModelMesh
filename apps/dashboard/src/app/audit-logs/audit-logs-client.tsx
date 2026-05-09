"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AuditLog {
  id: string;
  userId: string | null;
  teamId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}

export function AuditLogsClient({
  logs,
  total,
  summary,
}: {
  logs: AuditLog[];
  total: number;
  summary: {
    byAction: { action: string; _count: number }[];
    byResource: { resource: string; _count: number }[];
  };
}) {
  const [filter, setFilter] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [resourceFilter, setResourceFilter] = useState<string | null>(null);

  const filtered = logs.filter((l) => {
    const matchesSearch =
      !filter ||
      l.action.toLowerCase().includes(filter.toLowerCase()) ||
      l.resource.toLowerCase().includes(filter.toLowerCase()) ||
      (l.userId ?? "").toLowerCase().includes(filter.toLowerCase());
    const matchesAction = !actionFilter || l.action === actionFilter;
    const matchesResource = !resourceFilter || l.resource === resourceFilter;
    return matchesSearch && matchesAction && matchesResource;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Events (7d)</p>
          <p className="text-2xl font-semibold">{total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Top Action</p>
          <p className="text-2xl font-semibold">
            {summary.byAction[0]?.action ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Top Resource</p>
          <p className="text-2xl font-semibold">
            {summary.byResource[0]?.resource ?? "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          {["post", "put", "delete"].map((a) => (
            <Button
              key={a}
              variant={actionFilter === a ? "default" : "outline"}
              size="sm"
              onClick={() => setActionFilter(actionFilter === a ? null : a)}
            >
              {a}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {["provider", "team", "key", "agent"].map((r) => (
            <Button
              key={r}
              variant={resourceFilter === r ? "default" : "outline"}
              size="sm"
              onClick={() => setResourceFilter(resourceFilter === r ? null : r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Time</th>
              <th className="px-4 py-2 text-left font-medium">Action</th>
              <th className="px-4 py-2 text-left font-medium">Resource</th>
              <th className="px-4 py-2 text-left font-medium">User</th>
              <th className="px-4 py-2 text-left font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-accent/30">
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="outline">{log.action}</Badge>
                </td>
                <td className="px-4 py-2">
                  {log.resource}
                  {log.resourceId && (
                    <span className="text-muted-foreground ml-1">({log.resourceId.slice(0, 8)}...)</span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{log.userId ?? "system"}</td>
                <td className="px-4 py-2 text-muted-foreground">{log.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
