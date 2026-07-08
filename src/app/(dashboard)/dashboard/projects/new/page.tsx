import { Card, CardContent } from "@/components/ui/card";
import { listProjectCategories } from "@/features/project-categories/queries";
import { ProjectForm } from "@/features/projects/components/project-form";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const workspace = await getDefaultWorkspace();
  const categories = await listProjectCategories(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">New project</h1>
      <Card>
        <CardContent className="pt-6">
          <ProjectForm project={null} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
