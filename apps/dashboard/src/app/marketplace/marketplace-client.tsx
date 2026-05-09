"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMarketplacePreset, deleteMarketplacePreset } from "@/actions/marketplace";

interface Preset {
  id: string;
  name: string;
  description: string | null;
  category: string;
  providerName: string;
  modelId: string;
  capabilities: string[];
  contextWindow: number;
  pricingPrompt: number;
  pricingCompletion: number;
  tags: string[];
  downloads: number;
  rating: number;
  config: unknown;
}

export function MarketplaceClient({ presets }: { presets: Preset[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const categories = Array.from(new Set(presets.map((p) => p.category)));

  const filtered = presets.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !category || p.category === category;
    return matchesSearch && matchesCategory;
  });

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    await createMarketplacePreset({
      name: String(fd.get("name")),
      description: String(fd.get("description")),
      category: String(fd.get("category")),
      providerName: String(fd.get("providerName")),
      modelId: String(fd.get("modelId")),
      capabilities: String(fd.get("capabilities")).split(",").map((s) => s.trim()).filter(Boolean),
      contextWindow: Number(fd.get("contextWindow")),
      pricingPrompt: Number(fd.get("pricingPrompt")),
      pricingCompletion: Number(fd.get("pricingCompletion")),
      tags: String(fd.get("tags")).split(",").map((s) => s.trim()).filter(Boolean),
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search presets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          {categories.map((c) => (
            <Button
              key={c}
              variant={category === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(category === c ? null : c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Preset</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Marketplace Preset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" defaultValue="general" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="providerName">Provider Name</Label>
                  <Input id="providerName" name="providerName" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelId">Model ID</Label>
                <Input id="modelId" name="modelId" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contextWindow">Context</Label>
                  <Input id="contextWindow" name="contextWindow" type="number" defaultValue={4096} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricingPrompt">Prompt $/1k</Label>
                  <Input id="pricingPrompt" name="pricingPrompt" type="number" step="0.0001" defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricingCompletion">Completion $/1k</Label>
                  <Input id="pricingCompletion" name="pricingCompletion" type="number" step="0.0001" defaultValue={0} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capabilities">Capabilities (comma separated)</Label>
                <Input id="capabilities" name="capabilities" defaultValue="chat, streaming" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input id="tags" name="tags" />
              </div>
              <Button type="submit">Create Preset</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((preset) => (
          <div
            key={preset.id}
            className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{preset.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {preset.providerName}/{preset.modelId}
                </p>
              </div>
              <Badge variant="muted">{preset.category}</Badge>
            </div>
            {preset.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{preset.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {preset.capabilities.slice(0, 4).map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Context: {preset.contextWindow.toLocaleString()} tokens
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline" size="sm">
                Install
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (confirm("Delete this preset?")) {
                    await deleteMarketplacePreset(preset.id);
                    router.refresh();
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
