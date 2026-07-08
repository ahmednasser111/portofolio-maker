import { z } from "zod";

export const availabilityOptions = ["AVAILABLE", "UNAVAILABLE", "OPEN_TO_OFFERS"] as const;

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || z.string().url().safeParse(v).success, "Enter a valid URL");

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
  avatarUrl: optionalUrl,
  location: z.string().trim().max(120),
  availability: z.enum(availabilityOptions).or(z.literal("")),
  email: optionalEmail,
  phone: z.string().trim().max(40),
  heroCtaLabel: z.string().trim().max(60),
  // Not run through optionalUrl — this is often an internal path (/projects,
  // #contact) rather than an absolute external URL.
  heroCtaUrl: z.string().trim().max(500),
  resumeUrl: optionalUrl,
});

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
