import { prisma } from "@modelmesh/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ChatClient } from "./chat-client";
import { getOrCreateDashboardApiKey } from "@/actions/api-keys";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const [models, apiKey] = await Promise.all([
    prisma.model.findMany({
      where: { enabled: true },
      include: { provider: true },
      orderBy: { name: "asc" },
    }),
    getOrCreateDashboardApiKey(),
  ]);

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
            M
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ModelMesh</h1>
        </div>
        <DashboardNav />
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatClient models={models} apiKey={apiKey} />
      </main>
    </div>
  );
}
