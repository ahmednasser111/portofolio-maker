import Link from "next/link";
import { getDefaultWorkspace } from "@/lib/workspace";
import { listPublishedProjects } from "@/features/projects/queries";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const workspace = await getDefaultWorkspace();
  const projects = await listPublishedProjects(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Projects</h1>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">Nothing published yet.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id} className="rounded-md border p-4">
              <Link href={`/projects/${project.slug}`} className="font-medium hover:underline">
                {project.title}
              </Link>
              {project.category ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {project.category.name}
                </span>
              ) : null}
              {project.summary ? (
                <p className="text-sm text-muted-foreground">{project.summary}</p>
              ) : null}
              {project.tags.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">{project.tags.join(" · ")}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
