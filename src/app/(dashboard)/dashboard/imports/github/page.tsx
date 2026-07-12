import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDefaultWorkspace } from "@/lib/workspace";
import { listConnections } from "@/features/integrations/queries";
import { listImportSessions, getImportSessionWithItems } from "@/features/imports/queries";
import { GithubRepoBrowser } from "@/features/imports/components/github-repo-browser";
import { ImportReview } from "@/features/imports/components/import-review";

export const dynamic = "force-dynamic";

export default async function GithubImportPage() {
  const workspace = await getDefaultWorkspace();
  type Connection = { provider: string; accountMeta?: { username?: string } };
  const connections = (await listConnections(workspace.id)) as Connection[];
  const githubConnection = connections.find((c: Connection) => c.provider === "GITHUB");

  if (!githubConnection) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold">Import from GitHub</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Connect a GitHub account first on the{" "}
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

  const sessions = await listImportSessions(workspace.id, "GITHUB");
  const openSession = sessions.find((s: { id: string; createdAt: Date; status: string }) => s.status === "REVIEWING");
  const openSessionWithItems = openSession
    ? await getImportSessionWithItems(openSession.id, workspace.id)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Import from GitHub</h1>

      {openSessionWithItems ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review import</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportReview
              sessionId={openSessionWithItems.id}
              sessionStatus={openSessionWithItems.status}
              items={openSessionWithItems.items}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Repositories — {githubConnection.accountMeta?.username}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GithubRepoBrowser />
          </CardContent>
        </Card>
      )}

      {sessions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {sessions.map((s: { id: string; createdAt: Date; status: string }) => (
                <li key={s.id}>
                  {s.createdAt.toLocaleString()} — {s.status.toLowerCase()}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
