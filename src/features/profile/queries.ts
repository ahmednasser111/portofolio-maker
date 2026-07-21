import { db } from "@/lib/db";

export function getProfile(workspaceId: string) {
  return db.profile.findUnique({
    where: { workspaceId },
    include: { avatarAsset: true, publicResumeAsset: true },
  });
}
