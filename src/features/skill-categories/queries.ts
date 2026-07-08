import { db } from "@/lib/db";

export function listSkillCategories(workspaceId: string) {
  return db.skillCategory.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}
