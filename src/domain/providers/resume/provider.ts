import { AssetKind, ImportTargetType, ProviderType } from "@prisma/client";
import { createAsset } from "@/domain/assets/service";
import { extractPdfText } from "@/lib/pdf";
import { extractResumeData, type ResumeExtractionResult } from "@/lib/llm";
import { createProcessingSession, stageItemsIntoSession, failImportSession } from "@/domain/imports/service";
import { ActionError } from "@/lib/create-action";
import type { StagedItemDraft } from "@/domain/providers/types";

// Resume has no connection step (plain upload) and its extraction is async
// relative to session creation (architecture.md §6.2), so it doesn't
// implement the ConnectionProvider/ImportProvider interfaces in
// domain/providers/types.ts — those model token-based connect+list, which
// doesn't apply here. It plugs into the same stage->review->commit pipeline
// via `stageItemsIntoSession` directly, same as GitHub does through
// `stageImportSession`.
export async function stageResumeImport(params: {
  workspaceId: string;
  createdById: string;
  filename: string;
  bytes: Buffer;
}) {
  // Upload + validate first — if the file isn't actually a PDF, fail before
  // any session row exists (createAsset throws ActionError VALIDATION).
  const asset = await createAsset({
    workspaceId: params.workspaceId,
    kind: AssetKind.RESUME,
    filename: params.filename,
    bytes: params.bytes,
  });

  const session = await createProcessingSession({
    workspaceId: params.workspaceId,
    provider: ProviderType.RESUME,
    createdById: params.createdById,
    sourceAssetId: asset.id,
  });

  try {
    const text = await extractPdfText(params.bytes);
    if (text.length < 20) {
      throw new Error("Could not extract readable text from this PDF — it may be a scanned image, not real text.");
    }

    const extracted = await extractResumeData(text);
    const drafts = toStagedDrafts(extracted);

    if (drafts.length === 0) {
      throw new Error("The resume didn't yield any recognizable experience, education, or skills.");
    }

    return await stageItemsIntoSession({
      sessionId: session.id,
      workspaceId: params.workspaceId,
      provider: ProviderType.RESUME,
      drafts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume extraction failed.";
    await failImportSession({ sessionId: session.id, error: message });
    throw new ActionError("PROVIDER_ERROR", message);
  }
}

function toStagedDrafts(extracted: ResumeExtractionResult): StagedItemDraft[] {
  const drafts: StagedItemDraft[] = [];

  if (extracted.profileSummary) {
    drafts.push({
      targetType: ImportTargetType.PROFILE_SUMMARY,
      externalId: "profile-summary",
      data: extracted.profileSummary,
    });
  }

  for (const exp of extracted.experience) {
    drafts.push({
      targetType: ImportTargetType.EXPERIENCE,
      externalId: `experience:${exp.company.trim().toLowerCase()}|${exp.role.trim().toLowerCase()}`,
      data: exp,
    });
  }

  for (const edu of extracted.education) {
    drafts.push({
      targetType: ImportTargetType.EDUCATION,
      externalId: `education:${edu.institution.trim().toLowerCase()}|${(edu.degree ?? "").trim().toLowerCase()}`,
      data: edu,
    });
  }

  for (const skill of extracted.skills) {
    drafts.push({
      targetType: ImportTargetType.SKILL,
      externalId: `skill:${skill.name.trim().toLowerCase()}`,
      data: skill,
    });
  }

  return drafts;
}
