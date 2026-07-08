import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listEducationForDashboard } from "@/features/education/queries";
import { EducationManager } from "@/features/education/components/education-manager";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardEducationPage() {
  const workspace = await getDefaultWorkspace();
  const education = await listEducationForDashboard(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Education</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Education history</CardTitle>
        </CardHeader>
        <CardContent>
          <EducationManager education={education} />
        </CardContent>
      </Card>
    </div>
  );
}
