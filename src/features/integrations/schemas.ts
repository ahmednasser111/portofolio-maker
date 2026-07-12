import { z } from "zod";
import { ProviderType } from "@prisma/client";

export const connectProviderSchema = z.object({
  provider: z.nativeEnum(ProviderType),
  token: z.string().trim().min(1, "Required"),
});
export type ConnectProviderInput = z.infer<typeof connectProviderSchema>;

export const disconnectProviderSchema = z.object({
  provider: z.nativeEnum(ProviderType),
});
export type DisconnectProviderInput = z.infer<typeof disconnectProviderSchema>;

export const noInputSchema = z.object({});

export const attachVercelUrlSchema = z.object({
  projectId: z.string(),
  vercelProjectId: z.string(),
});
export type AttachVercelUrlInput = z.infer<typeof attachVercelUrlSchema>;
