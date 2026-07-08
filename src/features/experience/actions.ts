"use server";

import { Prisma } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { toRichTextListDoc } from "@/lib/rich-text";
import { nextSortOrder, findSwap } from "@/lib/sort-order";
import {
  createExperienceSchema,
  updateExperienceSchema,
  experienceIdSchema,
  moveExperienceSchema,
  setExperienceVisibleSchema,
} from "./schemas";

function parseHighlights(raw: string) {
  const items = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return items.length > 0 ? toRichTextListDoc(items) : Prisma.JsonNull;
}

export const createExperienceAction = createAction({
  schema: createExperienceSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.experience.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const experience = await db.experience.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        company: input.company,
        role: input.role,
        location: input.location.length > 0 ? input.location : null,
        employmentType: input.employmentType === "" ? null : input.employmentType,
        startDate: new Date(input.startDate),
        endDate: input.endDate.length > 0 ? new Date(input.endDate) : null,
        description: input.description.length > 0 ? input.description : null,
        highlights: parseHighlights(input.highlights),
        sortOrder: nextSortOrder(siblings),
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });
    return { id: experience.id };
  },
});

export const updateExperienceAction = createAction({
  schema: updateExperienceSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.experience.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: {
        company: input.company,
        role: input.role,
        location: input.location.length > 0 ? input.location : null,
        employmentType: input.employmentType === "" ? null : input.employmentType,
        startDate: new Date(input.startDate),
        endDate: input.endDate.length > 0 ? new Date(input.endDate) : null,
        description: input.description.length > 0 ? input.description : null,
        highlights: parseHighlights(input.highlights),
        updatedById: actor.userId,
      },
    });
    if (result.count === 0) throw new Error("Experience not found");
    return { id: input.id };
  },
});

export const deleteExperienceAction = createAction({
  schema: experienceIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.experience.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actor.userId },
    });
    if (result.count === 0) throw new Error("Experience not found");
    return { id: input.id };
  },
});

export const setExperienceVisibleAction = createAction({
  schema: setExperienceVisibleSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.experience.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { visible: input.visible, updatedById: actor.userId },
    });
    return { id: input.id };
  },
});

export const moveExperienceAction = createAction({
  schema: moveExperienceSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.experience.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const swap = findSwap(siblings, input.id, input.direction);
    if (!swap) return { moved: false };

    const [a, b] = swap;
    await db.$transaction([
      db.experience.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      db.experience.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    return { moved: true };
  },
});
