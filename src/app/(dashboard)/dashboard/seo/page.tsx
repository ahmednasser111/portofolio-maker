import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSeoSettings } from "@/features/seo/queries";
import { SeoManager } from "@/features/seo/components/seo-manager";
import { SEEDED_NAV_PAGES, DEFAULT_NAV_LABELS } from "@/features/navigation/labels";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardSeoPage() {
  const workspace = await getDefaultWorkspace();
  const settings = await listSeoSettings(workspace.id);
  const byPage = new Map(settings.map((s) => [s.page ?? "", s]));

  const rows = [
    { key: "", label: "Defaults (fallback for every page)", setting: byPage.get("") ?? null },
    ...SEEDED_NAV_PAGES.map((page) => ({
      key: page,
      label: DEFAULT_NAV_LABELS[page],
      setting: byPage.get(page) ?? null,
    })),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">SEO</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-page metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <SeoManager rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
