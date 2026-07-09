import type { Metadata } from "next";
import { getDefaultWorkspace } from "@/lib/workspace";
import { listVisibleSkillsByCategory } from "@/features/skills/queries";
import { requireEnabledPage } from "@/features/navigation/queries";
import { resolveSeoMetadata } from "@/features/seo/queries";
import { toMetadata } from "@/features/seo/to-metadata";

export const dynamic = "force-dynamic";

const levelLabels: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getDefaultWorkspace();
  return toMetadata(await resolveSeoMetadata(workspace.id, "SKILLS"));
}

export default async function SkillsPage() {
  const workspace = await getDefaultWorkspace();
  await requireEnabledPage(workspace.id, "SKILLS");
  const categories = await listVisibleSkillsByCategory(workspace.id);
  const nonEmptyCategories = categories.filter((c) => c.skills.length > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Skills</h1>
      {nonEmptyCategories.length === 0 ? (
        <p className="text-muted-foreground">Nothing to show yet.</p>
      ) : (
        nonEmptyCategories.map((category) => (
          <section key={category.id} className="space-y-2">
            <h2 className="text-lg font-semibold">{category.name}</h2>
            <ul className="flex flex-wrap gap-2">
              {category.skills.map((skill) => (
                <li
                  key={skill.id}
                  className="rounded-md border px-3 py-1.5 text-sm"
                  title={skill.level ? levelLabels[skill.level] : undefined}
                >
                  {skill.name}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
