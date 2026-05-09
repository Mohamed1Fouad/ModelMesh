"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createInvitation,
  updateMemberRole,
  removeMember,
  updateTeam,
} from "@/actions/teams";

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  enabled: boolean;
  members: {
    id: string;
    role: string;
    user: { id: string; email: string; name: string | null; avatar: string | null };
  }[];
  providers: {
    id: string;
    enabled: boolean;
    customBaseUrl: string | null;
    provider: { id: string; name: string; displayName: string };
  }[];
  budgets: { id: string; name: string; limit: number; currentSpend: number }[];
  invitations: { id: string; email: string; role: string; expiresAt: Date }[];
}

export function TeamDetailClient({ team }: { team: Team }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("developer");
  const router = useRouter();

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    await createInvitation(team.id, { email, role });
    setInviteOpen(false);
    setEmail("");
    setRole("developer");
    router.refresh();
  }

  async function handleToggleEnabled() {
    await updateTeam(team.id, { enabled: !team.enabled });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleToggleEnabled}>
          {team.enabled ? "Disable Team" : "Enable Team"}
        </Button>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>Invite Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="developer">Developer</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <Button type="submit">Send Invitation</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-medium">Members</h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">User</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {team.members.map((member) => (
                <tr key={member.id} className="hover:bg-accent/30">
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{member.user.name ?? member.user.email}</span>
                      <span className="text-muted-foreground">{member.user.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {member.role !== "owner" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const newRole = member.role === "developer" ? "viewer" : "developer";
                              await updateMemberRole(member.id, newRole);
                              router.refresh();
                            }}
                          >
                            Toggle Role
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (confirm("Remove this member?")) {
                                await removeMember(member.id);
                                router.refresh();
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {team.invitations.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-medium">Pending Invitations</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Email</th>
                  <th className="px-4 py-2 text-left font-medium">Role</th>
                  <th className="px-4 py-2 text-left font-medium">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {team.invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2">{inv.email}</td>
                    <td className="px-4 py-2">
                      <Badge variant="muted">{inv.role}</Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-lg font-medium">Team Providers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {team.providers.map((tp) => (
            <div key={tp.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{tp.provider.displayName}</h4>
                  <p className="text-sm text-muted-foreground">{tp.provider.name}</p>
                </div>
                <Badge variant={tp.enabled ? "default" : "secondary"}>
                  {tp.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              {tp.customBaseUrl && (
                <p className="mt-2 text-sm text-muted-foreground">URL: {tp.customBaseUrl}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
