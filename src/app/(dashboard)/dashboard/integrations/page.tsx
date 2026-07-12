import Link from "next/link";
import { ProviderType } from "@prisma/client";
import { getDefaultWorkspace } from "@/lib/workspace";
import { listConnections } from "@/features/integrations/queries";
import { ConnectionCard } from "@/features/integrations/components/connection-card";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const workspace = await getDefaultWorkspace();
  const connections = await listConnections(workspace.id);
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Integrations</h1>

      <ConnectionCard
        provider={ProviderType.GITHUB}
        label="GitHub"
        description="Import repositories as projects. Read-only access is enough."
        tokenHelp="Personal access token (repo:read scope)"
        connection={byProvider.get(ProviderType.GITHUB) ?? null}
      />
      <p className="text-sm text-muted-foreground">
        Connected?{" "}
        <Link href="/dashboard/imports/github" className="underline">
          Import repositories →
        </Link>
      </p>

      <ConnectionCard
        provider={ProviderType.VERCEL}
        label="Vercel"
        description="Attach a project's live production URL — no import, linking only."
        tokenHelp="Vercel access token"
        connection={byProvider.get(ProviderType.VERCEL) ?? null}
      />
      <p className="text-sm text-muted-foreground">
        Connected?{" "}
        <Link href="/dashboard/integrations/vercel" className="underline">
          Link a project →
        </Link>
      </p>
    </div>
  );
}
