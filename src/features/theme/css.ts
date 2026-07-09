import type { ColorSet, ThemeTokens } from "./token-schema";

function colorVars(colors: ColorSet): string {
  return [
    `--color-background: ${colors.background};`,
    `--color-foreground: ${colors.foreground};`,
    `--color-primary: ${colors.primary};`,
    `--color-primary-foreground: ${colors.primaryForeground};`,
    `--color-muted: ${colors.muted};`,
    `--color-muted-foreground: ${colors.mutedForeground};`,
    `--color-accent: ${colors.accent};`,
    `--color-accent-foreground: ${colors.accentForeground};`,
    `--color-border: ${colors.border};`,
  ].join(" ");
}

// Server-rendered CSS custom properties — no client fetch, no flash
// (architecture.md §10). Light values apply by default; dark values apply
// under prefers-color-scheme, matching the static block this replaces from
// M0's globals.css.
export function tokensToCss(tokens: ThemeTokens): string {
  const { typography, colors, spacing, radius, shadows } = tokens;

  const base = [
    `--font-family: ${typography.fontFamily};`,
    `--font-size-xs: ${typography.scale.xs};`,
    `--font-size-sm: ${typography.scale.sm};`,
    `--font-size-base: ${typography.scale.base};`,
    `--font-size-lg: ${typography.scale.lg};`,
    `--font-size-xl: ${typography.scale.xl};`,
    `--font-size-2xl: ${typography.scale["2xl"]};`,
    `--font-size-3xl: ${typography.scale["3xl"]};`,
    `--font-weight-normal: ${typography.weights.normal};`,
    `--font-weight-medium: ${typography.weights.medium};`,
    `--font-weight-bold: ${typography.weights.bold};`,
    `--line-height-tight: ${typography.lineHeights.tight};`,
    `--line-height-normal: ${typography.lineHeights.normal};`,
    `--line-height-relaxed: ${typography.lineHeights.relaxed};`,
    `--spacing-xs: ${spacing.xs};`,
    `--spacing-sm: ${spacing.sm};`,
    `--spacing-md: ${spacing.md};`,
    `--spacing-lg: ${spacing.lg};`,
    `--spacing-xl: ${spacing.xl};`,
    `--radius-sm: ${radius.sm};`,
    `--radius-md: ${radius.md};`,
    `--radius-lg: ${radius.lg};`,
    `--shadow-sm: ${shadows.sm};`,
    `--shadow-md: ${shadows.md};`,
    `--shadow-lg: ${shadows.lg};`,
    colorVars(colors.light),
  ].join(" ");

  return `:root { ${base} } @media (prefers-color-scheme: dark) { :root { ${colorVars(colors.dark)} } }`;
}
