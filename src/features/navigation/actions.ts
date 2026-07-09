"use server";

import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { findSwap } from "@/lib/sort-order";
import {
  setNavigationItemEnabledSchema,
  renameNavigationItemSchema,
  moveNavigationItemSchema,
} from "./schemas";

export const setNavigationItemEnabledAction = createAction({
  schema: setNavigationItemEnabledSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.navigationItem.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId },
      data: { enabled: input.enabled },
    });
    if (result.count === 0) throw new Error("Navigation item not found");
    return { id: input.id };
  },
});

export const renameNavigationItemAction = createAction({
  schema: renameNavigationItemSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.navigationItem.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId },
      data: { customLabel: input.customLabel.length > 0 ? input.customLabel : null },
    });
    if (result.count === 0) throw new Error("Navigation item not found");
    return { id: input.id };
  },
});

export const moveNavigationItemAction = createAction({
  schema: moveNavigationItemSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.navigationItem.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, sortOrder: true },
    });
    const swap = findSwap(siblings, input.id, input.direction);
    if (!swap) return { moved: false };

    const [a, b] = swap;
    await db.$transaction([
      db.navigationItem.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      db.navigationItem.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    return { moved: true };
  },
});
