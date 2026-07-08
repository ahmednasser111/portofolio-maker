"use server";

import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { nextSortOrder, findSwap } from "@/lib/sort-order";
import {
  createEducationSchema,
  updateEducationSchema,
  educationIdSchema,
  moveEducationSchema,
  setEducationVisibleSchema,
} from "./schemas";

export const createEducationAction = createAction({
  schema: createEducationSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.education.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const education = await db.education.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        institution: input.institution,
        degree: input.degree.length > 0 ? input.degree : null,
        field: input.field.length > 0 ? input.field : null,
        startDate: input.startDate.length > 0 ? new Date(input.startDate) : null,
        endDate: input.endDate.length > 0 ? new Date(input.endDate) : null,
        description: input.description.length > 0 ? input.description : null,
        sortOrder: nextSortOrder(siblings),
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });
    return { id: education.id };
  },
});

export const updateEducationAction = createAction({
  schema: updateEducationSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.education.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: {
        institution: input.institution,
        degree: input.degree.length > 0 ? input.degree : null,
        field: input.field.length > 0 ? input.field : null,
        startDate: input.startDate.length > 0 ? new Date(input.startDate) : null,
        endDate: input.endDate.length > 0 ? new Date(input.endDate) : null,
        description: input.description.length > 0 ? input.description : null,
        updatedById: actor.userId,
      },
    });
    if (result.count === 0) throw new Error("Education not found");
    return { id: input.id };
  },
});

export const deleteEducationAction = createAction({
  schema: educationIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.education.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actor.userId },
    });
    if (result.count === 0) throw new Error("Education not found");
    return { id: input.id };
  },
});

export const setEducationVisibleAction = createAction({
  schema: setEducationVisibleSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.education.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { visible: input.visible, updatedById: actor.userId },
    });
    return { id: input.id };
  },
});

export const moveEducationAction = createAction({
  schema: moveEducationSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.education.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const swap = findSwap(siblings, input.id, input.direction);
    if (!swap) return { moved: false };

    const [a, b] = swap;
    await db.$transaction([
      db.education.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      db.education.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    return { moved: true };
  },
});
