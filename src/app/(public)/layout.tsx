import { PublicNav } from "@/components/shared/public-nav";
import { getActiveThemeTokens } from "@/features/theme/queries";
import { tokensToCss } from "@/features/theme/css";
import { listPublicNavigationItems } from "@/features/navigation/queries";
import { getDefaultWorkspace } from "@/lib/workspace";

// Server-rendered CSS custom properties, no client fetch, no flash
// (architecture.md §10).
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getDefaultWorkspace();
  const [tokens, navLinks] = await Promise.all([
    getActiveThemeTokens(workspace.id),
    listPublicNavigationItems(workspace.id),
  ]);

  return (
    <>
      {/* Generated from our own validated token schema, never user-supplied
          HTML/CSS. */}
      <style dangerouslySetInnerHTML={{ __html: tokensToCss(tokens) }} />
      <PublicNav links={navLinks} />
      <main>{children}</main>
    </>
  );
}
