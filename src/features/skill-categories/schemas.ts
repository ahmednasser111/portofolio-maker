import { z } from "zod";

export const createSkillCategorySchema = z.object({
  name: z.string().trim().min(1, "Required").max(60),
});
export type CreateSkillCategoryInput = z.infer<typeof createSkillCategorySchema>;

export const updateSkillCategorySchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Required").max(60),
});
export type UpdateSkillCategoryInput = z.infer<typeof updateSkillCategorySchema>;

export const skillCategoryIdSchema = z.object({ id: z.string() });

export const moveSkillCategorySchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});
