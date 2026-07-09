import { db } from "@/lib/db";

export function listMessages(workspaceId: string) {
  return db.contactMessage.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}
