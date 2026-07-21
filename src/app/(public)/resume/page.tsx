import type { Metadata } from "next";
import { getDefaultWorkspace } from "@/lib/workspace";
import { getProfile } from "@/features/profile/queries";
import { requireEnabledPage } from "@/features/navigation/queries";
import { resolveSeoMetadata } from "@/features/seo/queries";
import { toMetadata } from "@/features/seo/to-metadata";
import { getAssetDownloadUrl } from "@/lib/blob";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getDefaultWorkspace();
  return toMetadata(await resolveSeoMetadata(workspace.id, "RESUME"));
}

export default async function ResumePage() {
  const workspace = await getDefaultWorkspace();
  await requireEnabledPage(workspace.id, "RESUME");
  const profile = await getProfile(workspace.id);

  if (!profile?.publicResumeAsset) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Resume</h1>
        <p className="mt-2 text-muted-foreground">No resume has been added yet.</p>
      </div>
    );
  }

  const previewUrl = profile.publicResumeAsset.url;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Resume</h1>
        <a
          href={getAssetDownloadUrl(previewUrl)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Download
        </a>
      </div>
      <iframe src={previewUrl} title="Resume preview" className="h-[80vh] w-full rounded-md border" />
    </div>
  );
}
