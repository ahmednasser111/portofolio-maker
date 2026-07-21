"use server";

import { AssetKind, Prisma } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { createAction, ActionError } from "@/lib/create-action";
import { db } from "@/lib/db";
import { toRichTextDoc } from "@/lib/rich-text";
import { replaceAsset } from "@/domain/assets/service";
import { upsertProfileSchema, uploadAvatarSchema, uploadProfileResumeSchema } from "./schemas";

function orNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

export const upsertProfileAction = createAction({
  schema: upsertProfileSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const data = {
      displayName: input.displayName,
      position: orNull(input.position),
      headline: orNull(input.headline),
      bio: input.bio.length > 0 ? toRichTextDoc(input.bio) : Prisma.JsonNull,
      location: orNull(input.location),
      availability: input.availability === "" ? null : input.availability,
      email: orNull(input.email),
      phone: orNull(input.phone),
      heroCtaLabel: orNull(input.heroCtaLabel),
      heroCtaUrl: orNull(input.heroCtaUrl),
      updatedById: actor.userId,
    };

    const profile = await db.profile.upsert({
      where: { workspaceId: actor.workspaceId },
      update: data,
      create: {
        ...data,
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        createdById: actor.userId,
      },
    });

    return { id: profile.id };
  },
});

async function requireProfile(workspaceId: string) {
  const profile = await db.profile.findUnique({ where: { workspaceId } });
  if (!profile) {
    throw new ActionError("VALIDATION", "Save the profile's basic info first, then upload a file.");
  }
  return profile;
}

export const uploadAvatarAction = createAction({
  schema: uploadAvatarSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const profile = await requireProfile(actor.workspaceId);
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const asset = await replaceAsset({
      workspaceId: actor.workspaceId,
      kind: AssetKind.AVATAR,
      previousAssetId: profile.avatarAssetId,
      filename: input.file.name,
      bytes,
    });
    await db.profile.update({
      where: { id: profile.id },
      data: { avatarAssetId: asset.id, updatedById: actor.userId },
    });
    return { url: asset.url };
  },
});

export const uploadProfileResumeAction = createAction({
  schema: uploadProfileResumeSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const profile = await requireProfile(actor.workspaceId);
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const asset = await replaceAsset({
      workspaceId: actor.workspaceId,
      kind: AssetKind.RESUME,
      previousAssetId: profile.publicResumeAssetId,
      filename: input.file.name,
      bytes,
    });
    await db.profile.update({
      where: { id: profile.id },
      data: { publicResumeAssetId: asset.id, updatedById: actor.userId },
    });
    return { url: asset.url };
  },
});
