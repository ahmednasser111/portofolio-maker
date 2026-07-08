import { getDefaultWorkspace } from "@/lib/workspace";
import { listVisibleEducation } from "@/features/education/queries";

export const dynamic = "force-dynamic";

export default async function EducationPage() {
  const workspace = await getDefaultWorkspace();
  const education = await listVisibleEducation(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Education</h1>
      {education.length === 0 ? (
        <p className="text-muted-foreground">Nothing to show yet.</p>
      ) : (
        <ul className="space-y-4">
          {education.map((entry) => (
            <li key={entry.id} className="space-y-1">
              <h2 className="font-semibold">{entry.institution}</h2>
              <p className="text-sm text-muted-foreground">
                {[entry.degree, entry.field].filter(Boolean).join(", ")}
              </p>
              {entry.startDate ? (
                <p className="text-xs text-muted-foreground">
                  {entry.startDate.toISOString().slice(0, 10)} –{" "}
                  {entry.endDate ? entry.endDate.toISOString().slice(0, 10) : "present"}
                </p>
              ) : null}
              {entry.description ? <p className="text-sm">{entry.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
