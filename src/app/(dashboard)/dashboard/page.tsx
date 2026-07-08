import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getDefaultWorkspace } from "@/lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteTitleForm } from "@/features/settings/components/site-title-form";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const session = await auth();
  const workspace = await getDefaultWorkspace();
  const membership = await db.membership.findUniqueOrThrow({
    where: { userId_workspaceId: { userId: session!.user!.id!, workspaceId: workspace.id } },
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {session?.user?.email} · role {membership.role} · workspace{" "}
          {workspace.slug}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Site settings</CardTitle>
        </CardHeader>
        <CardContent>
          <SiteTitleForm initialSiteTitle={workspace.siteTitle ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
