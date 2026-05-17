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
import { CapabilitySelector } from "@/components/capability-selector";
import {
  createProvider,
  updateProvider,
  deleteProvider,
  createModel,
  updateModel,
  deleteModel,
} from "@/actions/providers";
import {
  SUPPORTED_PROVIDERS,
  getProviderInfo,
  inferCapabilities,
} from "@/lib/openrouter";
import type { OpenRouterModel } from "@/lib/openrouter";

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

export function ProvidersClient({
  providers,
  orModels,
}: {
  providers: Provider[];
  orModels: OpenRouterModel[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [isAddModelOpen, setIsAddModelOpen] = useState<string | null>(null);
  const [editProviderId, setEditProviderId] = useState<string | null>(null);
  const [editModelId, setEditModelId] = useState<string | null>(null);
  const [orSelectedMap, setOrSelectedMap] = useState<Record<string, string>>({});

  function getOrModelsForProvider(providerName: string) {
    const prefix = `${providerName.toLowerCase()}/`;
    return orModels.filter((m) => m.id.toLowerCase().startsWith(prefix));
  }

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

  async function handleEditProvider(formData: FormData) {
    if (!editProviderId) return;
    await updateProvider(editProviderId, {
      displayName: formData.get("displayName") as string,
      baseUrl: (formData.get("baseUrl") as string) || undefined,
      apiKey: (formData.get("apiKey") as string) || undefined,
      timeoutMs: Number(formData.get("timeoutMs") || 30000),
      retries: Number(formData.get("retries") || 3),
      weight: Number(formData.get("weight") || 1),
    });
    setEditProviderId(null);
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
      capabilities: (formData.getAll("capabilities") as string[]).filter(Boolean),
      supportsStreaming: formData.get("supportsStreaming") === "on",
      supportsToolUse: formData.get("supportsToolUse") === "on",
      promptPricePer1k: Number(formData.get("promptPricePer1k") || 0),
      completionPricePer1k: Number(formData.get("completionPricePer1k") || 0),
      latencyTtftMs: Number(formData.get("latencyTtftMs") || 500),
    });
    setIsAddModelOpen(null);
  }

  async function handleEditModel(formData: FormData) {
    if (!editModelId) return;
    await updateModel(editModelId, {
      name: formData.get("name") as string,
      contextWindow: Number(formData.get("contextWindow")),
      maxTokens: Number(formData.get("maxTokens")) || undefined,
      capabilities: (formData.getAll("capabilities") as string[]).filter(Boolean),
      supportsStreaming: formData.get("supportsStreaming") === "on",
      supportsToolUse: formData.get("supportsToolUse") === "on",
      promptPricePer1k: Number(formData.get("promptPricePer1k") || 0),
      completionPricePer1k: Number(formData.get("completionPricePer1k") || 0),
      latencyTtftMs: Number(formData.get("latencyTtftMs") || 500),
    });
    setEditModelId(null);
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
                <Label htmlFor="name">Provider</Label>
                <select
                  id="name"
                  name="name"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  onChange={(e) => {
                    const info = getProviderInfo(e.target.value);
                    const displayInput = document.getElementById("displayName") as HTMLInputElement | null;
                    const baseUrlInput = document.getElementById("baseUrl") as HTMLInputElement | null;
                    if (info) {
                      if (displayInput) displayInput.value = info.displayName;
                      if (baseUrlInput) baseUrlInput.value = info.baseUrl;
                    }
                  }}
                >
                  <option value="">Select provider...</option>
                  {SUPPORTED_PROVIDERS.map((p) => (
                    <option key={p.name} value={p.name}>{p.displayName}</option>
                  ))}
                  <option value="custom">Other / Custom</option>
                </select>
                <p className="text-xs text-muted-foreground">Pick a provider to auto-fill settings.</p>
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
                  onClick={() => setEditProviderId(provider.id)}
                >
                  Edit
                </Button>
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
                      {(() => {
                        const providerModels = getOrModelsForProvider(provider.name);
                        const selectedModel = providerModels.find(
                          (m) => m.id === orSelectedMap[provider.id]
                        );
                        const defaults = selectedModel
                          ? {
                              externalId: selectedModel.id.split("/").pop() || selectedModel.id,
                              name: selectedModel.name || selectedModel.id,
                              contextWindow: selectedModel.context_length || 128000,
                              maxTokens: selectedModel.top_provider?.max_completion_tokens || undefined,
                              capabilities: inferCapabilities(selectedModel),
                              promptPricePer1k: Number(selectedModel.pricing?.prompt || 0) * 1000,
                              completionPricePer1k: Number(selectedModel.pricing?.completion || 0) * 1000,
                              latencyTtftMs: 500,
                              supportsStreaming: true,
                              supportsToolUse: true,
                            }
                          : {
                              externalId: "",
                              name: "",
                              contextWindow: 128000,
                              maxTokens: undefined,
                              capabilities: ["chat", "streaming"],
                              promptPricePer1k: 0,
                              completionPricePer1k: 0,
                              latencyTtftMs: 500,
                              supportsStreaming: true,
                              supportsToolUse: false,
                            };
                        return (
                          <>
                            {providerModels.length > 0 && (
                              <div className="mb-4">
                                <select
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  value={orSelectedMap[provider.id] || ""}
                                  onChange={(e) => {
                                    setOrSelectedMap((prev) => ({ ...prev, [provider.id]: e.target.value }));
                                  }}
                                >
                                  <option value="">Select a model to auto-fill...</option>
                                  {providerModels.map((m: OpenRouterModel) => (
                                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                                  ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">{providerModels.length} models available from OpenRouter</p>
                              </div>
                            )}
                            <form
                              key={orSelectedMap[provider.id] || "empty"}
                              action={async (formData) => {
                                await handleAddModel(provider.id, formData);
                                setOrSelectedMap((prev) => {
                                  const copy = { ...prev };
                                  delete copy[provider.id];
                                  return copy;
                                });
                              }}
                              className="space-y-4"
                            >
                              <div className="space-y-2">
                                <Label htmlFor={`externalId-${provider.id}`}>Model ID</Label>
                                <Input
                                  id={`externalId-${provider.id}`}
                                  name="externalId"
                                  placeholder="gpt-4o"
                                  defaultValue={defaults.externalId}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`modelName-${provider.id}`}>Display Name</Label>
                                <Input
                                  id={`modelName-${provider.id}`}
                                  name="name"
                                  placeholder="GPT-4o"
                                  defaultValue={defaults.name}
                                  required
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`contextWindow-${provider.id}`}>Context Window</Label>
                                  <Input
                                    id={`contextWindow-${provider.id}`}
                                    name="contextWindow"
                                    type="number"
                                    defaultValue={defaults.contextWindow}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`maxTokens-${provider.id}`}>Max Tokens</Label>
                                  <Input
                                    id={`maxTokens-${provider.id}`}
                                    name="maxTokens"
                                    type="number"
                                    defaultValue={defaults.maxTokens ?? ""}
                                  />
                                </div>
                              </div>
                              <CapabilitySelector
                                name="capabilities"
                                defaultValue={defaults.capabilities}
                              />
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`promptPrice-${provider.id}`}>Prompt $/1K</Label>
                                  <Input
                                    id={`promptPrice-${provider.id}`}
                                    name="promptPricePer1k"
                                    type="number"
                                    step="0.0001"
                                    defaultValue={defaults.promptPricePer1k}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`completionPrice-${provider.id}`}>Completion $/1K</Label>
                                  <Input
                                    id={`completionPrice-${provider.id}`}
                                    name="completionPricePer1k"
                                    type="number"
                                    step="0.0001"
                                    defaultValue={defaults.completionPricePer1k}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`latency-${provider.id}`}>Latency TTFT (ms)</Label>
                                <Input
                                  id={`latency-${provider.id}`}
                                  name="latencyTtftMs"
                                  type="number"
                                  defaultValue={defaults.latencyTtftMs}
                                />
                              </div>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    name="supportsStreaming"
                                    defaultChecked={defaults.supportsStreaming}
                                  />
                                  Streaming
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    name="supportsToolUse"
                                    defaultChecked={defaults.supportsToolUse}
                                  />
                                  Tool Use
                                </label>
                              </div>
                              <DialogFooter>
                                <Button type="submit">Add Model</Button>
                              </DialogFooter>
                            </form>
                          </>
                        );
                      })()}
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
                                onClick={() => setEditModelId(model.id)}
                              >
                                Edit
                              </Button>
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

      {/* Edit Provider Dialog */}
      {(() => {
        const provider = providers.find((p) => p.id === editProviderId);
        if (!provider) return null;
        return (
          <Dialog open={!!editProviderId} onOpenChange={(v) => !v && setEditProviderId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Provider</DialogTitle>
                <DialogDescription>Update {provider.displayName} settings.</DialogDescription>
              </DialogHeader>
              <form
                action={async (formData) => {
                  await handleEditProvider(formData);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="edit-displayName">Display Name</Label>
                  <Input id="edit-displayName" name="displayName" defaultValue={provider.displayName} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-baseUrl">Base URL</Label>
                  <Input id="edit-baseUrl" name="baseUrl" defaultValue={provider.baseUrl ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-apiKey">API Key</Label>
                  <Input id="edit-apiKey" name="apiKey" type="password" placeholder="Leave blank to keep current" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-timeoutMs">Timeout (ms)</Label>
                    <Input id="edit-timeoutMs" name="timeoutMs" type="number" defaultValue={provider.timeoutMs} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-retries">Retries</Label>
                    <Input id="edit-retries" name="retries" type="number" defaultValue={provider.retries} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-weight">Weight</Label>
                    <Input id="edit-weight" name="weight" type="number" defaultValue={provider.weight} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Save Provider</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Edit Model Dialog */}
      {(() => {
        let model: Model | null = null;
        for (const p of providers) {
          const found = p.models.find((m) => m.id === editModelId);
          if (found) { model = found; break; }
        }
        if (!model) return null;
        return (
          <Dialog open={!!editModelId} onOpenChange={(v) => !v && setEditModelId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Model</DialogTitle>
                <DialogDescription>Update {model.name} settings.</DialogDescription>
              </DialogHeader>
              <form
                action={async (formData) => {
                  await handleEditModel(formData);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="edit-model-name">Display Name</Label>
                  <Input id="edit-model-name" name="name" defaultValue={model.name} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-model-contextWindow">Context Window</Label>
                    <Input id="edit-model-contextWindow" name="contextWindow" type="number" defaultValue={model.contextWindow} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-model-maxTokens">Max Tokens</Label>
                    <Input id="edit-model-maxTokens" name="maxTokens" type="number" defaultValue={model.maxTokens ?? ""} />
                  </div>
                </div>
                <CapabilitySelector
                  name="capabilities"
                  defaultValue={model.capabilities}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-model-promptPrice">Prompt $/1K</Label>
                    <Input id="edit-model-promptPrice" name="promptPricePer1k" type="number" step="0.0001" defaultValue={model.promptPricePer1k} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-model-completionPrice">Completion $/1K</Label>
                    <Input id="edit-model-completionPrice" name="completionPricePer1k" type="number" step="0.0001" defaultValue={model.completionPricePer1k} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-model-latency">Latency TTFT (ms)</Label>
                  <Input id="edit-model-latency" name="latencyTtftMs" type="number" defaultValue={model.latencyTtftMs} />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="supportsStreaming" defaultChecked={model.supportsStreaming} />
                    Streaming
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="supportsToolUse" defaultChecked={model.supportsToolUse} />
                    Tool Use
                  </label>
                </div>
                <DialogFooter>
                  <Button type="submit">Save Model</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
