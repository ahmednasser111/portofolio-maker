import { z } from "zod";

export const upsertSeoSettingSchema = z.object({
  // "" ⇒ the workspace-default row (SeoSetting.page IS NULL).
  page: z.string(),
  title: z.string().trim().max(120),
  description: z.string().trim().max(300),
  ogImageUrl: z.string().trim().max(500),
  noindex: z.boolean(),
});
export type UpsertSeoSettingInput = z.infer<typeof upsertSeoSettingSchema>;
