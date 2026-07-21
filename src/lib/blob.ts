import { put, del, getDownloadUrl } from "@vercel/blob";
import { uuidv7 } from "uuidv7";
import type { AssetKind } from "@prisma/client";

// Thin adapter over Vercel Blob — architecture.md's `blob.ts` adapter,
// called out against the "Vercel lock-in" risk (§17). Swap this file if the
// storage backend ever changes; nothing outside it should import
// `@vercel/blob` directly.

export async function uploadBlob(params: {
  workspaceId: string;
  kind: AssetKind;
  filename: string;
  contentType: string;
  bytes: Buffer;
}): Promise<{ url: string }> {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
  const key = `${params.workspaceId}/${params.kind.toLowerCase()}/${uuidv7()}-${safeName}`;

  const blob = await put(key, params.bytes, {
    access: "public",
    contentType: params.contentType,
    addRandomSuffix: false,
  });

  return { url: blob.url };
}

export async function deleteBlob(url: string): Promise<void> {
  await del(url);
}

// Vercel Blob serves `.url` inline with a computed Content-Type/Disposition;
// this derives the variant that forces a browser download (architecture.md
// §13 risk #6 — never trust the client, but here it's the server-computed
// URL, not a header we set ourselves).
export function getAssetDownloadUrl(url: string): string {
  return getDownloadUrl(url);
}
