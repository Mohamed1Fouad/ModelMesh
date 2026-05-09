"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createApiKey, revokeApiKey } from "@/actions/api-keys";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitRpm: number | null;
  rateLimitTpm: number | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  createdAt: Date;
}

export function ApiKeysClient({ keys }: { keys: ApiKey[] }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<{ rawKey: string; keyPrefix: string } | null>(null);

  async function handleCreate(formData: FormData) {
    const result = await createApiKey({
      name: formData.get("name") as string,
      scopes: (formData.get("scopes") as string).split(",").map((s) => s.trim()),
      rateLimitRpm: Number(formData.get("rateLimitRpm")) || undefined,
      rateLimitTpm: Number(formData.get("rateLimitTpm")) || undefined,
      expiresAt: (formData.get("expiresAt") as string)
        ? new Date(formData.get("expiresAt") as string)
        : undefined,
    });
    setNewKey(result);
    setIsCreateOpen(false);
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await revokeApiKey(id);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">API Keys</h2>
          <p className="text-muted-foreground">Manage API keys for accessing the ModelMesh gateway.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>Create Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>Generate a new API key for gateway access.</DialogDescription>
            </DialogHeader>
            <form
              action={async (formData) => {
                await handleCreate(formData);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="keyName">Name</Label>
                <Input id="keyName" name="name" placeholder="Production App" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scopes">Scopes (comma separated)</Label>
                <Input id="scopes" name="scopes" defaultValue="chat:write, models:read" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rateLimitRpm">Rate Limit (req/min)</Label>
                  <Input id="rateLimitRpm" name="rateLimitRpm" type="number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rateLimitTpm">Rate Limit (tok/min)</Label>
                  <Input id="rateLimitTpm" name="rateLimitTpm" type="number" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires At (optional)</Label>
                <Input id="expiresAt" name="expiresAt" type="datetime-local" />
              </div>
              <DialogFooter>
                <Button type="submit">Create Key</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {newKey && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-3">
          <h3 className="font-semibold text-emerald-400">API Key Created</h3>
          <p className="text-sm text-muted-foreground">
            Copy this key now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="rounded bg-background px-3 py-2 text-sm font-mono">{newKey.rawKey}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(newKey.rawKey)}
            >
              Copy
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Key</th>
              <th className="px-4 py-3 text-left font-medium">Scopes</th>
              <th className="px-4 py-3 text-left font-medium">Usage</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {keys.map((key) => (
              <tr key={key.id}>
                <td className="px-4 py-3 font-medium">{key.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{key.keyPrefix}••••</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="muted">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {key.usageCount.toLocaleString()} uses
                  {key.lastUsedAt && (
                    <div className="text-xs">Last: {new Date(key.lastUsedAt).toLocaleDateString()}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(key.createdAt).toLocaleDateString()}
                  {key.expiresAt && (
                    <div className="text-xs">Exp: {new Date(key.expiresAt).toLocaleDateString()}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleRevoke(key.id)}
                  >
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No API keys. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
