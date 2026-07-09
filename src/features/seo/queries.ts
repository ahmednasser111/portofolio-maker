import { db } from "@/lib/db";
import type { NavigationPage } from "@prisma/client";

export function listSeoSettings(workspaceId: string) {
  return db.seoSetting.findMany({ where: { workspaceId } });
}

export type ResolvedSeo = {
  title: string;
  description: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
};

// Falls back page-row → workspace-default row → Workspace.siteTitle, per
// the pattern described once in the M2 plan rather than duplicated per page.
export async function resolveSeoMetadata(
  workspaceId: string,
  page: NavigationPage,
): Promise<ResolvedSeo> {
  // findFirst, not findUnique with the compound key: Prisma's generated
  // compound-unique-where type doesn't allow `page: null` even though the
  // DB constraint is NULLS NOT DISTINCT (Prisma's types don't know about
  // that hand-edit) — see database-design.md §14.3's hand-edited-migration
  // convention. The DB constraint still guarantees at most one row either way.
  const [pageRow, defaultRow, workspace] = await Promise.all([
    db.seoSetting.findFirst({ where: { workspaceId, page } }),
    db.seoSetting.findFirst({ where: { workspaceId, page: null } }),
    db.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
  ]);

  return {
    title: pageRow?.title ?? defaultRow?.title ?? workspace.siteTitle ?? workspace.slug,
    description: pageRow?.description ?? defaultRow?.description ?? null,
    ogImageUrl: pageRow?.ogImageUrl ?? defaultRow?.ogImageUrl ?? null,
    noindex: pageRow?.noindex ?? defaultRow?.noindex ?? false,
  };
}
