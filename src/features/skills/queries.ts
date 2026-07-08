import { db } from "@/lib/db";

// All non-deleted skills grouped by category, regardless of `visible` —
// the dashboard needs to show hidden skills too so they can be un-hidden.
export function listSkillCategoriesWithSkills(workspaceId: string) {
  return db.skillCategory.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      skills: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export function listVisibleSkillsByCategory(workspaceId: string) {
  return db.skillCategory.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      skills: {
        where: { deletedAt: null, visible: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}
