import { db } from "@/lib/db";
import type { ProviderType } from "@prisma/client";

export function listImportSessions(workspaceId: string, provider: ProviderType) {
  return db.importSession.findMany({
    where: { workspaceId, provider },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export function getImportSessionWithItems(sessionId: string, workspaceId: string) {
  return db.importSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
}
