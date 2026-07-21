import { z } from "zod";
import { ProjectLinkType, EmploymentType, SkillLevel } from "@prisma/client";

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

// M4 (resume import) target shapes — mirror the manual create-forms'
// field set (features/experience|education|skills/schemas.ts) so the
// review screen's edit form and the manual CRUD form can eventually share
// field-level conventions, even though the components themselves stay
// separate per this project's near-duplicate-over-shared-abstraction rule.
// Dates are loose strings (LLM output, human-edited on review), parsed to
// Date only at commit time — same as the manual forms.

export const experienceDraftSchema = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).nullable(),
  employmentType: z.nativeEnum(EmploymentType).nullable(),
  startDate: z.string().trim().min(1),
  // Empty/null = present.
  endDate: z.string().trim().nullable(),
  description: z.string().trim().max(2000).nullable(),
  highlights: z.array(z.string().trim().max(300)).max(20),
});
export type ExperienceDraft = z.infer<typeof experienceDraftSchema>;

export const educationDraftSchema = z.object({
  institution: z.string().trim().min(1).max(160),
  degree: z.string().trim().max(120).nullable(),
  field: z.string().trim().max(120).nullable(),
  startDate: z.string().trim().nullable(),
  endDate: z.string().trim().nullable(),
  description: z.string().trim().max(2000).nullable(),
});
export type EducationDraft = z.infer<typeof educationDraftSchema>;

// categoryName (not categoryId) — resume extraction doesn't know existing
// category rows; commit finds-or-creates a SkillCategory by name.
export const skillDraftSchema = z.object({
  categoryName: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(60),
  level: z.nativeEnum(SkillLevel).nullable(),
});
export type SkillDraft = z.infer<typeof skillDraftSchema>;

// Singleton target — commit merges into the one Profile row (headline/bio
// only; identity fields like displayName/email are never LLM-overwritten).
export const profileSummaryDraftSchema = z.object({
  headline: z.string().trim().max(200).nullable(),
  bio: z.string().trim().max(5000).nullable(),
});
export type ProfileSummaryDraft = z.infer<typeof profileSummaryDraftSchema>;
