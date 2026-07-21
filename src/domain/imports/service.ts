import { uuidv7 } from "uuidv7";
import {
  ContentSource,
  ImportItemStatus,
  ImportSessionStatus,
  ImportTargetType,
  ProviderType,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { toRichTextDoc, toRichTextListDoc } from "@/lib/rich-text";
import { uniqueSlug } from "@/lib/slug";
import { nextSortOrder } from "@/lib/sort-order";
import { ActionError } from "@/lib/create-action";
import {
  projectDraftSchema,
  experienceDraftSchema,
  educationDraftSchema,
  skillDraftSchema,
  profileSummaryDraftSchema,
  type ExperienceDraft,
  type EducationDraft,
  type SkillDraft,
} from "./target-schemas";
import type { StagedItemDraft } from "@/domain/providers/types";

// Generic, provider-agnostic staging/review/commit pipeline (architecture.md
// §12): only session *creation* differs per provider (GitHub repo selection
// vs, in M4, a resume upload). Everything from here down doesn't know or
// care which provider produced the drafts.

// GitHub is synchronous (no LLM step) so sessions go straight to REVIEWING.
// Resume sessions go through `createProcessingSession` + `stageItemsIntoSession`
// instead (PENDING -> PROCESSING while the LLM runs -> REVIEWING/FAILED),
// since that step can fail independently of session creation.
export async function stageImportSession(params: {
  workspaceId: string;
  provider: ProviderType;
  createdById: string;
  rawPayload: unknown;
  drafts: StagedItemDraft[];
}) {
  const session = await db.importSession.create({
    data: {
      id: uuidv7(),
      workspaceId: params.workspaceId,
      provider: params.provider,
      status: ImportSessionStatus.PENDING,
      rawPayload: params.rawPayload as Prisma.InputJsonValue,
      payloadSchemaVersion: 1,
      createdById: params.createdById,
    },
  });

  return stageItemsIntoSession({
    sessionId: session.id,
    workspaceId: params.workspaceId,
    provider: params.provider,
    drafts: params.drafts,
  });
}

// Split out of `stageImportSession` for M4: resume import creates the
// session eagerly (status PROCESSING, sourceAssetId set) before the LLM
// call, so a failed extraction still leaves an inspectable session row
// instead of losing the uploaded PDF's session entirely.
export async function createProcessingSession(params: {
  workspaceId: string;
  provider: ProviderType;
  createdById: string;
  sourceAssetId: string;
}) {
  return db.importSession.create({
    data: {
      id: uuidv7(),
      workspaceId: params.workspaceId,
      provider: params.provider,
      status: ImportSessionStatus.PROCESSING,
      sourceAssetId: params.sourceAssetId,
      payloadSchemaVersion: 1,
      createdById: params.createdById,
    },
  });
}

export async function failImportSession(params: { sessionId: string; error: string }) {
  return db.importSession.update({
    where: { id: params.sessionId },
    data: { status: ImportSessionStatus.FAILED, error: params.error },
  });
}

export async function stageItemsIntoSession(params: {
  sessionId: string;
  workspaceId: string;
  provider: ProviderType;
  drafts: StagedItemDraft[];
}) {
  const { sessionId, workspaceId, provider, drafts } = params;

  // Duplicate detection against already-imported content (architecture.md
  // §6.1 step 4 / database-design.md §9.6): externalId match for PROJECT,
  // normalized natural keys for the M4 targets. Advisory at staging only —
  // revalidated at commit time inside the commit transaction.
  const duplicateByExternalId = await findDuplicateExternalIds(workspaceId, provider, drafts);

  return db.importSession.update({
    where: { id: sessionId },
    data: {
      status: ImportSessionStatus.REVIEWING,
      items: {
        create: drafts.map((draft) => {
          const duplicateOfId = duplicateByExternalId.get(draft.externalId) ?? null;
          return {
            id: uuidv7(),
            workspaceId,
            targetType: draft.targetType,
            data: draft.data as Prisma.InputJsonValue,
            dataSchemaVersion: 1,
            status: duplicateOfId ? ImportItemStatus.SKIPPED_DUPLICATE : ImportItemStatus.PENDING,
            duplicateOfId,
            externalId: draft.externalId,
          };
        }),
      },
    },
    include: { items: true },
  });
}

async function findDuplicateExternalIds(
  workspaceId: string,
  provider: ProviderType,
  drafts: StagedItemDraft[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const projectDrafts = drafts.filter((d) => d.targetType === ImportTargetType.PROJECT);
  if (projectDrafts.length > 0) {
    const existing = await db.project.findMany({
      where: {
        workspaceId,
        source: providerToContentSource(provider),
        externalId: { in: projectDrafts.map((d) => d.externalId) },
        deletedAt: null,
      },
      select: { id: true, externalId: true },
    });
    for (const row of existing) if (row.externalId) result.set(row.externalId, row.id);
  }

  const skillDrafts = drafts.filter((d) => d.targetType === ImportTargetType.SKILL);
  if (skillDrafts.length > 0) {
    const existing = await db.skill.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });
    const byName = new Map(existing.map((s) => [s.name.trim().toLowerCase(), s.id]));
    for (const draft of skillDrafts) {
      const data = draft.data as SkillDraft;
      const match = byName.get(data.name.trim().toLowerCase());
      if (match) result.set(draft.externalId, match);
    }
  }

  const experienceDrafts = drafts.filter((d) => d.targetType === ImportTargetType.EXPERIENCE);
  if (experienceDrafts.length > 0) {
    const existing = await db.experience.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, company: true, role: true },
    });
    for (const draft of experienceDrafts) {
      const data = draft.data as ExperienceDraft;
      const match = existing.find(
        (e) =>
          e.company.trim().toLowerCase() === data.company.trim().toLowerCase() &&
          e.role.trim().toLowerCase() === data.role.trim().toLowerCase(),
      );
      if (match) result.set(draft.externalId, match.id);
    }
  }

  const educationDrafts = drafts.filter((d) => d.targetType === ImportTargetType.EDUCATION);
  if (educationDrafts.length > 0) {
    const existing = await db.education.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, institution: true, degree: true },
    });
    for (const draft of educationDrafts) {
      const data = draft.data as EducationDraft;
      const match = existing.find(
        (e) =>
          e.institution.trim().toLowerCase() === data.institution.trim().toLowerCase() &&
          (e.degree ?? "").trim().toLowerCase() === (data.degree ?? "").trim().toLowerCase(),
      );
      if (match) result.set(draft.externalId, match.id);
    }
  }

  // PROFILE_SUMMARY has no natural duplicate concept (singleton target) —
  // never flagged.

  return result;
}

