import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureNavigationSeeded, listNavigationItems } from "@/features/navigation/queries";
import { NavigationManager } from "@/features/navigation/components/navigation-manager";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardNavigationPage() {
  const workspace = await getDefaultWorkspace();
  await ensureNavigationSeeded(workspace.id);
  const items = await listNavigationItems(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Navigation</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <NavigationManager items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
