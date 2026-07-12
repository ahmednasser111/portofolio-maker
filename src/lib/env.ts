import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required (pnpm dlx auth secret)"),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  // Provider token encryption (M3). 32 raw bytes, base64-encoded — generate
  // with `openssl rand -base64 32`. See src/lib/crypto.ts.
  ENCRYPTION_KEY: z
    .string()
    .min(1, "ENCRYPTION_KEY is required (openssl rand -base64 32)")
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32)",
    }),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SITE_URL: process.env.SITE_URL,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
});