export async function reviewImportItem(params: {
  itemId: string;
  workspaceId: string;
  decision: "ACCEPTED" | "EDITED" | "REJECTED";
  editedData?: unknown;
}) {
  const item = await db.importItem.findFirst({
    where: { id: params.itemId, workspaceId: params.workspaceId },
  });
  if (!item) throw new Error("Import item not found.");
  if (item.status === ImportItemStatus.COMMITTED) {
    throw new Error("Already committed items can't be reviewed again.");
  }

  const data =
    params.decision === "EDITED" ? validateTargetData(item.targetType, params.editedData) : item.data;

  return db.importItem.update({
    where: { id: item.id },
    data: { status: ImportItemStatus[params.decision], data: data as Prisma.InputJsonValue },
  });
}

export async function discardImportSession(params: { sessionId: string; workspaceId: string }) {
  const session = await db.importSession.findFirst({
    where: { id: params.sessionId, workspaceId: params.workspaceId },
  });
  if (!session) throw new Error("Import session not found.");

  return db.importSession.update({
    where: { id: session.id },
    data: { status: ImportSessionStatus.DISCARDED },
  });
}

// "March 2021", "2021-03-01", "2021" all parse fine via the Date
// constructor; anything that doesn't is a review-screen data-quality
// problem, not something to silently coerce (architecture.md §16).
function parseFlexibleDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ActionError("VALIDATION", `Could not parse date "${value}". Edit it before accepting.`);
  }
  return date;
}

