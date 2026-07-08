"use server";

import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { nextSortOrder, findSwap } from "@/lib/sort-order";
import {
  createProjectCategorySchema,
  updateProjectCategorySchema,
  deleteProjectCategorySchema,
  moveProjectCategorySchema,
} from "./schemas";

export const createProjectCategoryAction = createAction({
  schema: createProjectCategorySchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.projectCategory.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, sortOrder: true },
    });
    const category = await db.projectCategory.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        name: input.name,
        sortOrder: nextSortOrder(siblings),
      },
    });
    return { id: category.id };
  },
});

export const updateProjectCategoryAction = createAction({
  schema: updateProjectCategorySchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.projectCategory.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId },
      data: { name: input.name },
    });
    if (result.count === 0) throw new Error("Category not found");
    return { id: input.id };
  },
});

export const deleteProjectCategoryAction = createAction({
  schema: deleteProjectCategorySchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    // Project.categoryId is onDelete: SetNull at the DB level — projects in
    // this category become "Uncategorized", not soft-deleted.
    const result = await db.projectCategory.deleteMany({
      where: { id: input.id, workspaceId: actor.workspaceId },
    });
    if (result.count === 0) throw new Error("Category not found");
    return { id: input.id };
  },
});

export const moveProjectCategoryAction = createAction({
  schema: moveProjectCategorySchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.projectCategory.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, sortOrder: true },
    });
    const swap = findSwap(siblings, input.id, input.direction);
    if (!swap) return { moved: false };

    const [current, sibling] = swap;
    await db.$transaction([
      db.projectCategory.update({
        where: { id: current.id },
        data: { sortOrder: sibling.sortOrder },
      }),
      db.projectCategory.update({
        where: { id: sibling.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);
    return { moved: true };
  },
});
