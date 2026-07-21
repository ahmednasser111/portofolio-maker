import crypto from "node:crypto";
import { AssetKind } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { db } from "@/lib/db";
import { uploadBlob } from "@/lib/blob";
import { ActionError } from "@/lib/create-action";

// Size caps per kind (architecture.md §13 risk #6). Deliberately generous —
// this is an admin-only upload surface (single operator, not public), the
// cap exists to stop accidental multi-hundred-MB uploads, not to be tight.
const MAX_BYTES: Record<AssetKind, number> = {
  AVATAR: 5 * 1024 * 1024,
  OG_IMAGE: 5 * 1024 * 1024,
  RESUME: 15 * 1024 * 1024,
  PROJECT_MEDIA: 10 * 1024 * 1024,
  OTHER: 10 * 1024 * 1024,
};

const IMAGE_KINDS: AssetKind[] = [AssetKind.AVATAR, AssetKind.OG_IMAGE];

// Magic-byte sniffing — never trust the browser-supplied File.type or the
// filename extension (architecture.md §13 risk #6: "PDF-only via magic-byte
// sniffing, not extension/MIME header trust").
function sniffMimeType(bytes: Buffer): string | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "application/pdf";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    (bytes.subarray(0, 6).toString("latin1") === "GIF87a" || bytes.subarray(0, 6).toString("latin1") === "GIF89a")
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function assertValidForKind(kind: AssetKind, sniffed: string | null): asserts sniffed is string {
  const expectsPdf = kind === AssetKind.RESUME;
  const expectsImage = IMAGE_KINDS.includes(kind);
  if (!sniffed || (expectsPdf && sniffed !== "application/pdf") || (expectsImage && !sniffed.startsWith("image/"))) {
    throw new ActionError("VALIDATION", expectsPdf ? "File is not a valid PDF." : "File is not a valid image.");
  }
}

export async function createAsset(params: {
  workspaceId: string;
  kind: AssetKind;
  filename: string;
  bytes: Buffer;
}) {
  const cap = MAX_BYTES[params.kind];
  if (params.bytes.byteLength > cap) {
    throw new ActionError("VALIDATION", `File too large (max ${Math.round(cap / (1024 * 1024))}MB).`);
  }

  const sniffed = sniffMimeType(params.bytes);
  assertValidForKind(params.kind, sniffed);

  const checksum = crypto.createHash("sha256").update(params.bytes).digest("hex");
  const { url } = await uploadBlob({
    workspaceId: params.workspaceId,
    kind: params.kind,
    filename: params.filename,
    contentType: sniffed,
    bytes: params.bytes,
  });

  return db.asset.create({
    data: {
      id: uuidv7(),
      workspaceId: params.workspaceId,
      kind: params.kind,
      url,
      filename: params.filename,
      mimeType: sniffed,
      sizeBytes: params.bytes.byteLength,
      checksum,
    },
  });
}

// Soft-deletes the asset it replaces — blob GC is a future background job,
// not synchronous with the row (database-design.md §4.7).
export async function replaceAsset(params: {
  workspaceId: string;
  kind: AssetKind;
  previousAssetId: string | null;
  filename: string;
  bytes: Buffer;
}) {
  const asset = await createAsset(params);
  if (params.previousAssetId) {
    await db.asset.update({
      where: { id: params.previousAssetId },
      data: { deletedAt: new Date() },
    });
  }
  return asset;
}
