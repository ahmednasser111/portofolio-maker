import { getDocumentProxy, extractText } from "unpdf";

// Deterministic extraction step (architecture.md §6.2 step 2) — plain text
// out, no LLM involved here. unpdf over pdf-parse: no filesystem/native
// bindings, safe to run in a Vercel serverless function.
export async function extractPdfText(bytes: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}
