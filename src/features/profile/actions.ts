"use server";

import { Prisma } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { toRichTextDoc } from "@/lib/rich-text";
import { upsertProfileSchema } from "./schemas";

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
      avatarUrl: orNull(input.avatarUrl),
      location: orNull(input.location),
      availability: input.availability === "" ? null : input.availability,
      email: orNull(input.email),
      phone: orNull(input.phone),
      heroCtaLabel: orNull(input.heroCtaLabel),
      heroCtaUrl: orNull(input.heroCtaUrl),
      resumeUrl: orNull(input.resumeUrl),
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
