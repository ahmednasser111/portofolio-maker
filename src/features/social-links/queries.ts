import { db } from "@/lib/db";

export function listSocialLinksForDashboard(workspaceId: string) {
  return db.socialLink.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

export function listVisibleSocialLinks(workspaceId: string) {
  return db.socialLink.findMany({
    where: { workspaceId, deletedAt: null, visible: true },
    orderBy: { sortOrder: "asc" },
  });
}
