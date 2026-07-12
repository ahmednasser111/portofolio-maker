import { z } from "zod";
import { ProjectLinkType } from "@prisma/client";

// Canonical shape for ImportItem.data where targetType=PROJECT. Used to
// validate provider output before staging (architecture.md §8) and again
// to validate an admin's edit on the review screen — the same schema, one
// definition. Lives in domain/ (not a feature) so provider modules can
// depend on it without an upward, feature-to-feature import.

export const projectDraftLinkSchema = z.object({
  type: z.nativeEnum(ProjectLinkType),
  url: z.string().trim().url(),
});

export const projectDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(300).nullable(),
  description: z.string().trim().max(10_000).nullable(),
  tags: z.array(z.string().trim().max(40)).max(20),
  links: z.array(projectDraftLinkSchema).max(10),
});

export type ProjectDraft = z.infer<typeof projectDraftSchema>;
