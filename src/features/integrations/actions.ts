"use server";

import { uuidv7 } from "uuidv7";
import { ConnectionStatus, ProjectLinkType, type Prisma } from "@prisma/client";
import { createAction, ActionError } from "@/lib/create-action";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { getConnectionProvider } from "@/domain/providers/registry";
import { fetchVercelProjects, fetchVercelProductionUrl } from "@/domain/providers/vercel/client";
import { getDecryptedToken } from "./queries";
import {
  connectProviderSchema,
  disconnectProviderSchema,
  noInputSchema,
  attachVercelUrlSchema,
} from "./schemas";

export const connectProviderAction = createAction({
  schema: connectProviderSchema,
  resource: "integrations",
  action: "write",
  handler: async (input, { actor }) => {
    const connectionProvider = getConnectionProvider(input.provider);

    const accountMeta = await connectionProvider.verifyToken(input.token).catch((error: unknown) => {
      throw new ActionError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "Could not verify token.",
      );
    });

    const shared = {
      encryptedToken: encryptToken(input.token),
      accountMeta: accountMeta as unknown as Prisma.InputJsonValue,
      status: ConnectionStatus.ACTIVE,
      connectedAt: new Date(),
      lastCheckedAt: new Date(),
    };

    await db.providerConnection.upsert({
      where: { workspaceId_provider: { workspaceId: actor.workspaceId, provider: input.provider } },
      create: { id: uuidv7(), workspaceId: actor.workspaceId, provider: input.provider, ...shared },
      update: shared,
    });

    return { provider: input.provider, username: accountMeta.username };
  },
});

export const disconnectProviderAction = createAction({
  schema: disconnectProviderSchema,
  resource: "integrations",
  action: "write",
  handler: async (input, { actor }) => {
    await db.providerConnection.deleteMany({
      where: { workspaceId: actor.workspaceId, provider: input.provider },
    });
    return { provider: input.provider };
  },
});

async function requireVercelToken(workspaceId: string): Promise<string> {
  const token = await getDecryptedToken(workspaceId, "VERCEL");
  if (!token) throw new ActionError("PROVIDER_ERROR", "Connect Vercel first.");
  return token;
}

export const listVercelProjectsAction = createAction({
  schema: noInputSchema,
  resource: "integrations",
  action: "read",
  handler: async (_input, { actor }) => {
    const token = await requireVercelToken(actor.workspaceId);
    return fetchVercelProjects(token).catch((error: unknown) => {
      throw new ActionError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "Vercel API error.",
      );
    });
  },
});

// Vercel is a linking-only provider (architecture.md §12) — this never
// touches the import pipeline. It resolves the selected Vercel project's
// current production URL and writes it straight onto a LIVE_DEMO
// ProjectLink, replacing any prior one for that project.
export const attachVercelUrlAction = createAction({
  schema: attachVercelUrlSchema,
  resource: "integrations",
  action: "write",
  handler: async (input, { actor }) => {
    const token = await requireVercelToken(actor.workspaceId);
    const project = await db.project.findFirst({
      where: { id: input.projectId, workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new ActionError("NOT_FOUND", "Project not found.");

    const url = await fetchVercelProductionUrl(token, input.vercelProjectId).catch(
      (error: unknown) => {
        throw new ActionError(
          "PROVIDER_ERROR",
          error instanceof Error ? error.message : "Vercel API error.",
        );
      },
    );
    if (!url) {
      throw new ActionError("PROVIDER_ERROR", "That Vercel project has no production deployment yet.");
    }

    const existingLink = await db.projectLink.findFirst({
      where: { projectId: project.id, type: ProjectLinkType.LIVE_DEMO },
    });

    if (existingLink) {
      await db.projectLink.update({ where: { id: existingLink.id }, data: { url } });
    } else {
      const siblings = await db.projectLink.findMany({
        where: { projectId: project.id },
        select: { sortOrder: true },
      });
      const sortOrder = siblings.length === 0 ? 1000 : Math.max(...siblings.map((s) => s.sortOrder)) + 1000;
      await db.projectLink.create({
        data: {
          id: uuidv7(),
          workspaceId: actor.workspaceId,
          projectId: project.id,
          type: ProjectLinkType.LIVE_DEMO,
          url,
          sortOrder,
        },
      });
    }

    return { projectId: project.id, url };
  },
});
