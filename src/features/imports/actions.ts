"use server";

import { ProviderType } from "@prisma/client";
import { createAction, ActionError } from "@/lib/create-action";
import { getDecryptedToken } from "@/features/integrations/queries";
import { getImportProvider } from "@/domain/providers/registry";
import type { GithubRepo } from "@/domain/providers/github/client";
import {
  stageImportSession,
  reviewImportItem,
  commitImportSession,
  discardImportSession,
} from "@/domain/imports/service";
import { stageResumeImport } from "@/domain/providers/resume/provider";
import {
  noInputSchema,
  stageGithubImportSchema,
  reviewImportItemSchema,
  sessionIdSchema,
  stageResumeImportSchema,
} from "./schemas";

async function requireGithubToken(workspaceId: string): Promise<string> {
  const token = await getDecryptedToken(workspaceId, "GITHUB");
  if (!token) throw new ActionError("PROVIDER_ERROR", "Connect GitHub first.");
  return token;
}

function toRepoSummary(repo: GithubRepo) {
  return {
    id: String(repo.id),
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    private: repo.private,
    fork: repo.fork,
  };
}

export const listGithubReposAction = createAction({
  schema: noInputSchema,
  resource: "integrations",
  action: "read",
  handler: async (_input, { actor }) => {
    const token = await requireGithubToken(actor.workspaceId);
    const provider = getImportProvider(ProviderType.GITHUB);
    const repos = (await provider.listImportables(token).catch((error: unknown) => {
      throw new ActionError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "GitHub API error.",
      );
    })) as GithubRepo[];
    return repos.map(toRepoSummary);
  },
});

export const stageGithubImportAction = createAction({
  schema: stageGithubImportSchema,
  resource: "integrations",
  action: "write",
  handler: async (input, { actor }) => {
    const token = await requireGithubToken(actor.workspaceId);
    const provider = getImportProvider(ProviderType.GITHUB);
    const allRepos = (await provider.listImportables(token)) as GithubRepo[];
    const selected = allRepos.filter((repo) => input.repoIds.includes(String(repo.id)));
    if (selected.length === 0) {
      throw new ActionError("VALIDATION", "No repositories selected.");
    }

    const session = await stageImportSession({
      workspaceId: actor.workspaceId,
      provider: ProviderType.GITHUB,
      createdById: actor.userId,
      rawPayload: selected,
      drafts: provider.mapToStagedItems(selected),
    });

    return { sessionId: session.id };
  },
});

export const stageResumeImportAction = createAction({
  schema: stageResumeImportSchema,
  resource: "integrations",
  action: "write",
  handler: async (input, { actor }) => {
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const session = await stageResumeImport({
      workspaceId: actor.workspaceId,
      createdById: actor.userId,
      filename: input.file.name,
      bytes,
    });
    return { sessionId: session.id };
  },
});

export const reviewImportItemAction = createAction({
  schema: reviewImportItemSchema,
  resource: "integrations",
  action: "write",
  handler: async (input, { actor }) => {
    const item = await reviewImportItem({
      itemId: input.itemId,
      workspaceId: actor.workspaceId,
      decision: input.decision,
      editedData: input.editedData,
    });
    return { id: item.id, status: item.status };
  },
});

export const commitImportSessionAction = createAction({
  schema: sessionIdSchema,
  resource: "integrations",
  action: "write",
  handler: async (input, { actor }) => {
    const session = await commitImportSession({
      sessionId: input.sessionId,
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
    });
    return { id: session.id, status: session.status };
  },
});

export const discardImportSessionAction = createAction({
  schema: sessionIdSchema,
  resource: "integrations",
  action: "write",
  handler: async (input, { actor }) => {
    const session = await discardImportSession({
      sessionId: input.sessionId,
      workspaceId: actor.workspaceId,
    });
    return { id: session.id, status: session.status };
  },
});
