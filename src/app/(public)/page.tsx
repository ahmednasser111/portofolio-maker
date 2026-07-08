import Link from "next/link";
import { getDefaultWorkspace } from "@/lib/workspace";
import { getProfile } from "@/features/profile/queries";
import { availabilityLabels } from "@/features/profile/labels";
import { richTextToParagraphs } from "@/lib/rich-text";
import { listFeaturedProjects } from "@/features/projects/queries";
import { listVisibleSocialLinks } from "@/features/social-links/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workspace = await getDefaultWorkspace();
  const [profile, featuredProjects, socialLinks] = await Promise.all([
    getProfile(workspace.id),
    listFeaturedProjects(workspace.id),
    listVisibleSocialLinks(workspace.id),
  ]);

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
      <section className="space-y-3 text-center">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="mx-auto h-24 w-24 rounded-full object-cover"
          />
        ) : null}
        <h1 className="text-3xl font-semibold">{profile.displayName}</h1>
        {profile.position ? <p className="text-lg text-muted-foreground">{profile.position}</p> : null}
        {profile.headline ? <p className="text-muted-foreground">{profile.headline}</p> : null}
        {profile.availability ? (
          <p className="text-sm text-muted-foreground">
            {availabilityLabels[profile.availability]}
          </p>
        ) : null}
        <div className="flex justify-center gap-3 pt-2">
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
