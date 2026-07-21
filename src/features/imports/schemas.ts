import { z } from "zod";

export const noInputSchema = z.object({});

export const stageGithubImportSchema = z.object({
  repoIds: z.array(z.string()).min(1, "Select at least one repository."),
});
export type StageGithubImportInput = z.infer<typeof stageGithubImportSchema>;

// Shape varies by the item's targetType (Project/Experience/Education/Skill/
// ProfileSummary) — validated server-side against the right schema in
// `domain/imports/service.ts`'s `validateTargetData`, not here.
export const reviewImportItemSchema = z.object({
  itemId: z.string(),
  decision: z.enum(["ACCEPTED", "EDITED", "REJECTED"]),
  editedData: z.unknown().optional(),
});
export type ReviewImportItemInput = z.infer<typeof reviewImportItemSchema>;

export const sessionIdSchema = z.object({ sessionId: z.string() });

// Server actions accept `File` directly as an argument (Next.js serializes
// it across the client/server boundary) — magic-byte/size validation
// happens in domain/assets/service.ts, not here.
export const stageResumeImportSchema = z.object({
  file: z.instanceof(File),
});
export type StageResumeImportInput = z.infer<typeof stageResumeImportSchema>;
