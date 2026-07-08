import { db } from "@/lib/db";

export function listEducationForDashboard(workspaceId: string) {
  return db.education.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

export function listVisibleEducation(workspaceId: string) {
  return db.education.findMany({
    where: { workspaceId, deletedAt: null, visible: true },
    orderBy: { sortOrder: "asc" },
  });
}
