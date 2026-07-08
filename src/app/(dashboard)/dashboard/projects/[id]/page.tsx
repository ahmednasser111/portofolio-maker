import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { listProjectCategories } from "@/features/project-categories/queries";
import { getProjectForEdit } from "@/features/projects/queries";
import { ProjectForm } from "@/features/projects/components/project-form";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getDefaultWorkspace();
  const [project, categories] = await Promise.all([
    getProjectForEdit(workspace.id, id),
    listProjectCategories(workspace.id),
  ]);

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Edit project</h1>
      <Card>
        <CardContent className="pt-6">
          <ProjectForm project={project} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
