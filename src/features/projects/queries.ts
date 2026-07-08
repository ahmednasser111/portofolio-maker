import { db } from "@/lib/db";

export function listProjectsForDashboard(workspaceId: string) {
  return db.project.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: { category: true, links: { orderBy: { sortOrder: "asc" } } },
  });
}

export function getProjectForEdit(workspaceId: string, id: string) {
  return db.project.findFirst({
    where: { id, workspaceId, deletedAt: null },
    include: { links: { orderBy: { sortOrder: "asc" } } },
  });
}

export function listPublishedProjects(workspaceId: string) {
  return db.project.findMany({
    where: { workspaceId, deletedAt: null, status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    include: { category: true },
  });
}

export function listFeaturedProjects(workspaceId: string, take = 3) {
  return db.project.findMany({
    where: { workspaceId, deletedAt: null, status: "PUBLISHED", featured: true },
    orderBy: { sortOrder: "asc" },
    take,
  });
}

export function getPublishedProjectBySlug(workspaceId: string, slug: string) {
  return db.project.findFirst({
    where: { workspaceId, slug, deletedAt: null, status: "PUBLISHED" },
    include: { category: true, links: { orderBy: { sortOrder: "asc" } } },
  });
}
