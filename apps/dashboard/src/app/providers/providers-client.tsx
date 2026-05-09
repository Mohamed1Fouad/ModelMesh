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
import {
  createProvider,
  updateProvider,
  deleteProvider,
  createModel,
  updateModel,
  deleteModel,
} from "@/actions/providers";

interface Provider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  baseUrl: string | null;
  apiKey: string | null;
  timeoutMs: number;
  retries: number;
  weight: number;
  models: Model[];
}

interface Model {
  id: string;
  externalId: string;
  name: string;
  enabled: boolean;
  contextWindow: number;
  maxTokens: number | null;
  capabilities: string[];
  supportsStreaming: boolean;
  supportsToolUse: boolean;
  promptPricePer1k: number;
  completionPricePer1k: number;
  latencyTtftMs: number;
}

export function ProvidersClient({ providers }: { providers: Provider[] }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [isAddModelOpen, setIsAddModelOpen] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    await createProvider({
      name: formData.get("name") as string,
      displayName: formData.get("displayName") as string,
      baseUrl: (formData.get("baseUrl") as string) || undefined,
      apiKey: (formData.get("apiKey") as string) || undefined,
      timeoutMs: Number(formData.get("timeoutMs") || 30000),
      retries: Number(formData.get("retries") || 3),
      weight: Number(formData.get("weight") || 1),
    });
    setIsCreateOpen(false);
  }

  async function handleToggleProvider(id: string, enabled: boolean) {
    await updateProvider(id, { enabled });
  }

  async function handleDeleteProvider(id: string) {
    if (!confirm("Delete this provider and all its models?")) return;
    await deleteProvider(id);
  }

  async function handleAddModel(providerId: string, formData: FormData) {
    await createModel({
      providerId,
      externalId: formData.get("externalId") as string,
      name: formData.get("name") as string,
      contextWindow: Number(formData.get("contextWindow")),
      maxTokens: Number(formData.get("maxTokens")) || undefined,
      capabilities: (formData.get("capabilities") as string).split(",").map((c) => c.trim()),
      supportsStreaming: formData.get("supportsStreaming") === "on",
      supportsToolUse: formData.get("supportsToolUse") === "on",
      promptPricePer1k: Number(formData.get("promptPricePer1k") || 0),
      completionPricePer1k: Number(formData.get("completionPricePer1k") || 0),
      latencyTtftMs: Number(formData.get("latencyTtftMs") || 500),
    });
    setIsAddModelOpen(null);
  }

  async function handleToggleModel(id: string, enabled: boolean) {
    await updateModel(id, { enabled });
  }

  async function handleDeleteModel(id: string) {
    if (!confirm("Delete this model?")) return;
    await deleteModel(id);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Providers</h2>
          <p className="text-muted-foreground">Manage AI providers and their models.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>Add Provider</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Provider</DialogTitle>
              <DialogDescription>Configure a new AI provider.</DialogDescription>
            </DialogHeader>
            <form
              action={async (formData) => {
                await handleCreate(formData);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">System Name</Label>
                <Input id="name" name="name" placeholder="openai" required />
                <p className="text-xs text-muted-foreground">Unique identifier, lowercase.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" name="displayName" placeholder="OpenAI" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input id="baseUrl" name="baseUrl" placeholder="https://api.openai.com/v1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input id="apiKey" name="apiKey" type="password" placeholder="sk-..." />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeoutMs">Timeout (ms)</Label>
                  <Input id="timeoutMs" name="timeoutMs" type="number" defaultValue={30000} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retries">Retries</Label>
                  <Input id="retries" name="retries" type="number" defaultValue={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight</Label>
                  <Input id="weight" name="weight" type="number" defaultValue={1} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Provider</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.id} className="rounded-xl border border-border bg-card">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="font-semibold">{provider.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {provider.baseUrl || "Default endpoint"} · {provider.models.length} models
                  </span>
                </div>
                <Badge variant={provider.enabled ? "success" : "muted"}>
                  {provider.enabled ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleProvider(provider.id, !provider.enabled)}
                >
                  {provider.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedProvider(expandedProvider === provider.id ? null : provider.id)}
                >
                  {expandedProvider === provider.id ? "Collapse" : "Expand"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleDeleteProvider(provider.id)}
                >
                  Delete
                </Button>
              </div>
            </div>

            {expandedProvider === provider.id && (
              <div className="border-t border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Models</h3>
                  <Dialog
                    open={isAddModelOpen === provider.id}
                    onOpenChange={(v) => setIsAddModelOpen(v ? provider.id : null)}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm">Add Model</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Model</DialogTitle>
                        <DialogDescription>Add a model to {provider.displayName}.</DialogDescription>
                      </DialogHeader>
                      <form
                        action={async (formData) => {
                          await handleAddModel(provider.id, formData);
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`externalId-${provider.id}`}>Model ID</Label>
                          <Input id={`externalId-${provider.id}`} name="externalId" placeholder="gpt-4o" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`modelName-${provider.id}`}>Display Name</Label>
                          <Input id={`modelName-${provider.id}`} name="name" placeholder="GPT-4o" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`contextWindow-${provider.id}`}>Context Window</Label>
                            <Input id={`contextWindow-${provider.id}`} name="contextWindow" type="number" defaultValue={128000} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`maxTokens-${provider.id}`}>Max Tokens</Label>
                            <Input id={`maxTokens-${provider.id}`} name="maxTokens" type="number" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`capabilities-${provider.id}`}>Capabilities (comma separated)</Label>
                          <Input id={`capabilities-${provider.id}`} name="capabilities" placeholder="chat, streaming, vision" defaultValue="chat, streaming" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`promptPrice-${provider.id}`}>Prompt $/1K</Label>
                            <Input id={`promptPrice-${provider.id}`} name="promptPricePer1k" type="number" step="0.0001" defaultValue={0} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`completionPrice-${provider.id}`}>Completion $/1K</Label>
                            <Input id={`completionPrice-${provider.id}`} name="completionPricePer1k" type="number" step="0.0001" defaultValue={0} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`latency-${provider.id}`}>Latency TTFT (ms)</Label>
                          <Input id={`latency-${provider.id}`} name="latencyTtftMs" type="number" defaultValue={500} />
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="supportsStreaming" defaultChecked />
                            Streaming
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="supportsToolUse" />
                            Tool Use
                          </label>
                        </div>
                        <DialogFooter>
                          <Button type="submit">Add Model</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Model</th>
                        <th className="px-4 py-2 text-left font-medium">Context</th>
                        <th className="px-4 py-2 text-left font-medium">Price ($/1K)</th>
                        <th className="px-4 py-2 text-left font-medium">Capabilities</th>
                        <th className="px-4 py-2 text-left font-medium">Status</th>
                        <th className="px-4 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {provider.models.map((model) => (
                        <tr key={model.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{model.name}</div>
                            <div className="text-xs text-muted-foreground">{model.externalId}</div>
                          </td>
                          <td className="px-4 py-3">
                            {model.contextWindow.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs">
                              Prompt: ${model.promptPricePer1k.toFixed(4)}
                              <br />
                              Completion: ${model.completionPricePer1k.toFixed(4)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {model.capabilities.map((cap) => (
                                <Badge key={cap} variant="muted">
                                  {cap}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={model.enabled ? "success" : "muted"}>
                              {model.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleModel(model.id, !model.enabled)}
                              >
                                {model.enabled ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => handleDeleteModel(model.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {provider.models.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                            No models configured. Add your first model.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
        {providers.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No providers configured yet.</p>
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>Add Provider</Button>
          </div>
        )}
      </div>
    </div>
  );
}
