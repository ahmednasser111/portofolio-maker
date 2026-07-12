import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "./env";

// Provider connection tokens at rest (ProviderConnection.encryptedToken).
// AES-256-GCM: random 12-byte IV per encryption, 16-byte auth tag appended,
// all base64-joined as `${iv}.${authTag}.${ciphertext}` in one column.
// `keyVersion` lives alongside on the row (not in this module) so a future
// key rotation is a background re-encrypt job, not a crisis — see
// database-design.md §14.7.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function currentKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "base64");
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, currentKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ".",
  );
}

export function decryptToken(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted token.");
  }

  const decipher = createDecipheriv(ALGORITHM, currentKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
