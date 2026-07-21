import Anthropic from "@anthropic-ai/sdk";
import { EmploymentType, SkillLevel } from "@prisma/client";
import {
  experienceDraftSchema,
  educationDraftSchema,
  skillDraftSchema,
  profileSummaryDraftSchema,
  type ExperienceDraft,
  type EducationDraft,
  type SkillDraft,
  type ProfileSummaryDraft,
} from "@/domain/imports/target-schemas";

// Single call site for the resume-import LLM step (architecture.md §12:
// "The LLM client sits behind an interface in lib/llm.ts so the model/
// provider is swappable"). Structured extraction is a one-shot classify/
// extract call — no agent loop, no tools.

const MODEL = "claude-opus-4-8";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

const experienceItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "company",
    "role",
    "location",
    "employmentType",
    "startDate",
    "endDate",
    "description",
    "highlights",
  ],
  properties: {
    company: { type: "string" },
    role: { type: "string" },
    location: nullableString,
    employmentType: { anyOf: [{ type: "string", enum: Object.values(EmploymentType) }, { type: "null" }] },
    startDate: { type: "string", description: "As written in the resume, e.g. 'March 2021' or '2021-03'." },
    endDate: { anyOf: [{ type: "string" }, { type: "null" }], description: "Null means present/ongoing." },
    description: nullableString,
    highlights: { type: "array", items: { type: "string" } },
  },
};

const educationItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["institution", "degree", "field", "startDate", "endDate", "description"],
  properties: {
    institution: { type: "string" },
    degree: nullableString,
    field: nullableString,
    startDate: nullableString,
    endDate: nullableString,
    description: nullableString,
  },
};

const skillItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["categoryName", "name", "level"],
  properties: {
    categoryName: { type: "string", description: "e.g. 'Languages', 'Frameworks', 'Tools'." },
    name: { type: "string" },
    level: { anyOf: [{ type: "string", enum: Object.values(SkillLevel) }, { type: "null" }] },
  },
};

const resumeExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["profileSummary", "experience", "education", "skills"],
  properties: {
    profileSummary: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["headline", "bio"],
          properties: { headline: nullableString, bio: nullableString },
        },
        { type: "null" },
      ],
    },
    experience: { type: "array", items: experienceItemSchema },
    education: { type: "array", items: educationItemSchema },
    skills: { type: "array", items: skillItemSchema },
  },
};

const SYSTEM_PROMPT = `You extract structured resume data from raw text. Rules:
- Only extract information explicitly present in the text — never invent or infer missing details.
- Dates stay exactly as written in the source text (don't reformat or normalize them).
- If a section (profile summary, experience, education, skills) has no content, return an empty array (or null for profileSummary), not fabricated entries.
- "skills" should group technologies/tools under a short category name that reflects how the resume groups them, or a reasonable category like "Languages"/"Frameworks"/"Tools" if the resume lists them flat.`;

export type ResumeExtractionResult = {
  profileSummary: ProfileSummaryDraft | null;
  experience: ExperienceDraft[];
  education: EducationDraft[];
  skills: SkillDraft[];
};

// Zod-validates every item independently and drops ones that fail rather
// than failing the whole extraction (architecture.md §16: "schema-constrained
// output + Zod rejection of malformed items" — a malformed item is a gap in
// the review screen, not a hard error for the whole resume).
function safeMapItems<TOut>(items: unknown[], schema: { safeParse(v: unknown): { success: boolean; data?: TOut } }): TOut[] {
  const result: TOut[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success && parsed.data !== undefined) result.push(parsed.data);
  }
  return result;
}

export async function extractResumeData(resumeText: string): Promise<ResumeExtractionResult> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: resumeText.slice(0, 50_000) }],
    output_config: { format: { type: "json_schema", schema: resumeExtractionSchema } },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("LLM returned no text content for resume extraction.");
  }

  const raw = JSON.parse(textBlock.text) as {
    profileSummary: unknown;
    experience: unknown[];
    education: unknown[];
    skills: unknown[];
  };

  const profileSummary = profileSummaryDraftSchema.safeParse(raw.profileSummary);

  return {
    profileSummary: profileSummary.success ? profileSummary.data : null,
    experience: safeMapItems(raw.experience ?? [], experienceDraftSchema),
    education: safeMapItems(raw.education ?? [], educationDraftSchema),
    skills: safeMapItems(raw.skills ?? [], skillDraftSchema),
  };
}
