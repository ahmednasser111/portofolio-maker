"use server";

import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { nextSortOrder, findSwap } from "@/lib/sort-order";
import {
  createSkillCategorySchema,
  updateSkillCategorySchema,
  skillCategoryIdSchema,
  moveSkillCategorySchema,
} from "./schemas";

export const createSkillCategoryAction = createAction({
  schema: createSkillCategorySchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.skillCategory.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const category = await db.skillCategory.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        name: input.name,
        sortOrder: nextSortOrder(siblings),
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });
    return { id: category.id };
  },
});

export const updateSkillCategoryAction = createAction({
  schema: updateSkillCategorySchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.skillCategory.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { name: input.name, updatedById: actor.userId },
    });
    if (result.count === 0) throw new Error("Category not found");
    return { id: input.id };
  },
});

// Soft-deletes the category AND app-cascades a soft delete onto its skills
// (database-design.md §3.2) — deliberately not a DB cascade, so both halves
// stay reversible the same way every other soft delete is.
export const deleteSkillCategoryAction = createAction({
  schema: skillCategoryIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      const category = await tx.skillCategory.updateMany({
        where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
        data: { deletedAt: now, updatedById: actor.userId },
      });
      if (category.count === 0) return 0;
      await tx.skill.updateMany({
        where: { categoryId: input.id, workspaceId: actor.workspaceId, deletedAt: null },
        data: { deletedAt: now, updatedById: actor.userId },
      });
      return category.count;
    });
    if (result === 0) throw new Error("Category not found");
    return { id: input.id };
  },
});

export const moveSkillCategoryAction = createAction({
  schema: moveSkillCategorySchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.skillCategory.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const swap = findSwap(siblings, input.id, input.direction);
    if (!swap) return { moved: false };

    const [current, sibling] = swap;
    await db.$transaction([
      db.skillCategory.update({
        where: { id: current.id },
        data: { sortOrder: sibling.sortOrder },
      }),
      db.skillCategory.update({
        where: { id: sibling.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);
    return { moved: true };
  },
});
