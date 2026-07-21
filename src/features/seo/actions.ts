"use server";

import { AssetKind } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import { db } from "@/lib/db";
import type { NavigationPage } from "@prisma/client";
import { replaceAsset } from "@/domain/assets/service";
import { upsertSeoSettingSchema, uploadSeoOgImageSchema } from "./schemas";

function orNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

export const upsertSeoSettingAction = createAction({
  schema: upsertSeoSettingSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const page = (input.page === "" ? null : input.page) as NavigationPage | null;
    const data = {
      title: orNull(input.title),
      description: orNull(input.description),
      noindex: input.noindex,
    };

    // findFirst + create/update, not upsert with the compound key: see the
    // same note in queries.ts about Prisma's compound-unique-where type not
    // accepting `page: null` despite the NULLS NOT DISTINCT hand-edit.
    const existing = await db.seoSetting.findFirst({
      where: { workspaceId: actor.workspaceId, page },
      select: { id: true },
    });

    if (existing) {
      await db.seoSetting.update({ where: { id: existing.id }, data });
    } else {
      await db.seoSetting.create({
        data: { id: uuidv7(), workspaceId: actor.workspaceId, page, ...data },
      });
    }

    return { page };
  },
});

export const uploadSeoOgImageAction = createAction({
  schema: uploadSeoOgImageSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    const page = (input.page === "" ? null : input.page) as NavigationPage | null;
    const existing = await db.seoSetting.findFirst({
      where: { workspaceId: actor.workspaceId, page },
    });

    const bytes = Buffer.from(await input.file.arrayBuffer());
    const asset = await replaceAsset({
      workspaceId: actor.workspaceId,
      kind: AssetKind.OG_IMAGE,
      previousAssetId: existing?.ogImageAssetId ?? null,
      filename: input.file.name,
      bytes,
    });

    if (existing) {
      await db.seoSetting.update({ where: { id: existing.id }, data: { ogImageAssetId: asset.id } });
    } else {
      await db.seoSetting.create({
        data: { id: uuidv7(), workspaceId: actor.workspaceId, page, ogImageAssetId: asset.id },
      });
    }

    return { url: asset.url };
  },
});
