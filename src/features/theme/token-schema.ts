import { z } from "zod";

// The complete bounded token schema (architecture.md §10, database-design.md
// §11) — a closed set of *categories and variant enums*, not an escape hatch
// into arbitrary CSS. New configurability should mean a new field/variant
// here, never a raw style/class passthrough — that distinction is the
// architecture doc's own stated guardrail against theme scope creep (§16).

const colorSetSchema = z.object({
  background: z.string().min(1),
  foreground: z.string().min(1),
  primary: z.string().min(1),
  primaryForeground: z.string().min(1),
  muted: z.string().min(1),
  mutedForeground: z.string().min(1),
  accent: z.string().min(1),
  accentForeground: z.string().min(1),
  border: z.string().min(1),
});
export type ColorSet = z.infer<typeof colorSetSchema>;

export const themeTokensSchema = z.object({
  schemaVersion: z.literal(1),
  typography: z.object({
    fontFamily: z.string().min(1),
    scale: z.object({
      xs: z.string().min(1),
      sm: z.string().min(1),
      base: z.string().min(1),
      lg: z.string().min(1),
      xl: z.string().min(1),
      "2xl": z.string().min(1),
      "3xl": z.string().min(1),
    }),
    weights: z.object({
      normal: z.string().min(1),
      medium: z.string().min(1),
      bold: z.string().min(1),
    }),
    lineHeights: z.object({
      tight: z.string().min(1),
      normal: z.string().min(1),
      relaxed: z.string().min(1),
    }),
  }),
  colors: z.object({
    light: colorSetSchema,
    dark: colorSetSchema,
  }),
  spacing: z.object({
    xs: z.string().min(1),
    sm: z.string().min(1),
    md: z.string().min(1),
    lg: z.string().min(1),
    xl: z.string().min(1),
  }),
  radius: z.object({
    sm: z.string().min(1),
    md: z.string().min(1),
    lg: z.string().min(1),
  }),
  shadows: z.object({
    sm: z.string().min(1),
    md: z.string().min(1),
    lg: z.string().min(1),
  }),
  animation: z.object({
    enabled: z.boolean(),
    intensity: z.enum(["subtle", "normal", "playful"]),
    respectReducedMotion: z.boolean(),
  }),
  layout: z.object({
    hero: z.enum(["centered", "split"]),
    projects: z.enum(["grid", "list"]),
  }),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  schemaVersion: 1,
  typography: {
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, sans-serif",
    scale: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
    },
    weights: { normal: "400", medium: "500", bold: "700" },
    lineHeights: { tight: "1.25", normal: "1.5", relaxed: "1.75" },
  },
  colors: {
    light: {
      background: "oklch(1 0 0)",
      foreground: "oklch(0.145 0 0)",
      primary: "oklch(0.205 0 0)",
      primaryForeground: "oklch(0.985 0 0)",
      muted: "oklch(0.97 0 0)",
      mutedForeground: "oklch(0.556 0 0)",
      accent: "oklch(0.97 0 0)",
      accentForeground: "oklch(0.205 0 0)",
      border: "oklch(0.922 0 0)",
    },
    dark: {
      background: "oklch(0.145 0 0)",
      foreground: "oklch(0.985 0 0)",
      primary: "oklch(0.985 0 0)",
      primaryForeground: "oklch(0.205 0 0)",
      muted: "oklch(0.269 0 0)",
      mutedForeground: "oklch(0.708 0 0)",
      accent: "oklch(0.269 0 0)",
      accentForeground: "oklch(0.985 0 0)",
      border: "oklch(0.269 0 0)",
    },
  },
  spacing: { xs: "0.5rem", sm: "0.75rem", md: "1rem", lg: "1.5rem", xl: "2.5rem" },
  radius: { sm: "0.25rem", md: "0.5rem", lg: "0.75rem" },
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  },
  animation: { enabled: true, intensity: "normal", respectReducedMotion: true },
  layout: { hero: "centered", projects: "grid" },
};
