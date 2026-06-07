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
  createRoutingRule,
  deleteRoutingRule,
  toggleRoutingRule,
} from "@/actions/routing-rules";

interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  createdAt: Date;
}

const CONDITION_TYPES = [
  { value: "task_type", label: "Task Type", fields: [{ name: "taskType", label: "Task Type", type: "select", options: ["chat", "coding", "reasoning", "summarization", "translation", "classification", "embedding", "image_analysis", "agent_orchestration"] }] },
  { value: "model_capability", label: "Model Capability", fields: [{ name: "capability", label: "Capability", type: "select", options: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal", "embeddings"] }] },
  { value: "max_price", label: "Max Price", fields: [{ name: "pricePer1k", label: "Max $/1K tokens", type: "number" }] },
  { value: "max_latency", label: "Max Latency", fields: [{ name: "latencyMs", label: "Max Latency (ms)", type: "number" }] },
  { value: "privacy_required", label: "Privacy Required", fields: [{ name: "required", label: "Privacy Required", type: "checkbox" }] },
  { value: "provider", label: "Provider", fields: [{ name: "provider", label: "Provider", type: "select", options: ["openai", "anthropic", "ollama", "gemini", "groq", "deepseek", "mistral"] }] },
  { value: "context_size", label: "Context Size", fields: [{ name: "maxTokens", label: "Max Tokens", type: "number" }] },
];

const ACTION_TYPES = [
  { value: "route_to", label: "Route To", fields: [{ name: "provider", label: "Provider", type: "select", options: ["openai", "anthropic", "ollama", "gemini", "groq", "deepseek", "mistral"] }, { name: "model", label: "Model (optional)", type: "text" }] },
  { value: "prefer_local", label: "Prefer Local", fields: [] },
  { value: "score_boost", label: "Score Boost", fields: [{ name: "provider", label: "Provider", type: "select", options: ["openai", "anthropic", "ollama", "gemini", "groq", "deepseek", "mistral"] }, { name: "boost", label: "Boost Amount", type: "number" }] },
  { value: "reject", label: "Reject", fields: [{ name: "reason", label: "Reason", type: "text" }] },
];

export function RoutingClient({
  rules,
  models,
}: {
  rules: RoutingRule[];
  models: { externalId: string; name: string; provider: { name: string } }[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [conditionType, setConditionType] = useState("task_type");
  const [actionType, setActionType] = useState("route_to");
  const [actionProvider, setActionProvider] = useState("openai");

  async function handleCreate(formData: FormData) {
    const condition: Record<string, unknown> = { type: conditionType };
    const action: Record<string, unknown> = { type: actionType };

    const condDef = CONDITION_TYPES.find((c) => c.value === conditionType);
    condDef?.fields.forEach((f) => {
      if (f.type === "number") condition[f.name] = Number(formData.get(`cond_${f.name}`));
      else if (f.type === "checkbox") condition[f.name] = formData.get(`cond_${f.name}`) === "on";
      else condition[f.name] = formData.get(`cond_${f.name}`);
    });

    const actDef = ACTION_TYPES.find((a) => a.value === actionType);
    actDef?.fields.forEach((f) => {
      if (f.type === "number") action[f.name] = Number(formData.get(`act_${f.name}`));
      else action[f.name] = formData.get(`act_${f.name}`);
    });

    await createRoutingRule({
      name: formData.get("name") as string,
      priority: Number(formData.get("priority")),
      condition,
      action,
    });
    setIsCreateOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this rule?")) return;
    await deleteRoutingRule(id);
  }

  async function handleToggle(id: string, enabled: boolean) {
    await toggleRoutingRule(id, enabled);
  }

  function formatCondition(condition: Record<string, unknown>): string {
    switch (condition.type) {
      case "task_type":
        return `Task is "${condition.taskType}"`;
      case "model_capability":
        return `Needs "${condition.capability}"`;
      case "max_price":
        return `Max price $${condition.pricePer1k}/1K tokens`;
      case "max_latency":
        return `Max latency ${condition.latencyMs}ms`;
      case "privacy_required":
        return `Privacy ${condition.required ? "required" : "not required"}`;
      case "provider":
        return `Provider is "${condition.provider}"`;
      case "context_size":
        return `Context ≤ ${condition.maxTokens} tokens`;
      default:
        return JSON.stringify(condition);
    }
  }

  function formatAction(action: Record<string, unknown>): string {
    switch (action.type) {
      case "route_to":
        return `Route to ${action.provider}${action.model ? ` (${action.model})` : ""}`;
      case "prefer_local":
        return "Prefer local providers";
      case "score_boost":
        return `Boost ${action.provider} by +${action.boost}`;
      case "reject":
        return `Reject: ${action.reason}`;
      default:
        return JSON.stringify(action);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Routing Rules</h2>
          <p className="text-muted-foreground">Configure how requests are routed across providers.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>Add Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add Routing Rule</DialogTitle>
              <DialogDescription>Define a condition and action for request routing.</DialogDescription>
            </DialogHeader>
            <form
              action={async (formData) => {
                await handleCreate(formData);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="ruleName">Rule Name</Label>
                <Input id="ruleName" name="name" placeholder="e.g., Code tasks to Claude" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input id="priority" name="priority" type="number" defaultValue={100} required />
                <p className="text-xs text-muted-foreground">Higher priority rules are evaluated first.</p>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-4">
                <h4 className="font-medium text-sm">Condition</h4>
                <div className="space-y-2">
                  <Label>Condition Type</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
                    value={conditionType}
                    onChange={(e) => setConditionType(e.target.value)}
                    name="conditionType"
                  >
                    {CONDITION_TYPES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {CONDITION_TYPES.find((c) => c.value === conditionType)?.fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={`cond_${field.name}`}>{field.label}</Label>
                    {"options" in field ? (
                      <select
                        id={`cond_${field.name}`}
                        name={`cond_${field.name}`}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
                      >
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === "checkbox" ? (
                      <label className="flex items-center gap-2">
                        <input id={`cond_${field.name}`} name={`cond_${field.name}`} type="checkbox" className="rounded border-border" />
                        <span className="text-sm">{field.label}</span>
                      </label>
                    ) : (
                      <Input id={`cond_${field.name}`} name={`cond_${field.name}`} type={field.type} />
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border p-4 space-y-4">
                <h4 className="font-medium text-sm">Action</h4>
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    name="actionType"
                  >
                    {ACTION_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                {ACTION_TYPES.find((a) => a.value === actionType)?.fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={`act_${field.name}`}>{field.label}</Label>
                    {field.name === "provider" && actionType === "route_to" ? (
                      <select
                        id={`act_${field.name}`}
                        name={`act_${field.name}`}
                        value={actionProvider}
                        onChange={(e) => setActionProvider(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
                      >
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : "options" in field ? (
                      <select
                        id={`act_${field.name}`}
                        name={`act_${field.name}`}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
                      >
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.name === "model" && actionType === "route_to" ? (
                      <select
                        id={`act_${field.name}`}
                        name={`act_${field.name}`}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
                      >
                        <option value="">Any model</option>
                        {models
                          .filter((m) => m.provider.name === actionProvider)
                          .map((m) => (
                            <option key={m.externalId} value={m.externalId}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <Input id={`act_${field.name}`} name={`act_${field.name}`} type={field.type} />
                    )}
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="submit">Create Rule</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-xl border border-border bg-card p-5 ${!rule.enabled ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{rule.name}</span>
                  <Badge variant={rule.enabled ? "success" : "muted"}>
                    {rule.enabled ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="muted">Priority {rule.priority}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  If {formatCondition(rule.condition)} → {formatAction(rule.action)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(rule.id, !rule.enabled)}
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleDelete(rule.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No routing rules configured.</p>
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>Add Rule</Button>
          </div>
        )}
      </div>
    </div>
  );
}
