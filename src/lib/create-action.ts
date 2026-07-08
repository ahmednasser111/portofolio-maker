import type { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getDefaultWorkspace } from "@/lib/workspace";
import { can, type Action, type Resource } from "@/domain/policy/can";
import type { Actor } from "@/domain/policy/roles";

type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ErrorCode;
        message: string;
        fieldErrors?: Record<string, string[] | undefined>;
      };
    };

function fail<T>(code: ErrorCode, message: string): ActionResult<T> {
  return { ok: false, error: { code, message } };
}

// Composes auth -> policy -> Zod validation -> handler -> envelope, so
// every server action gets the same guarantees by construction instead of
// each one remembering to check auth/policy itself (architecture.md §8).
export function createAction<TSchema extends z.ZodType, TOutput>(config: {
  schema: TSchema;
  resource: Resource;
  action: Action;
  handler: (input: z.infer<TSchema>, ctx: { actor: Actor }) => Promise<TOutput>;
}) {
  return async (rawInput: z.input<TSchema>): Promise<ActionResult<TOutput>> => {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("UNAUTHORIZED", "Sign in required.");
    }

    // v1 single-tenant: the actor's membership in the one default workspace.
    // Multi-workspace actor resolution is a SaaS-phase change confined here.
    const workspace = await getDefaultWorkspace();
    const membership = await db.membership.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: workspace.id } },
    });
    if (!membership) {
      return fail("FORBIDDEN", "No access to this workspace.");
    }

    const actor: Actor = {
      userId: session.user.id,
      workspaceId: workspace.id,
      role: membership.role,
    };

    if (!can(actor, config.action, config.resource)) {
      return fail("FORBIDDEN", "Not permitted.");
    }

    const parsed = config.schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Invalid input.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
      };
    }

    try {
      const data = await config.handler(parsed.data, { actor });
      return { ok: true, data };
    } catch (error) {
      console.error(error);
      return fail("INTERNAL", "Something went wrong.");
    }
  };
}
