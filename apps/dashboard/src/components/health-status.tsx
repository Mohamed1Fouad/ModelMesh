"use client";

interface HealthLog {
  id: string;
  status: string;
  latencyMs: number;
  checkedAt: Date;
  provider: { name: string; displayName: string };
}

export function HealthStatus({ health }: { health: HealthLog[] }) {
  const latest = Object.values(
    health.reduce((acc, h) => {
      if (!acc[h.provider.name] || new Date(h.checkedAt) > new Date(acc[h.provider.name].checkedAt)) {
        acc[h.provider.name] = h;
      }
      return acc;
    }, {} as Record<string, HealthLog>)
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold tracking-tight">Provider Health</h3>
      <div className="space-y-3">
        {latest.map((h) => (
          <div key={h.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  h.status === "healthy"
                    ? "bg-emerald-500"
                    : h.status === "degraded"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              />
              <span className="text-sm">{h.provider.displayName}</span>
            </div>
            <span className="text-xs text-muted-foreground">{h.latencyMs}ms</span>
          </div>
        ))}
        {latest.length === 0 && (
          <p className="text-sm text-muted-foreground">No health data yet.</p>
        )}
      </div>
    </div>
  );
}
