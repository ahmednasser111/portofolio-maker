"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/create-action";
import {
  createEducationAction,
  deleteEducationAction,
  moveEducationAction,
  setEducationVisibleAction,
  updateEducationAction,
} from "../actions";
import type { Education } from "@prisma/client";

type FormState = {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  description: string;
};

const emptyForm: FormState = {
  institution: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  description: "",
};

function toFormState(education: Education): FormState {
  return {
    institution: education.institution,
    degree: education.degree ?? "",
    field: education.field ?? "",
    startDate: education.startDate ? education.startDate.toISOString().slice(0, 10) : "",
    endDate: education.endDate ? education.endDate.toISOString().slice(0, 10) : "",
    description: education.description ?? "",
  };
}

export function EducationManager({ education }: { education: Education[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<{ type: "closed" } | { type: "create" } | { type: "edit"; id: string }>(
    { type: "closed" },
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

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

  function save() {
    startTransition(async () => {
      const result =
        mode.type === "edit"
          ? await updateEducationAction({ id: mode.id, ...form })
          : await createEducationAction(form);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMode({ type: "closed" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {education.length === 0 && mode.type === "closed" ? (
        <p className="text-sm text-muted-foreground">No education entries yet.</p>
      ) : null}

      <ul className="space-y-2">
        {education.map((entry, index) => (
          <li key={entry.id} className="rounded-md border p-3">
            {mode.type === "edit" && mode.id === entry.id ? (
              <EducationFields
                form={form}
                setForm={setForm}
                onCancel={() => setMode({ type: "closed" })}
                onSave={save}
                isPending={isPending}
              />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {entry.institution}
                    {!entry.visible ? (
                      <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[entry.degree, entry.field].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending || index === 0}
                    onClick={() => run(moveEducationAction({ id: entry.id, direction: "up" }))}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending || index === education.length - 1}
                    onClick={() => run(moveEducationAction({ id: entry.id, direction: "down" }))}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      run(setEducationVisibleAction({ id: entry.id, visible: !entry.visible }))
                    }
                  >
                    {entry.visible ? "Hide" : "Show"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setForm(toFormState(entry));
                      setMode({ type: "edit", id: entry.id });
                      setError(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm(`Delete "${entry.institution}"?`)) return;
                      run(deleteEducationAction({ id: entry.id }));
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {mode.type === "create" ? (
        <div className="rounded-md border p-3">
          <EducationFields
            form={form}
            setForm={setForm}
            onCancel={() => setMode({ type: "closed" })}
            onSave={save}
            isPending={isPending}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setForm(emptyForm);
            setMode({ type: "create" });
            setError(null);
          }}
        >
          Add education
        </Button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function EducationFields({
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
      <Input
        placeholder="Institution"
        value={form.institution}
        onChange={(e) => setForm({ ...form, institution: e.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Degree"
          value={form.degree}
          onChange={(e) => setForm({ ...form, degree: e.target.value })}
        />
        <Input
          placeholder="Field of study"
          value={form.field}
          onChange={(e) => setForm({ ...form, field: e.target.value })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
        />
        <Input
          type="date"
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
