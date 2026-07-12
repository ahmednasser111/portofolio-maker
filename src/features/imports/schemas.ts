import { z } from "zod";
import { projectDraftSchema } from "@/domain/imports/target-schemas";

export const noInputSchema = z.object({});

export const stageGithubImportSchema = z.object({
  repoIds: z.array(z.string()).min(1, "Select at least one repository."),
});
export type StageGithubImportInput = z.infer<typeof stageGithubImportSchema>;

export const reviewImportItemSchema = z.object({
  itemId: z.string(),
  decision: z.enum(["ACCEPTED", "EDITED", "REJECTED"]),
  editedData: projectDraftSchema.optional(),
});
export type ReviewImportItemInput = z.infer<typeof reviewImportItemSchema>;

export const sessionIdSchema = z.object({ sessionId: z.string() });
