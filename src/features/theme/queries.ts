import { db } from "@/lib/db";
import { themeTokensSchema, DEFAULT_THEME_TOKENS, type ThemeTokens } from "./token-schema";

export async function getActiveTheme(workspaceId: string) {
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: { activeTheme: true },
  });
  return workspace.activeTheme;
}

// Falls back to the built-in default (and re-validates on read, per the
// schema-versioned-JSON convention) so a malformed row can never break
// public rendering.
export async function getActiveThemeTokens(workspaceId: string): Promise<ThemeTokens> {
  const theme = await getActiveTheme(workspaceId);
  if (!theme) return DEFAULT_THEME_TOKENS;
  const parsed = themeTokensSchema.safeParse(theme.tokens);
  return parsed.success ? parsed.data : DEFAULT_THEME_TOKENS;
}

export function listPresetThemes() {
  return db.theme.findMany({ where: { isPreset: true }, orderBy: { createdAt: "asc" } });
}
