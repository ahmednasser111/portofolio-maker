import { z } from "zod";

export const employmentTypeOptions = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "FREELANCE",
  "INTERNSHIP",
  "VOLUNTEER",
] as const;

const baseExperienceFields = {
  company: z.string().trim().min(1, "Required").max(120),
  role: z.string().trim().min(1, "Required").max(120),
  location: z.string().trim().max(120),
  employmentType: z.enum(employmentTypeOptions).or(z.literal("")),
  startDate: z.string().trim().min(1, "Required"),
  // "" means present / ongoing.
  endDate: z.string().trim(),
  description: z.string().trim().max(2000),
  // Newline-separated; split into Experience.highlights items in the handler.
  highlights: z.string().trim().max(4000),
};

export const createExperienceSchema = z.object(baseExperienceFields);
export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;

export const updateExperienceSchema = z.object({ id: z.string(), ...baseExperienceFields });
export type UpdateExperienceInput = z.infer<typeof updateExperienceSchema>;

export const experienceIdSchema = z.object({ id: z.string() });

export const moveExperienceSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});

export const setExperienceVisibleSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
});
