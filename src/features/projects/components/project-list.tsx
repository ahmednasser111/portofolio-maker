"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  archiveProjectAction,
  deleteProjectAction,
  moveProjectAction,
  publishProjectAction,
  setProjectFeaturedAction,
  unpublishProjectAction,
} from "../actions";
import type { Project, ProjectCategory } from "@prisma/client";

type ProjectRow = Project & { category: ProjectCategory | null };

const statusLabels: Record<Project["status"], string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(promise: Promise<unknown>) {
    startTransition(async () => {
      await promise;
      router.refresh();
    });
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No projects yet. Create your first one to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {projects.map((project, index) => (
        <li key={project.id} className="rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                {project.title}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({statusLabels[project.status]}
                  {project.featured ? " · Featured" : ""}
                  {project.category ? ` · ${project.category.name}` : ""})
                </span>
              </p>
              <p className="text-xs text-muted-foreground">/{project.slug}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending || index === 0}
                onClick={() => run(moveProjectAction({ id: project.id, direction: "up" }))}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending || index === projects.length - 1}
                onClick={() => run(moveProjectAction({ id: project.id, direction: "down" }))}
              >
                ↓
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/projects/${project.id}`}>Edit</Link>
              </Button>
              {project.status !== "PUBLISHED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(publishProjectAction({ id: project.id }))}
                >
                  Publish
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(unpublishProjectAction({ id: project.id }))}
                >
                  Unpublish
                </Button>
              )}
              {project.status !== "ARCHIVED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(archiveProjectAction({ id: project.id }))}
                >
                  Archive
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(setProjectFeaturedAction({ id: project.id, featured: !project.featured }))
                }
              >
                {project.featured ? "Unfeature" : "Feature"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(`Delete project "${project.title}"?`)) return;
                  run(deleteProjectAction({ id: project.id }));
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
