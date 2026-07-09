import type { MetadataRoute } from "next";
import { getDefaultWorkspace } from "@/lib/workspace";
import { listPublicNavigationItems } from "@/features/navigation/queries";
import { listPublishedProjects } from "@/features/projects/queries";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// Reads the database — without this, Next tries to prerender it at build
// time (same reason every DB-touching page in this app sets it).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const workspace = await getDefaultWorkspace();
  const [navLinks, projects] = await Promise.all([
    listPublicNavigationItems(workspace.id),
    listPublishedProjects(workspace.id),
  ]);

  const noindexPages = new Set(
    (
      await db.seoSetting.findMany({
        where: { workspaceId: workspace.id, noindex: true },
        select: { page: true },
      })
    ).map((row) => row.page),
  );

  const pageEntries: MetadataRoute.Sitemap = navLinks
    .filter((link) => !noindexPages.has(link.page))
    .map((link) => ({
      url: `${env.SITE_URL}${link.href}`,
      changeFrequency: "weekly",
      priority: link.page === "HOME" ? 1 : 0.7,
    }));

  const projectEntries: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${env.SITE_URL}/projects/${project.slug}`,
    lastModified: project.updatedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...pageEntries, ...projectEntries];
}
