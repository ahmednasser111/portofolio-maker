"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/create-action";
import { upsertSeoSettingAction } from "../actions";
import type { SeoSetting } from "@prisma/client";

type Row = { key: string; label: string; setting: SeoSetting | null };

type FormState = { title: string; description: string; ogImageUrl: string; noindex: boolean };

function toFormState(setting: SeoSetting | null): FormState {
  return {
    title: setting?.title ?? "",
    description: setting?.description ?? "",
    ogImageUrl: setting?.ogImageUrl ?? "",
    noindex: setting?.noindex ?? false,
  };
}

export function SeoManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(toFormState(null));
  const [error, setError] = useState<string | null>(null);

  function run(action: Promise<ActionResult<unknown>>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              {row.setting?.title ? (
                <p className="text-xs text-muted-foreground">{row.setting.title}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Not set — using fallback</p>
              )}
            </div>
            {openKey === row.key ? (
              <Button size="sm" variant="outline" onClick={() => setOpenKey(null)}>
                Close
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setForm(toFormState(row.setting));
                  setOpenKey(row.key);
                  setError(null);
                }}
              >
                Edit
              </Button>
            )}
          </div>

          {openKey === row.key ? (
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Textarea
                placeholder="Description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <Input
                placeholder="OG image URL"
                value={form.ogImageUrl}
                onChange={(e) => setForm({ ...form, ogImageUrl: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.noindex}
                  onCheckedChange={(checked) => setForm({ ...form, noindex: checked })}
                />
                <span className="text-sm">No-index this page</span>
              </div>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(upsertSeoSettingAction({ page: row.key, ...form }), () => setOpenKey(null))
                }
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
