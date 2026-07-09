import type { Metadata } from "next";
import { getDefaultWorkspace } from "@/lib/workspace";
import { getProfile } from "@/features/profile/queries";
import { availabilityLabels } from "@/features/profile/labels";
import { richTextToParagraphs } from "@/lib/rich-text";
import { requireEnabledPage } from "@/features/navigation/queries";
import { resolveSeoMetadata } from "@/features/seo/queries";
import { toMetadata } from "@/features/seo/to-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getDefaultWorkspace();
  return toMetadata(await resolveSeoMetadata(workspace.id, "ABOUT"));
}

export default async function AboutPage() {
  const workspace = await getDefaultWorkspace();
  await requireEnabledPage(workspace.id, "ABOUT");
  const profile = await getProfile(workspace.id);

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="text-muted-foreground">Nothing to show yet.</p>
      </div>
    );
  }

  const bioParagraphs = richTextToParagraphs(profile.bio);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="flex items-center gap-4">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
          {profile.position ? (
            <p className="text-muted-foreground">{profile.position}</p>
          ) : null}
          {profile.location ? (
            <p className="text-sm text-muted-foreground">{profile.location}</p>
          ) : null}
          {profile.availability ? (
            <p className="text-sm text-muted-foreground">
              {availabilityLabels[profile.availability]}
            </p>
          ) : null}
        </div>
      </div>

      {bioParagraphs.length > 0 ? (
        <div className="space-y-3">
          {bioParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {profile.email || profile.phone ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          {profile.email ? <p>{profile.email}</p> : null}
          {profile.phone ? <p>{profile.phone}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
