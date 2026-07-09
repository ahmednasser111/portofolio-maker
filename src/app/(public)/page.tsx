import Link from "next/link";
import type { Metadata } from "next";
import { getDefaultWorkspace } from "@/lib/workspace";
import { getProfile } from "@/features/profile/queries";
import { availabilityLabels } from "@/features/profile/labels";
import { richTextToParagraphs } from "@/lib/rich-text";
import { listFeaturedProjects } from "@/features/projects/queries";
import { listVisibleSocialLinks } from "@/features/social-links/queries";
import { getActiveThemeTokens } from "@/features/theme/queries";
import { requireEnabledPage } from "@/features/navigation/queries";
import { resolveSeoMetadata } from "@/features/seo/queries";
import { toMetadata } from "@/features/seo/to-metadata";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getDefaultWorkspace();
  return toMetadata(await resolveSeoMetadata(workspace.id, "HOME"));
}

export default async function HomePage() {
  const workspace = await getDefaultWorkspace();
  await requireEnabledPage(workspace.id, "HOME");
  const [profile, featuredProjects, socialLinks, tokens] = await Promise.all([
    getProfile(workspace.id),
    listFeaturedProjects(workspace.id),
    listVisibleSocialLinks(workspace.id),
    getActiveThemeTokens(workspace.id),
  ]);
  const heroSplit = tokens.layout.hero === "split";

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold">{workspace.siteTitle ?? workspace.slug}</h1>
        <p className="mt-2 text-muted-foreground">
          This portfolio hasn&apos;t been set up yet.
        </p>
      </div>
    );
  }

  const bioParagraphs = richTextToParagraphs(profile.bio);

  return (
    <div className="mx-auto max-w-2xl space-y-10 p-8">
      <section
        className={cn(
          heroSplit
            ? "flex flex-col items-center gap-6 text-left sm:flex-row"
            : "space-y-3 text-center",
        )}
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className={cn(
              "rounded-full object-cover",
              heroSplit ? "h-32 w-32 shrink-0" : "mx-auto h-24 w-24",
            )}
          />
        ) : null}
        <div className={cn("space-y-3", heroSplit && "text-left")}>
          <h1 className="text-3xl font-semibold">{profile.displayName}</h1>
          {profile.position ? (
            <p className="text-lg text-muted-foreground">{profile.position}</p>
          ) : null}
          {profile.headline ? <p className="text-muted-foreground">{profile.headline}</p> : null}
          {profile.availability ? (
            <p className="text-sm text-muted-foreground">
              {availabilityLabels[profile.availability]}
            </p>
          ) : null}
          <div className={cn("flex gap-3 pt-2", !heroSplit && "justify-center")}>
            {profile.heroCtaLabel && profile.heroCtaUrl ? (
              <Link
                href={profile.heroCtaUrl}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                {profile.heroCtaLabel}
              </Link>
            ) : null}
            {profile.resumeUrl ? (
              <a
                href={profile.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border px-4 py-2 text-sm"
              >
                Download resume
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {bioParagraphs.length > 0 ? (
        <section className="space-y-2">
          {bioParagraphs.map((paragraph, index) => (
            <p key={index} className="text-sm text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ) : null}

      {featuredProjects.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Featured projects</h2>
          <ul className="space-y-3">
            {featuredProjects.map((project) => (
              <li key={project.id} className="rounded-md border p-4">
                <Link href={`/projects/${project.slug}`} className="font-medium hover:underline">
                  {project.title}
                </Link>
                {project.summary ? (
                  <p className="text-sm text-muted-foreground">{project.summary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {socialLinks.length > 0 ? (
        <section className="flex justify-center gap-4">
          {socialLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm hover:underline"
            >
              {link.platform}
            </a>
          ))}
        </section>
      ) : null}
    </div>
  );
}
