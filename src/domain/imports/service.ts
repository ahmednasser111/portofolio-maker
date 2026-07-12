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
import { toRichTextDoc } from "@/lib/rich-text";
import { uniqueSlug } from "@/lib/slug";
import { nextSortOrder } from "@/lib/sort-order";
import { projectDraftSchema } from "./target-schemas";
import type { StagedItemDraft } from "@/domain/providers/types";

// Generic, provider-agnostic staging/review/commit pipeline (architecture.md
// §12): only session *creation* differs per provider (GitHub repo selection
// vs, in M4, a resume upload). Everything from here down doesn't know or
// care which provider produced the drafts.

// GitHub is synchronous (no LLM step) so sessions go straight to REVIEWING —
// PROCESSING is reserved for M4's async resume extraction.
export async function stageImportSession(params: {
  workspaceId: string;
  provider: ProviderType;
  createdById: string;
  rawPayload: unknown;
  drafts: StagedItemDraft[];
}) {
  const { workspaceId, provider, createdById, rawPayload, drafts } = params;

  // Duplicate detection against already-imported content (architecture.md
  // §6.1 step 4) — currently only PROJECT targets exist (GitHub), so this
  // only checks Project. M4 targets will extend this per-targetType.
  const externalIds = drafts.map((d) => d.externalId);
  const existingProjects = await db.project.findMany({
    where: { workspaceId, source: providerToContentSource(provider), externalId: { in: externalIds }, deletedAt: null },
    select: { id: true, externalId: true },
  });
  const duplicateByExternalId = new Map(existingProjects.map((p) => [p.externalId, p.id]));

  const session = await db.importSession.create({
    data: {
      id: uuidv7(),
      workspaceId,
      provider,
      status: ImportSessionStatus.REVIEWING,
      rawPayload: rawPayload as Prisma.InputJsonValue,
      payloadSchemaVersion: 1,
      createdById,
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

  return session;
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
    if (item.targetType !== ImportTargetType.PROJECT) {
      // M4 targets (experience/education/skill/...) land when resume import does.
      continue;
    }

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
      data: {
        status: ImportItemStatus.COMMITTED,
        createdEntityType: "Project",
        createdEntityId: project.id,
      },
    });
  }

  return db.importSession.update({
    where: { id: session.id },
    data: { status: ImportSessionStatus.COMMITTED, committedAt: new Date() },
  });
}

function validateTargetData(targetType: ImportTargetType, data: unknown): unknown {
  if (targetType === ImportTargetType.PROJECT) {
    return projectDraftSchema.parse(data);
  }
  throw new Error(`No validator wired for target type ${targetType} yet.`);
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
