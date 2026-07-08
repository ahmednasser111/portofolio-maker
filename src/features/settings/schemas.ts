import { z } from "zod";

export const updateSiteTitleSchema = z.object({
  siteTitle: z.string().trim().min(1, "Required").max(100),
});

export type UpdateSiteTitleInput = z.infer<typeof updateSiteTitleSchema>;
