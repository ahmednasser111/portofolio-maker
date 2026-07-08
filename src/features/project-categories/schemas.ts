import { z } from "zod";

export const createProjectCategorySchema = z.object({
  name: z.string().trim().min(1, "Required").max(60),
});
export type CreateProjectCategoryInput = z.infer<typeof createProjectCategorySchema>;

export const updateProjectCategorySchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Required").max(60),
});
export type UpdateProjectCategoryInput = z.infer<typeof updateProjectCategorySchema>;

export const deleteProjectCategorySchema = z.object({ id: z.string() });

export const moveProjectCategorySchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});
