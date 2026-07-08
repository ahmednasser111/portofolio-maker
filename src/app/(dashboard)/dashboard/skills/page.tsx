import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSkillCategories } from "@/features/skill-categories/queries";
import { SkillCategoryManager } from "@/features/skill-categories/components/category-manager";
import { listSkillCategoriesWithSkills } from "@/features/skills/queries";
import { SkillManager } from "@/features/skills/components/skill-manager";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardSkillsPage() {
  const workspace = await getDefaultWorkspace();
  const [categories, categoriesWithSkills] = await Promise.all([
    listSkillCategories(workspace.id),
    listSkillCategoriesWithSkills(workspace.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Skills</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillCategoryManager categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillManager categories={categoriesWithSkills} />
        </CardContent>
      </Card>
    </div>
  );
}
