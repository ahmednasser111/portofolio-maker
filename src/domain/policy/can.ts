import type { Actor, MembershipRole } from "./roles";

// Resource categories from architecture.md §7. Concrete per-feature actions
// (e.g. "project:delete") get added as those features land in M1+; the
// shape here is deliberately small until there's real behavior to gate.
export type Resource = "content" | "theme" | "analytics" | "integrations" | "settings";
export type Action = "read" | "write";

const MATRIX: Record<MembershipRole, Record<Resource, Action[]>> = {
  OWNER: {
    content: ["read", "write"],
    theme: ["read", "write"],
    analytics: ["read", "write"],
    integrations: ["read", "write"],
    settings: ["read", "write"],
  },
  ADMIN: {
    content: ["read", "write"],
    theme: ["read", "write"],
    analytics: ["read", "write"],
    integrations: ["read"],
    settings: ["read"],
  },
  EDITOR: {
    content: ["read", "write"],
    theme: ["read"],
    analytics: ["read"],
    integrations: [],
    settings: [],
  },
  VIEWER: {
    content: ["read"],
    theme: ["read"],
    analytics: ["read"],
    integrations: [],
    settings: [],
  },
};

export function can(actor: Actor, action: Action, resource: Resource): boolean {
  return MATRIX[actor.role]?.[resource]?.includes(action) ?? false;
}
