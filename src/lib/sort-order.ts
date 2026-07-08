// Manual ordering convention (database-design.md §7): integer sortOrder,
// gaps of 1000 so inserts don't require renumbering siblings.

export type Orderable = { id: string; sortOrder: number };

export function nextSortOrder(existing: Orderable[]): number {
  if (existing.length === 0) return 1000;
  return Math.max(...existing.map((i) => i.sortOrder)) + 1000;
}

// Returns the [current, sibling] pair whose sortOrder values should be
// swapped to move `targetId` up or down, or null if already at that end.
export function findSwap(
  items: Orderable[],
  targetId: string,
  direction: "up" | "down",
): [Orderable, Orderable] | null {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = sorted.findIndex((i) => i.id === targetId);
  if (index === -1) return null;

  const siblingIndex = direction === "up" ? index - 1 : index + 1;
  if (siblingIndex < 0 || siblingIndex >= sorted.length) return null;

  const current = sorted[index];
  const sibling = sorted[siblingIndex];
  if (!current || !sibling) return null;

  return [current, sibling];
}
