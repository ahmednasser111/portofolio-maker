import type { ImportTargetType, ProviderType } from "@prisma/client";

// Two orthogonal capabilities per architecture.md §12 — a provider can
// implement either, both, or (for RESUME, M4) neither of these and still
// use the shared import pipeline. Vercel implements only ConnectionProvider
// (a linking provider, not an import one); GitHub implements both.

export type ProviderAccountMeta = {
  username: string;
  avatarUrl?: string | null;
};

export interface ConnectionProvider {
  type: ProviderType;
  // Throws a descriptive Error on an invalid/unauthorized token — the caller
  // (features/integrations) turns that into a PROVIDER_ERROR envelope.
  verifyToken(token: string): Promise<ProviderAccountMeta>;
}

export type StagedItemDraft = {
  targetType: ImportTargetType;
  externalId: string;
  data: unknown; // Zod-validated by the target's schema before staging, not here.
};

export interface ImportProvider<TRemoteItem = unknown> {
  type: ProviderType;
  listImportables(token: string): Promise<TRemoteItem[]>;
  mapToStagedItems(remoteItems: TRemoteItem[]): StagedItemDraft[];
}
