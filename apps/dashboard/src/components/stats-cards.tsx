interface StatsCardsProps {
  providers: number;
  models: number;
  requests: number;
  cost: number;
  tokens: number;
  latency: number;
}

export function StatsCards({ providers, models, requests, cost, tokens, latency }: StatsCardsProps) {
  const stats = [
    { label: "Providers", value: providers },
    { label: "Models", value: models },
    { label: "Requests (7d)", value: requests.toLocaleString() },
    { label: "Tokens (7d)", value: tokens.toLocaleString() },
    { label: "Cost (7d)", value: `$${cost.toFixed(4)}` },
    { label: "Avg Latency", value: `${latency}ms` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{s.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
