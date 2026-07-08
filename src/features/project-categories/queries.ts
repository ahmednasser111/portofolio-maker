import { db } from "@/lib/db";

export function listProjectCategories(workspaceId: string) {
  return db.projectCategory.findMany({
    where: { workspaceId },
    orderBy: { sortOrder: "asc" },
  });
}