// Commits every ACCEPTED/EDITED item into real content rows. Rejected and
// skipped-duplicate items are left as-is (audit trail, not deleted).
// Local edits are never overwritten by this path — commit only ever
// *creates* new rows, it has no update-existing branch (architecture.md §12).
export async function commitImportSession(params: {
  sessionId: string;
  workspaceId: string;
  actorId: string;
}) {
  const session = await db.importSession.findFirst({
    where: { id: params.sessionId, workspaceId: params.workspaceId },
    include: { items: true },
  });
  if (!session) throw new Error("Import session not found.");
  if (session.status === ImportSessionStatus.COMMITTED) {
    throw new Error("Session already committed.");
  }

  const committable = session.items.filter(
    (item) => item.status === ImportItemStatus.ACCEPTED || item.status === ImportItemStatus.EDITED,
  );

  const source = providerToContentSource(session.provider);

  for (const item of committable) {
    if (item.targetType === ImportTargetType.PROJECT) {
      const draft = projectDraftSchema.parse(item.data);
      const slug = await uniqueSlug(draft.title, async (candidate) => {
        const existing = await db.project.findFirst({
          where: { workspaceId: params.workspaceId, slug: candidate, deletedAt: null },
          select: { id: true },
        });
        return existing !== null;
      });
      const siblings = await db.project.findMany({
        where: { workspaceId: params.workspaceId, deletedAt: null },
        select: { id: true, sortOrder: true },
      });

      const project = await db.project.create({
        data: {
          id: uuidv7(),
          workspaceId: params.workspaceId,
          title: draft.title,
          slug,
          summary: draft.summary,
          description: draft.description ? toRichTextDoc(draft.description) : Prisma.JsonNull,
          tags: draft.tags,
          sortOrder: nextSortOrder(siblings),
          source,
          externalId: item.externalId,
          importedAt: new Date(),
          sourceSnapshot: item.data as Prisma.InputJsonValue,
          createdById: params.actorId,
          updatedById: params.actorId,
          links: {
            create: draft.links.map((link, index) => ({
              id: uuidv7(),
              workspaceId: params.workspaceId,
              type: link.type,
              url: link.url,
              sortOrder: (index + 1) * 1000,
            })),
          },
        },
      });

      await db.importItem.update({
        where: { id: item.id },
        data: { status: ImportItemStatus.COMMITTED, createdEntityType: "Project", createdEntityId: project.id },
      });
      continue;
    }

    if (item.targetType === ImportTargetType.EXPERIENCE) {
      const draft = experienceDraftSchema.parse(item.data);
      const siblings = await db.experience.findMany({
        where: { workspaceId: params.workspaceId, deletedAt: null },
        select: { id: true, sortOrder: true },
      });

      const experience = await db.experience.create({
        data: {
          id: uuidv7(),
          workspaceId: params.workspaceId,
          company: draft.company,
          role: draft.role,
          location: draft.location,
          employmentType: draft.employmentType,
          startDate: parseFlexibleDate(draft.startDate),
          endDate: draft.endDate ? parseFlexibleDate(draft.endDate) : null,
          highlights: draft.highlights.length > 0 ? toRichTextListDoc(draft.highlights) : Prisma.JsonNull,
          description: draft.description,
          sortOrder: nextSortOrder(siblings),
          source,
          externalId: item.externalId,
          importedAt: new Date(),
          sourceSnapshot: item.data as Prisma.InputJsonValue,
          createdById: params.actorId,
          updatedById: params.actorId,
        },
      });

      await db.importItem.update({
        where: { id: item.id },
        data: { status: ImportItemStatus.COMMITTED, createdEntityType: "Experience", createdEntityId: experience.id },
      });
      continue;
    }

    if (item.targetType === ImportTargetType.EDUCATION) {
      const draft = educationDraftSchema.parse(item.data);
      const siblings = await db.education.findMany({
        where: { workspaceId: params.workspaceId, deletedAt: null },
        select: { id: true, sortOrder: true },
      });

      const education = await db.education.create({
        data: {
          id: uuidv7(),
          workspaceId: params.workspaceId,
          institution: draft.institution,
          degree: draft.degree,
          field: draft.field,
          startDate: draft.startDate ? parseFlexibleDate(draft.startDate) : null,
          endDate: draft.endDate ? parseFlexibleDate(draft.endDate) : null,
          description: draft.description,
          sortOrder: nextSortOrder(siblings),
          source,
          externalId: item.externalId,
          importedAt: new Date(),
          sourceSnapshot: item.data as Prisma.InputJsonValue,
          createdById: params.actorId,
          updatedById: params.actorId,
        },
      });

      await db.importItem.update({
        where: { id: item.id },
        data: { status: ImportItemStatus.COMMITTED, createdEntityType: "Education", createdEntityId: education.id },
      });
      continue;
    }

    if (item.targetType === ImportTargetType.SKILL) {
      const draft = skillDraftSchema.parse(item.data);

      let category = await db.skillCategory.findFirst({
        where: { workspaceId: params.workspaceId, deletedAt: null, name: { equals: draft.categoryName, mode: "insensitive" } },
      });
      if (!category) {
        const categorySiblings = await db.skillCategory.findMany({
          where: { workspaceId: params.workspaceId, deletedAt: null },
          select: { id: true, sortOrder: true },
        });
        category = await db.skillCategory.create({
          data: {
            id: uuidv7(),
            workspaceId: params.workspaceId,
            name: draft.categoryName,
            sortOrder: nextSortOrder(categorySiblings),
            createdById: params.actorId,
            updatedById: params.actorId,
          },
        });
      }

      const skillSiblings = await db.skill.findMany({
        where: { workspaceId: params.workspaceId, categoryId: category.id, deletedAt: null },
        select: { id: true, sortOrder: true },
      });

      const skill = await db.skill.create({
        data: {
          id: uuidv7(),
          workspaceId: params.workspaceId,
          categoryId: category.id,
          name: draft.name,
          level: draft.level,
          sortOrder: nextSortOrder(skillSiblings),
          source,
          externalId: item.externalId,
          importedAt: new Date(),
          sourceSnapshot: item.data as Prisma.InputJsonValue,
          createdById: params.actorId,
          updatedById: params.actorId,
        },
      });

      await db.importItem.update({
        where: { id: item.id },
        data: { status: ImportItemStatus.COMMITTED, createdEntityType: "Skill", createdEntityId: skill.id },
      });
      continue;
    }

    if (item.targetType === ImportTargetType.PROFILE_SUMMARY) {
      const draft = profileSummaryDraftSchema.parse(item.data);
      const profile = await db.profile.findFirst({ where: { workspaceId: params.workspaceId } });
      if (!profile) {
        throw new ActionError(
          "VALIDATION",
          "Save the Profile section at least once before committing a profile summary from resume import.",
        );
      }

      await db.profile.update({
        where: { id: profile.id },
        data: {
          headline: draft.headline ?? profile.headline,
          ...(draft.bio ? { bio: toRichTextDoc(draft.bio) } : {}),
          updatedById: params.actorId,
        },
      });

      await db.importItem.update({
        where: { id: item.id },
        data: { status: ImportItemStatus.COMMITTED, createdEntityType: "Profile", createdEntityId: profile.id },
      });
      continue;
    }

    // CERTIFICATION etc. — no model/commit target exists yet.
  }

  // Committing a resume import also powers the public resume preview/
  // download — the uploaded PDF becomes Profile.publicResumeAssetId, unless
  // the admin already re-pointed it elsewhere (in which case leave it, this
  // only ever advances forward on commit, never overwritten silently twice).
  if (session.provider === ProviderType.RESUME && session.sourceAssetId) {
    const profile = await db.profile.findFirst({ where: { workspaceId: params.workspaceId } });
    if (profile && profile.publicResumeAssetId !== session.sourceAssetId) {
      const previousAssetId = profile.publicResumeAssetId;
      await db.profile.update({
        where: { id: profile.id },
        data: { publicResumeAssetId: session.sourceAssetId },
      });
      if (previousAssetId) {
        await db.asset.update({ where: { id: previousAssetId }, data: { deletedAt: new Date() } });
      }
    }
  }

  return db.importSession.update({
    where: { id: session.id },
    data: { status: ImportSessionStatus.COMMITTED, committedAt: new Date() },
  });
}

function validateTargetData(targetType: ImportTargetType, data: unknown): unknown {
  switch (targetType) {
    case ImportTargetType.PROJECT:
      return projectDraftSchema.parse(data);
    case ImportTargetType.EXPERIENCE:
      return experienceDraftSchema.parse(data);
    case ImportTargetType.EDUCATION:
      return educationDraftSchema.parse(data);
    case ImportTargetType.SKILL:
      return skillDraftSchema.parse(data);
    case ImportTargetType.PROFILE_SUMMARY:
      return profileSummaryDraftSchema.parse(data);
    default:
      throw new Error(`No validator wired for target type ${targetType} yet.`);
  }
}

function providerToContentSource(provider: ProviderType): ContentSource {
  switch (provider) {
    case ProviderType.GITHUB:
      return ContentSource.GITHUB;
    case ProviderType.RESUME:
      return ContentSource.RESUME;
    default:
      throw new Error(`${provider} is not an import (content-producing) provider.`);
  }
}
