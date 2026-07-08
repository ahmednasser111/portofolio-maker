import { db } from "./db";

// v1 is single-tenant: there is exactly one workspace, so "resolve the
// tenant" is a constant lookup rather than hostname/session routing.
// Multi-tenant resolution (by hostname, or from session) is a SaaS-phase
// change confined to this function — see architecture.md §14.
export async function getDefaultWorkspace() {
  return db.workspace.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
  });
}
