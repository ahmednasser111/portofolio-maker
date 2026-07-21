import { z } from "zod";

export const upsertSeoSettingSchema = z.object({
  // "" ⇒ the workspace-default row (SeoSetting.page IS NULL).
  page: z.string(),
  title: z.string().trim().max(120),
  description: z.string().trim().max(300),
  noindex: z.boolean(),
});
export type UpsertSeoSettingInput = z.infer<typeof upsertSeoSettingSchema>;

// OG image is a file upload (Asset-backed, M4) — separate one-shot action.
export const uploadSeoOgImageSchema = z.object({
  page: z.string(),
  file: z.instanceof(File),
});
