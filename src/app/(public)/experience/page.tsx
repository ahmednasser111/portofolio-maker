import { getDefaultWorkspace } from "@/lib/workspace";
import { listVisibleExperiences } from "@/features/experience/queries";
import { richTextListItems } from "@/lib/rich-text";

export const dynamic = "force-dynamic";

const employmentTypeLabels: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  INTERNSHIP: "Internship",
  VOLUNTEER: "Volunteer",
};

export default async function ExperiencePage() {
  const workspace = await getDefaultWorkspace();
  const experiences = await listVisibleExperiences(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Experience</h1>
      {experiences.length === 0 ? (
        <p className="text-muted-foreground">Nothing to show yet.</p>
      ) : (
        <ul className="space-y-6">
          {experiences.map((experience) => {
            const highlights = richTextListItems(experience.highlights);
            return (
              <li key={experience.id} className="space-y-1">
                <h2 className="font-semibold">
                  {experience.role} · {experience.company}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {[
                    experience.location,
                    experience.employmentType
                      ? employmentTypeLabels[experience.employmentType]
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {experience.startDate.toISOString().slice(0, 10)} –{" "}
                  {experience.endDate ? experience.endDate.toISOString().slice(0, 10) : "present"}
                </p>
                {experience.description ? <p className="text-sm">{experience.description}</p> : null}
                {highlights.length > 0 ? (
                  <ul className="ml-4 list-disc text-sm">
                    {highlights.map((highlight, index) => (
                      <li key={index}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
