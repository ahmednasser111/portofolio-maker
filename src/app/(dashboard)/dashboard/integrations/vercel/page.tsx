import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDefaultWorkspace } from "@/lib/workspace";
import { listConnections, listLinkableProjects } from "@/features/integrations/queries";
import { VercelLinker } from "@/features/integrations/components/vercel-linker";

export const dynamic = "force-dynamic";

export default async function VercelLinkingPage() {
  const workspace = await getDefaultWorkspace();
  const connections = await listConnections(workspace.id);
  const vercelConnection = connections.find((c: { provider: string }) => c.provider === "VERCEL");

  if (!vercelConnection) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold">Link a Vercel project</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Connect a Vercel account first on the{" "}
              <Link href="/dashboard/integrations" className="underline">
                Integrations
              </Link>{" "}
              page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const projects = await listLinkableProjects(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Link a Vercel project</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attach a production URL</CardTitle>
        </CardHeader>
        <CardContent>
          <VercelLinker projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
