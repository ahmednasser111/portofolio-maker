"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { themeTokensSchema } from "./token-schema";

// Edits the workspace's current theme in place — presets are the only thing
// that create a new Theme row (see activatePresetAction). One workspace,
// one live editable theme, matching how the dashboard editor is used.
export const saveThemeAction = createAction({
  schema: themeTokensSchema,
  resource: "theme",
  action: "write",
  handler: async (tokens, { actor }) => {
    const workspace = await db.workspace.findUniqueOrThrow({ where: { id: actor.workspaceId } });

    if (workspace.activeThemeId) {
      await db.theme.update({
        where: { id: workspace.activeThemeId },
        data: { tokens },
      });
      return { id: workspace.activeThemeId };
    }

    const theme = await db.theme.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        name: "My theme",
        tokens,
        isPreset: false,
      },
    });
    await db.workspace.update({
      where: { id: actor.workspaceId },
      data: { activeThemeId: theme.id },
    });
    return { id: theme.id };
  },
});

const activatePresetSchema = z.object({ presetId: z.string() });

// Clones the preset into a workspace-owned row (database-design.md §11) —
// edits stay tenant-local, the preset itself is never mutated, and
// basePresetId keeps the lineage for a future "reset to preset" diff.
export const activatePresetAction = createAction({
  schema: activatePresetSchema,
  resource: "theme",
  action: "write",
  handler: async ({ presetId }, { actor }) => {
    const preset = await db.theme.findFirst({ where: { id: presetId, isPreset: true } });
    if (!preset) throw new Error("Preset not found");

    const clone = await db.theme.create({
      data: {
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        name: preset.name,
        tokens: preset.tokens as Prisma.InputJsonValue,
        isPreset: false,
        basePresetId: preset.id,
      },
    });
    await db.workspace.update({
      where: { id: actor.workspaceId },
      data: { activeThemeId: clone.id },
    });
    return { id: clone.id };
  },
});
