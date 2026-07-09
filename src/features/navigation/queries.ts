import { notFound } from "next/navigation";
import { uuidv7 } from "uuidv7";
import { db } from "@/lib/db";
import type { NavigationPage } from "@prisma/client";
import { SEEDED_NAV_PAGES, DEFAULT_NAV_LABELS, NAV_PAGE_HREF } from "./labels";

// Called from the dashboard Navigation page only — creates any missing rows
// (idempotent upsert) so there's something to toggle/rename/reorder. Public
// pages deliberately do NOT call this (see listPublicNavigationItems /
// requireEnabledPage below) so a fresh workspace costs zero extra writes
// until an admin actually visits this page.
export async function ensureNavigationSeeded(workspaceId: string) {
  await Promise.all(
    SEEDED_NAV_PAGES.map((page, index) =>
      db.navigationItem.upsert({
        where: { workspaceId_page: { workspaceId, page } },
        update: {},
        create: { id: uuidv7(), workspaceId, page, sortOrder: (index + 1) * 1000 },
      }),
    ),
  );
}

export function listNavigationItems(workspaceId: string) {
  return db.navigationItem.findMany({ where: { workspaceId }, orderBy: { sortOrder: "asc" } });
}

export type PublicNavLink = { page: NavigationPage; label: string; href: string };

// Falls back to the default seeded set (all enabled, default order) when no
// NavigationItem rows exist yet — matches the DB default (enabled: true) so
// a fresh workspace's nav isn't empty before an admin customizes anything.
export async function listPublicNavigationItems(workspaceId: string): Promise<PublicNavLink[]> {
  const items = await db.navigationItem.findMany({
    where: { workspaceId },
    orderBy: { sortOrder: "asc" },
  });

  if (items.length === 0) {
    return SEEDED_NAV_PAGES.map((page) => ({
      page,
      label: DEFAULT_NAV_LABELS[page],
      href: NAV_PAGE_HREF[page],
    }));
  }

  return items
    .filter((item) => item.enabled)
    .map((item) => ({
      page: item.page,
      label: item.customLabel ?? DEFAULT_NAV_LABELS[item.page],
      href: NAV_PAGE_HREF[item.page],
    }));
}

// Used at the top of every public page — 404s if the page has been
// explicitly disabled. No row yet ⇒ enabled (the DB default).
export async function requireEnabledPage(workspaceId: string, page: NavigationPage) {
  const item = await db.navigationItem.findUnique({
    where: { workspaceId_page: { workspaceId, page } },
  });
  if (item && !item.enabled) notFound();
}
