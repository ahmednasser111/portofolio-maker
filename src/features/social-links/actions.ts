"use server";

import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { nextSortOrder, findSwap } from "@/lib/sort-order";
import {
  createSocialLinkSchema,
  updateSocialLinkSchema,
  socialLinkIdSchema,
  moveSocialLinkSchema,
  setSocialLinkVisibleSchema,
} from "./schemas";

export const createSocialLinkAction = createAction({
  schema: createSocialLinkSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.socialLink.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const link = await db.socialLink.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        platform: input.platform,
        iconKey: input.iconKey.length > 0 ? input.iconKey : null,
        url: input.url,
        sortOrder: nextSortOrder(siblings),
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });
    return { id: link.id };
  },
});

export const updateSocialLinkAction = createAction({
  schema: updateSocialLinkSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.socialLink.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: {
        platform: input.platform,
        iconKey: input.iconKey.length > 0 ? input.iconKey : null,
        url: input.url,
        updatedById: actor.userId,
      },
    });
    if (result.count === 0) throw new Error("Social link not found");
    return { id: input.id };
  },
});

export const deleteSocialLinkAction = createAction({
  schema: socialLinkIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.socialLink.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actor.userId },
    });
    if (result.count === 0) throw new Error("Social link not found");
    return { id: input.id };
  },
});

export const setSocialLinkVisibleAction = createAction({
  schema: setSocialLinkVisibleSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.socialLink.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { visible: input.visible, updatedById: actor.userId },
    });
    return { id: input.id };
  },
});

export const moveSocialLinkAction = createAction({
  schema: moveSocialLinkSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.socialLink.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const swap = findSwap(siblings, input.id, input.direction);
    if (!swap) return { moved: false };

    const [a, b] = swap;
    await db.$transaction([
      db.socialLink.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      db.socialLink.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    return { moved: true };
  },
});
