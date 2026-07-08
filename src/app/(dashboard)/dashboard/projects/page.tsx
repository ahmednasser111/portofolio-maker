import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listProjectCategories } from "@/features/project-categories/queries";
import { ProjectCategoryManager } from "@/features/project-categories/components/category-manager";
import { listProjectsForDashboard } from "@/features/projects/queries";
import { ProjectList } from "@/features/projects/components/project-list";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardProjectsPage() {
  const workspace = await getDefaultWorkspace();
  const [projects, categories] = await Promise.all([
    listProjectsForDashboard(workspace.id),
    listProjectCategories(workspace.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Button asChild>
          <Link href="/dashboard/projects/new">New project</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectCategoryManager categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All projects</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectList projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
