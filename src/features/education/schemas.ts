import { z } from "zod";

const baseEducationFields = {
  institution: z.string().trim().min(1, "Required").max(160),
  degree: z.string().trim().max(120),
  field: z.string().trim().max(120),
  startDate: z.string().trim(),
  endDate: z.string().trim(),
  description: z.string().trim().max(2000),
};

export const createEducationSchema = z.object(baseEducationFields);
export type CreateEducationInput = z.infer<typeof createEducationSchema>;

export const updateEducationSchema = z.object({ id: z.string(), ...baseEducationFields });
export type UpdateEducationInput = z.infer<typeof updateEducationSchema>;

export const educationIdSchema = z.object({ id: z.string() });

export const moveEducationSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});

export const setEducationVisibleSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
});
