"use server";

import { uuidv7 } from "uuidv7";
import { createAction } from "@/lib/create-action";
import type { ActionResult } from "@/lib/create-action";
import { db } from "@/lib/db";
import { getDefaultWorkspace } from "@/lib/workspace";
import { contactFormSchema } from "./schemas";
import { messageIdSchema } from "./schemas";

const MIN_FILL_TIME_MS = 3000;

// Not wrapped by createAction — same reasoning as M0's signInAction: no
// actor exists yet, so there's no policy to check. Returns the same
// {ok,data}/{ok,error} envelope shape by convention for the client's sake,
// even though it can't reuse the wrapper itself.
export async function submitContactMessageAction(
  input: unknown,
): Promise<ActionResult<{ submitted: boolean }>> {
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Enter a valid name, email, and message." },
    };
  }

  // Honeypot or too-fast submission: pretend success without writing
  // anything, so a bot gets no signal about what it tripped.
  const isHoneypotTripped = parsed.data.website.length > 0;
  const isTooFast = Date.now() - parsed.data.renderedAt < MIN_FILL_TIME_MS;
  if (isHoneypotTripped || isTooFast) {
    return { ok: true, data: { submitted: true } };
  }

  const workspace = await getDefaultWorkspace();
  await db.contactMessage.create({
    data: {
      id: uuidv7(),
      workspaceId: workspace.id,
      senderName: parsed.data.senderName,
      senderEmail: parsed.data.senderEmail,
      body: parsed.data.body,
    },
  });

  return { ok: true, data: { submitted: true } };
}

export const markMessageReadAction = createAction({
  schema: messageIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    await db.contactMessage.updateMany({
      where: { id: input.id, workspaceId: actor.workspaceId },
      data: { readAt: new Date() },
    });
    return { id: input.id };
  },
});

export const deleteMessageAction = createAction({
  schema: messageIdSchema,
  resource: "content",
  action: "write",
  handler: async (input, { actor }) => {
    // Hard delete, per database-design.md §1/§4.5 — visitor-submitted PII,
    // no soft-delete trash for it.
    const result = await db.contactMessage.deleteMany({
      where: { id: input.id, workspaceId: actor.workspaceId },
    });
    if (result.count === 0) throw new Error("Message not found");
    return { id: input.id };
  },
});
