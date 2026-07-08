import { z } from "zod";

export const projectLinkTypeOptions = ["REPOSITORY", "LIVE_DEMO", "DOCUMENTATION", "OTHER"] as const;

export const projectLinkInputSchema = z.object({
  type: z.enum(projectLinkTypeOptions),
  label: z.string().trim().max(60),
  url: z.string().trim().min(1, "Required").url("Enter a valid URL"),
});
export type ProjectLinkInput = z.infer<typeof projectLinkInputSchema>;

const baseProjectFields = {
  title: z.string().trim().min(1, "Required").max(160),
  // "" => auto-generate from title.
  slug: z.string().trim().max(160),
  summary: z.string().trim().max(300),
  description: z.string().trim().max(10_000),
  categoryId: z.string(),
  // Comma-separated in the form; split into Project.tags in the handler.
  tags: z.string().trim().max(300),
  startDate: z.string().trim(),
  endDate: z.string().trim(),
  links: z.array(projectLinkInputSchema).max(10),
};

export const createProjectSchema = z.object(baseProjectFields);
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({ id: z.string(), ...baseProjectFields });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectIdSchema = z.object({ id: z.string() });

export const moveProjectSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});

export const setProjectFeaturedSchema = z.object({
  id: z.string(),
  featured: z.boolean(),
});
