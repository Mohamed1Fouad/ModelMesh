"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeam, deleteTeam } from "@/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  enabled: boolean;
  createdAt: Date;
  members: {
    id: string;
    role: string;
    user: { id: string; email: string; name: string | null; avatar: string | null };
  }[];
  providers: { id: string; provider: { name: string; displayName: string } }[];
  budgets: { id: string; name: string; limit: number; currentSpend: number }[];
}

export function TeamsClient({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createTeam({ name, slug, description });
    setOpen(false);
    setName("");
    setSlug("");
    setDescription("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Create Team</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <Button type="submit">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{team.name}</h3>
                <p className="text-sm text-muted-foreground">@{team.slug}</p>
              </div>
              <Badge variant={team.enabled ? "default" : "secondary"}>
                {team.enabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            {team.description && (
              <p className="mt-2 text-sm text-muted-foreground">{team.description}</p>
            )}
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span>{team.members.length} members</span>
              <span>{team.providers.length} providers</span>
              <span>{team.budgets.length} budgets</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push(`/teams/${team.id}`)}>
                Manage
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (confirm("Delete this team?")) {
                    await deleteTeam(team.id);
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
