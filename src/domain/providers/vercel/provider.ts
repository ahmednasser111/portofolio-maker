import { ProviderType } from "@prisma/client";
import type { ConnectionProvider, ProviderAccountMeta } from "../types";
import { fetchVercelUser } from "./client";

// Connection capability only — Vercel is a linking provider, not an import
// one (architecture.md §12): it never produces ImportItems, it attaches a
// production URL straight onto an existing Project's ProjectLink.
export const vercelProvider: ConnectionProvider = {
  type: ProviderType.VERCEL,

  async verifyToken(token: string): Promise<ProviderAccountMeta> {
    const { user } = await fetchVercelUser(token);
    return { username: user.username, avatarUrl: user.avatar };
  },
};
