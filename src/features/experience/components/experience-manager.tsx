"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { richTextListItems } from "@/lib/rich-text";
import type { ActionResult } from "@/lib/create-action";
import {
  createExperienceAction,
  deleteExperienceAction,
  moveExperienceAction,
  setExperienceVisibleAction,
  updateExperienceAction,
} from "../actions";
import { employmentTypeOptions, type CreateExperienceInput } from "../schemas";
import type { Experience } from "@prisma/client";

const employmentTypeLabels: Record<(typeof employmentTypeOptions)[number], string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  INTERNSHIP: "Internship",
  VOLUNTEER: "Volunteer",
};

type FormState = {
  company: string;
  role: string;
  location: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  description: string;
  highlights: string;
};

const emptyForm: FormState = {
  company: "",
  role: "",
  location: "",
  employmentType: "",
  startDate: "",
  endDate: "",
  description: "",
  highlights: "",
};

function toFormState(experience: Experience): FormState {
  return {
    company: experience.company,
    role: experience.role,
    location: experience.location ?? "",
    employmentType: experience.employmentType ?? "",
    startDate: experience.startDate.toISOString().slice(0, 10),
    endDate: experience.endDate ? experience.endDate.toISOString().slice(0, 10) : "",
    description: experience.description ?? "",
    highlights: richTextListItems(experience.highlights).join("\n"),
  };
}

export function ExperienceManager({ experiences }: { experiences: Experience[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<{ type: "closed" } | { type: "create" } | { type: "edit"; id: string }>(
    { type: "closed" },
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setMode({ type: "create" });
    setError(null);
  }

  function openEdit(experience: Experience) {
    setForm(toFormState(experience));
    setMode({ type: "edit", id: experience.id });
    setError(null);
  }

  function save() {
    // The form models employmentType as a plain string (shadcn's Select
    // deals in strings); the schema narrows it, so cast at this boundary.
    const payload = form as unknown as CreateExperienceInput;
    startTransition(async () => {
      const result =
        mode.type === "edit"
          ? await updateExperienceAction({ id: mode.id, ...payload })
          : await createExperienceAction(payload);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMode({ type: "closed" });
      router.refresh();
    });
  }

  function run(action: Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      const result = await action;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {experiences.length === 0 && mode.type === "closed" ? (
        <p className="text-sm text-muted-foreground">No experience entries yet.</p>
      ) : null}

      <ul className="space-y-2">
        {experiences.map((experience, index) => (
          <li key={experience.id} className="rounded-md border p-3">
            {mode.type === "edit" && mode.id === experience.id ? null : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {experience.role} · {experience.company}
                    {!experience.visible ? (
                      <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {experience.startDate.toISOString().slice(0, 10)} –{" "}
                    {experience.endDate ? experience.endDate.toISOString().slice(0, 10) : "present"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending || index === 0}
                    onClick={() => run(moveExperienceAction({ id: experience.id, direction: "up" }))}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending || index === experiences.length - 1}
                    onClick={() =>
                      run(moveExperienceAction({ id: experience.id, direction: "down" }))
                    }
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      run(
                        setExperienceVisibleAction({
                          id: experience.id,
                          visible: !experience.visible,
                        }),
                      )
                    }
                  >
                    {experience.visible ? "Hide" : "Show"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(experience)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm(`Delete "${experience.role} · ${experience.company}"?`)) return;
                      run(deleteExperienceAction({ id: experience.id }));
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}

            {mode.type === "edit" && mode.id === experience.id ? (
              <ExperienceFields
                form={form}
                setForm={setForm}
                onCancel={() => setMode({ type: "closed" })}
                onSave={save}
                isPending={isPending}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {mode.type === "create" ? (
        <div className="rounded-md border p-3">
          <ExperienceFields
            form={form}
            setForm={setForm}
            onCancel={() => setMode({ type: "closed" })}
            onSave={save}
            isPending={isPending}
          />
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={openCreate}>
          Add experience
        </Button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function ExperienceFields({
  form,
  setForm,
  onCancel,
  onSave,
  isPending,
}: {
  form: FormState;
  setForm: (form: FormState) => void;
  onCancel: () => void;
  onSave: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Company"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
        />
        <Input
          placeholder="Role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <Select
          value={form.employmentType}
          onValueChange={(v) => setForm({ ...form, employmentType: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Employment type" />
          </SelectTrigger>
          <SelectContent>
            {employmentTypeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {employmentTypeLabels[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
        />
        <Input
          type="date"
          placeholder="Leave blank if current"
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
        />
      </div>
      <Textarea
        placeholder="Description"
        rows={3}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Textarea
        placeholder="Highlights, one per line"
        rows={3}
        value={form.highlights}
        onChange={(e) => setForm({ ...form, highlights: e.target.value })}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
