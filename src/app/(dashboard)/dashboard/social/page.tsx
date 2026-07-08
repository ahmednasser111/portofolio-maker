import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSocialLinksForDashboard } from "@/features/social-links/queries";
import { SocialLinkManager } from "@/features/social-links/components/social-link-manager";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardSocialLinksPage() {
  const workspace = await getDefaultWorkspace();
  const links = await listSocialLinksForDashboard(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Social links</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Links</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialLinkManager links={links} />
        </CardContent>
      </Card>
    </div>
  );
}
