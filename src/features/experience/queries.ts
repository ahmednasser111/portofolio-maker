import { db } from "@/lib/db";

export function listExperiencesForDashboard(workspaceId: string) {
  return db.experience.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

export function listVisibleExperiences(workspaceId: string) {
  return db.experience.findMany({
    where: { workspaceId, deletedAt: null, visible: true },
    orderBy: { sortOrder: "asc" },
  });
}
