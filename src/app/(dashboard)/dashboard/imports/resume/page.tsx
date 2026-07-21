import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDefaultWorkspace } from "@/lib/workspace";
import { listImportSessions, getImportSessionWithItems } from "@/features/imports/queries";
import { ResumeUploader } from "@/features/imports/components/resume-uploader";
import { ImportReview } from "@/features/imports/components/import-review";

export const dynamic = "force-dynamic";

export default async function ResumeImportPage() {
  const workspace = await getDefaultWorkspace();

  const sessions = await listImportSessions(workspace.id, "RESUME");
  const openSession = sessions.find((s: { status: string }) => s.status === "REVIEWING");
  const openSessionWithItems = openSession
    ? await getImportSessionWithItems(openSession.id, workspace.id)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Import from resume</h1>

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
            <CardTitle className="text-base">Upload resume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResumeUploader />
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
              {sessions.map((s: { id: string; createdAt: Date; status: string; error: string | null }) => (
                <li key={s.id}>
                  {s.createdAt.toLocaleString()} — {s.status.toLowerCase()}
                  {s.status === "FAILED" && s.error ? `: ${s.error}` : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
