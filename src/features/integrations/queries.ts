import { db } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import type { ProviderAccountMeta } from "@/domain/providers/types";

export async function listConnections(workspaceId: string) {
  const rows = await db.providerConnection.findMany({ where: { workspaceId } });
  // Never expose encryptedToken to the client — allowlist the safe fields.
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    status: row.status,
    accountMeta: row.accountMeta as ProviderAccountMeta | null,
    connectedAt: row.connectedAt,
    lastCheckedAt: row.lastCheckedAt,
  }));
}

export async function getDecryptedToken(workspaceId: string, provider: "GITHUB" | "VERCEL") {
  const connection = await db.providerConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  if (!connection) return null;
  return decryptToken(connection.encryptedToken);
}

// For the Vercel linking picker — just enough to label a <select>.
export function listLinkableProjects(workspaceId: string) {
  return db.project.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}
