import { z } from "zod";

const baseSocialLinkFields = {
  platform: z.string().trim().min(1, "Required").max(60),
  iconKey: z.string().trim().max(60),
  url: z.string().trim().min(1, "Required").url("Enter a valid URL"),
};

export const createSocialLinkSchema = z.object(baseSocialLinkFields);
export type CreateSocialLinkInput = z.infer<typeof createSocialLinkSchema>;

export const updateSocialLinkSchema = z.object({ id: z.string(), ...baseSocialLinkFields });
export type UpdateSocialLinkInput = z.infer<typeof updateSocialLinkSchema>;

export const socialLinkIdSchema = z.object({ id: z.string() });

export const moveSocialLinkSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});

export const setSocialLinkVisibleSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
});
