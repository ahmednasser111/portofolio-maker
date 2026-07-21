import { z } from "zod";

export const availabilityOptions = ["AVAILABLE", "UNAVAILABLE", "OPEN_TO_OFFERS"] as const;

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email");

export const upsertProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Required").max(120),
  position: z.string().trim().max(120),
  headline: z.string().trim().max(200),
  bio: z.string().trim().max(5000),
  location: z.string().trim().max(120),
  availability: z.enum(availabilityOptions).or(z.literal("")),
  email: optionalEmail,
  phone: z.string().trim().max(40),
  heroCtaLabel: z.string().trim().max(60),
  // No URL validation — this is often an internal path (/projects, #contact)
  // rather than an absolute external URL.
  heroCtaUrl: z.string().trim().max(500),
});

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;

// Avatar/public-resume are file uploads (Asset-backed, M4) — handled by
// separate one-shot actions (uploadAvatarAction/uploadProfileResumeAction),
// not bundled into the text-field upsert above.
export const uploadAvatarSchema = z.object({ file: z.instanceof(File) });
export const uploadProfileResumeSchema = z.object({ file: z.instanceof(File) });
