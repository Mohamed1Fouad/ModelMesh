import { getProviders } from "@/actions/providers";
import { getOpenRouterModels } from "@/actions/openrouter";
import { ProvidersClient } from "./providers-client";
import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const providers = await getProviders();
  const orModels = await getOpenRouterModels();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
            M
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ModelMesh</h1>
        </div>
        <DashboardNav />
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <ProvidersClient providers={providers} orModels={orModels} />
      </main>
    </div>
  );
}
