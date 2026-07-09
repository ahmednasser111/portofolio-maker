import Link from "next/link";
import type { Metadata } from "next";
import { getDefaultWorkspace } from "@/lib/workspace";
import { listPublishedProjects } from "@/features/projects/queries";
import { getActiveThemeTokens } from "@/features/theme/queries";
import { requireEnabledPage } from "@/features/navigation/queries";
import { resolveSeoMetadata } from "@/features/seo/queries";
import { toMetadata } from "@/features/seo/to-metadata";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getDefaultWorkspace();
  return toMetadata(await resolveSeoMetadata(workspace.id, "PROJECTS"));
}

export default async function ProjectsPage() {
  const workspace = await getDefaultWorkspace();
  await requireEnabledPage(workspace.id, "PROJECTS");
  const [projects, tokens] = await Promise.all([
    listPublishedProjects(workspace.id),
    getActiveThemeTokens(workspace.id),
  ]);
  const isGrid = tokens.layout.projects === "grid";

  return (
    <div className={cn("mx-auto space-y-6 p-8", isGrid ? "max-w-4xl" : "max-w-2xl")}>
      <h1 className="text-2xl font-semibold">Projects</h1>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">Nothing published yet.</p>
      ) : (
        <ul className={cn(isGrid ? "grid gap-4 sm:grid-cols-2" : "space-y-3")}>
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
