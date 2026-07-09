import { z } from "zod";

export const navigationItemIdSchema = z.object({ id: z.string() });

export const setNavigationItemEnabledSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
});

export const renameNavigationItemSchema = z.object({
  id: z.string(),
  customLabel: z.string().trim().max(60),
});

export const moveNavigationItemSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});
