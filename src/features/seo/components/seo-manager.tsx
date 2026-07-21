"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/create-action";
import { upsertSeoSettingAction, uploadSeoOgImageAction } from "../actions";
import type { Asset, SeoSetting } from "@prisma/client";

type Row = { key: string; label: string; setting: (SeoSetting & { ogImageAsset: Asset | null }) | null };

type FormState = { title: string; description: string; noindex: boolean };

function toFormState(setting: Row["setting"]): FormState {
  return {
    title: setting?.title ?? "",
    description: setting?.description ?? "",
    noindex: setting?.noindex ?? false,
  };
}

export function SeoManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(toFormState(null));
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
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
                  setOgImageFile(null);
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
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {row.setting?.ogImageAsset ? (
                    <>
                      OG image:{" "}
                      <a href={row.setting.ogImageAsset.url} target="_blank" rel="noreferrer" className="underline">
                        {row.setting.ogImageAsset.filename}
                      </a>
                    </>
                  ) : (
                    "No OG image set."
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={(e) => setOgImageFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!ogImageFile || isPending}
                    onClick={() =>
                      run(uploadSeoOgImageAction({ page: row.key, file: ogImageFile as File }), () =>
                        setOgImageFile(null),
                      )
                    }
                  >
                    Upload
                  </Button>
                </div>
              </div>
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
