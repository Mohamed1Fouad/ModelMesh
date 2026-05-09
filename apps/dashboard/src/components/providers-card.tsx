"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Provider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  _count?: { models: number };
}

export function ProvidersCard() {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data) {
          // Extract unique providers from models list
          const providerMap = new Map<string, Provider>();
          data.data.forEach((m: { id: string; owned_by: string }) => {
            const parts = m.id.split("/");
            const name = parts[0] || m.owned_by;
            if (!providerMap.has(name)) {
              providerMap.set(name, {
                id: name,
                name,
                displayName: m.owned_by || name,
                enabled: true,
              });
            }
          });
          setProviders(Array.from(providerMap.values()));
        }
      })
      .catch(() => setProviders([]));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold tracking-tight">Providers</h3>
        <a href="/providers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Manage →</a>
      </div>
      {providers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => (
            <div key={p.id} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.displayName}</span>
                <Badge
                  variant={p.enabled ? "success" : "muted"}
                  className="text-xs"
                >
                  {p.enabled ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.name}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No providers configured yet. Add your first provider to get started.</p>
      )}
    </div>
  );
}
