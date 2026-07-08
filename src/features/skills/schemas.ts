import { z } from "zod";

export const skillLevelOptions = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

const baseSkillFields = {
  categoryId: z.string().min(1, "Choose a category"),
  name: z.string().trim().min(1, "Required").max(60),
  level: z.enum(skillLevelOptions).or(z.literal("")),
  iconKey: z.string().trim().max(60),
};

export const createSkillSchema = z.object(baseSkillFields);
export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const updateSkillSchema = z.object({ id: z.string(), ...baseSkillFields });
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

export const skillIdSchema = z.object({ id: z.string() });

export const moveSkillSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});

export const setSkillVisibleSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
});
