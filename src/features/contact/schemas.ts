import { z } from "zod";

export const contactFormSchema = z.object({
  senderName: z.string().trim().min(1, "Required").max(120),
  senderEmail: z.string().trim().email("Enter a valid email"),
  body: z.string().trim().min(1, "Required").max(4000),
  // Honeypot — hidden from real users via CSS; bots that fill every field
  // trip this. Deliberately NOT constrained to empty here — a non-empty
  // value must still parse successfully so the handler can silently
  // pretend success instead of surfacing a validation error that would
  // tip a bot off to what it tripped.
  website: z.string().optional().default(""),
  // Time-trap — ms-since-epoch captured when the form mounted. Rejects
  // submissions that arrive faster than a human could plausibly type.
  renderedAt: z.number(),
});
export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const messageIdSchema = z.object({ id: z.string() });
