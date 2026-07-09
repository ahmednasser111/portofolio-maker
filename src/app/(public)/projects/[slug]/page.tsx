import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDefaultWorkspace } from "@/lib/workspace";
import { getPublishedProjectBySlug } from "@/features/projects/queries";
import { requireEnabledPage } from "@/features/navigation/queries";
import { resolveSeoMetadata } from "@/features/seo/queries";
import { richTextToParagraphs } from "@/lib/rich-text";

export const dynamic = "force-dynamic";

const linkTypeLabels: Record<string, string> = {
  REPOSITORY: "Repository",
  LIVE_DEMO: "Live demo",
  DOCUMENTATION: "Documentation",
  OTHER: "Link",
};

type ProjectDetailPageProps = { params: Promise<{ slug: string }> };

// A project's own title/summary make a better title/description than the
// PROJECTS page's SeoSetting — that row still supplies the OG image/noindex
// fallback when the project doesn't override them.
export async function generateMetadata({ params }: ProjectDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await getDefaultWorkspace();
  const [project, seo] = await Promise.all([
    getPublishedProjectBySlug(workspace.id, slug),
    resolveSeoMetadata(workspace.id, "PROJECTS"),
  ]);
  if (!project) return {};

  return {
    title: project.title,
    description: project.summary ?? seo.description ?? undefined,
    robots: seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: project.title,
      description: project.summary ?? seo.description ?? undefined,
      images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined,
    },
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const workspace = await getDefaultWorkspace();
  await requireEnabledPage(workspace.id, "PROJECTS");
  const project = await getPublishedProjectBySlug(workspace.id, slug);

  if (!project) notFound();

  const descriptionParagraphs = richTextToParagraphs(project.description);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        {project.category ? (
          <p className="text-sm text-muted-foreground">{project.category.name}</p>
        ) : null}
        {project.tags.length > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">{project.tags.join(" · ")}</p>
        ) : null}
      </div>

      {project.summary ? <p className="text-muted-foreground">{project.summary}</p> : null}

      {descriptionParagraphs.length > 0 ? (
        <div className="space-y-2">
          {descriptionParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {project.links.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {project.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-1.5 text-sm hover:underline"
            >
              {link.label || linkTypeLabels[link.type]}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
