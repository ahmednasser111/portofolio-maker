import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listExperiencesForDashboard } from "@/features/experience/queries";
import { ExperienceManager } from "@/features/experience/components/experience-manager";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardExperiencePage() {
  const workspace = await getDefaultWorkspace();
  const experiences = await listExperiencesForDashboard(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Experience</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work history</CardTitle>
        </CardHeader>
        <CardContent>
          <ExperienceManager experiences={experiences} />
        </CardContent>
      </Card>
    </div>
  );
}
