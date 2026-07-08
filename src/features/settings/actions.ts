"use server";

import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import { updateSiteTitleSchema } from "./schemas";

export const updateSiteTitleAction = createAction({
  schema: updateSiteTitleSchema,
  resource: "settings",
  action: "write",
  handler: async (input, { actor }) => {
    const workspace = await db.workspace.update({
      where: { id: actor.workspaceId },
      data: { siteTitle: input.siteTitle },
    });
    return { siteTitle: workspace.siteTitle };
  },
});
