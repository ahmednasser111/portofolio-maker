"use server";

import { Prisma } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { toRichTextDoc } from "@/lib/rich-text";
import { uniqueSlug } from "@/lib/slug";
import { nextSortOrder, findSwap } from "@/lib/sort-order";
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdSchema,
  moveProjectSchema,
  setProjectFeaturedSchema,
  type ProjectLinkInput,
} from "./schemas";

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function parseDate(raw: string): Date | null {
  return raw.length > 0 ? new Date(raw) : null;
}

function linksCreateInput(workspaceId: string, links: ProjectLinkInput[]) {
  return links.map((link, index) => ({
    id: uuidv7(),
    workspaceId,
    type: link.type,
    label: link.label.length > 0 ? link.label : null,
    url: link.url,
    sortOrder: (index + 1) * 1000,
  }));
}

export const createProjectAction = createAction({
  schema: createProjectSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const slugBase = input.slug.length > 0 ? input.slug : input.title;
    const slug = await uniqueSlug(slugBase, async (candidate) => {
      const existing = await db.project.findFirst({
        where: { workspaceId: actor.workspaceId, slug: candidate, deletedAt: null },
        select: { id: true },
      });
      return existing !== null;
    });

    const siblings = await db.project.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });

    const project = await db.project.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        title: input.title,
        slug,
        summary: input.summary.length > 0 ? input.summary : null,
        description:
          input.description.length > 0 ? toRichTextDoc(input.description) : Prisma.JsonNull,
        categoryId: input.categoryId.length > 0 ? input.categoryId : null,
        tags: parseTags(input.tags),
        startDate: parseDate(input.startDate),
        endDate: parseDate(input.endDate),
        sortOrder: nextSortOrder(siblings),
        createdById: actor.userId,
        updatedById: actor.userId,
        links: { create: linksCreateInput(actor.workspaceId, input.links) },
      },
    });

    return { id: project.id, slug: project.slug };
  },
});

export const updateProjectAction = createAction({
  schema: updateProjectSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const existing = await db.project.findFirst({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new Error("Project not found");

    const slugBase = input.slug.length > 0 ? input.slug : input.title;
    const slug = await uniqueSlug(slugBase, async (candidate) => {
      const clash = await db.project.findFirst({
        where: {
          workspaceId: actor.workspaceId,
          slug: candidate,
          deletedAt: null,
          NOT: { id: input.id },
        },
        select: { id: true },
      });
      return clash !== null;
    });

    await db.$transaction([
      db.projectLink.deleteMany({ where: { projectId: input.id } }),
      db.project.update({
        where: { id: input.id },
        data: {
          title: input.title,
          slug,
          summary: input.summary.length > 0 ? input.summary : null,
          description:
            input.description.length > 0 ? toRichTextDoc(input.description) : Prisma.JsonNull,
          categoryId: input.categoryId.length > 0 ? input.categoryId : null,
          tags: parseTags(input.tags),
          startDate: parseDate(input.startDate),
          endDate: parseDate(input.endDate),
          updatedById: actor.userId,
          links: { create: linksCreateInput(actor.workspaceId, input.links) },
        },
      }),
    ]);

    return { id: input.id, slug };
  },
});

export const deleteProjectAction = createAction({
  schema: projectIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const result = await db.project.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new Error("Project not found");
    return { id: input.id };
  },
});

export const publishProjectAction = createAction({
  schema: projectIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.project.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { status: "PUBLISHED" },
    });
    return { id: input.id };
  },
});

export const unpublishProjectAction = createAction({
  schema: projectIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.project.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { status: "DRAFT" },
    });
    return { id: input.id };
  },
});

export const archiveProjectAction = createAction({
  schema: projectIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.project.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { status: "ARCHIVED" },
    });
    return { id: input.id };
  },
});

export const setProjectFeaturedAction = createAction({
  schema: setProjectFeaturedSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.project.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId, deletedAt: null },
      data: { featured: input.featured },
    });
    return { id: input.id };
  },
});

export const moveProjectAction = createAction({
  schema: moveProjectSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const siblings = await db.project.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
    const swap = findSwap(siblings, input.id, input.direction);
    if (!swap) return { moved: false };

    const [current, sibling] = swap;
    await db.$transaction([
      db.project.update({ where: { id: current.id }, data: { sortOrder: sibling.sortOrder } }),
      db.project.update({ where: { id: sibling.id }, data: { sortOrder: current.sortOrder } }),
    ]);
    return { moved: true };
  },
});
