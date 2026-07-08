"use server";

import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { nextSortOrder, findSwap } from "@/lib/sort-order";
import {
  createSkillSchema,
  updateSkillSchema,
  skillIdSchema,
  moveSkillSchema,
  setSkillVisibleSchema,
} from "./schemas";

export const createSkillAction = createAction({
  schema: createSkillSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.skill.findMany({
      where: { workspaceId: actor.workspaceId, categoryId: input.categoryId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const skill = await db.skill.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        categoryId: input.categoryId,
        name: input.name,
        level: input.level === "" ? null : input.level,
        iconKey: input.iconKey.length > 0 ? input.iconKey : null,
        sortOrder: nextSortOrder(siblings),
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });
    return { id: skill.id };
  },
});

export const updateSkillAction = createAction({
  schema: updateSkillSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.skill.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: {
        categoryId: input.categoryId,
        name: input.name,
        level: input.level === "" ? null : input.level,
        iconKey: input.iconKey.length > 0 ? input.iconKey : null,
        updatedById: actor.userId,
      },
    });
    if (result.count === 0) throw new Error("Skill not found");
    return { id: input.id };
  },
});

export const deleteSkillAction = createAction({
  schema: skillIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.skill.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actor.userId },
    });
    if (result.count === 0) throw new Error("Skill not found");
    return { id: input.id };
  },
});

export const setSkillVisibleAction = createAction({
  schema: setSkillVisibleSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.skill.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { visible: input.visible, updatedById: actor.userId },
    });
    return { id: input.id };
  },
});

export const moveSkillAction = createAction({
  schema: moveSkillSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const current = await db.skill.findFirst({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      select: { categoryId: true },
    });
    if (!current) return { moved: false };

    const siblings = await db.skill.findMany({
      where: {
        workspaceId: actor.workspaceId,
        categoryId: current.categoryId,
        deletedAt: null,
      },
      select: { id: true, sortOrder: true },
    });
    const swap = findSwap(siblings, input.id, input.direction);
    if (!swap) return { moved: false };

    const [a, b] = swap;
    await db.$transaction([
      db.skill.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      db.skill.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    return { moved: true };
  },
});
