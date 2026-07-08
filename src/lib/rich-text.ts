import { z } from "zod";

// Schema-versioned plain-text "rich text" (database-design.md §1, Recommendation #8).
// A real block-based editor is a compatible upgrade later (bump schemaVersion),
// not a migration — v1 is deliberately just a textarea in, paragraphs out.

export const richTextDocSchema = z.object({
  schemaVersion: z.literal(1),
  content: z.string(),
});
export type RichTextDoc = z.infer<typeof richTextDocSchema>;

export function toRichTextDoc(content: string): RichTextDoc {
  return { schemaVersion: 1, content };
}

export function richTextToParagraphs(doc: unknown): string[] {
  const parsed = richTextDocSchema.safeParse(doc);
  if (!parsed.success) return [];
  return parsed.data.content.split(/\n{2,}/).filter((p) => p.trim().length > 0);
}

export const richTextListSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(z.string()),
});
export type RichTextListDoc = z.infer<typeof richTextListSchema>;

export function toRichTextListDoc(items: string[]): RichTextListDoc {
  return { schemaVersion: 1, items: items.filter((i) => i.trim().length > 0) };
}

export function richTextListItems(doc: unknown): string[] {
  const parsed = richTextListSchema.safeParse(doc);
  if (!parsed.success) return [];
  return parsed.data.items;
}
