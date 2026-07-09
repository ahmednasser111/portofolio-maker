import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveThemeTokens, listPresetThemes } from "@/features/theme/queries";
import { ThemeEditor } from "@/features/theme/components/theme-editor";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardThemePage() {
  const workspace = await getDefaultWorkspace();
  const [tokens, presets] = await Promise.all([
    getActiveThemeTokens(workspace.id),
    listPresetThemes(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Theme</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Design tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeEditor tokens={tokens} presets={presets} />
        </CardContent>
      </Card>
    </div>
  );
}
