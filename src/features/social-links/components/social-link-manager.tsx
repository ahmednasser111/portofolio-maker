"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/create-action";
import {
  createSocialLinkAction,
  deleteSocialLinkAction,
  moveSocialLinkAction,
  setSocialLinkVisibleAction,
  updateSocialLinkAction,
} from "../actions";
import type { SocialLink } from "@prisma/client";

type FormState = { platform: string; iconKey: string; url: string };
const emptyForm: FormState = { platform: "", iconKey: "", url: "" };

export function SocialLinkManager({ links }: { links: SocialLink[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<FormState>(emptyForm);
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
    <div className="space-y-2">
      {links.length === 0 && !creating ? (
        <p className="text-sm text-muted-foreground">No social links yet.</p>
      ) : null}

      <ul className="space-y-1">
        {links.map((link, index) =>
          editingId === link.id ? (
            <li key={link.id} className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Platform"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="h-8 w-32"
              />
              <Input
                placeholder="Icon key"
                value={form.iconKey}
                onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
                className="h-8 w-28"
              />
              <Input
                placeholder="https://…"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="h-8 flex-1"
              />
              <Button
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(updateSocialLinkAction({ id: link.id, ...form }), () => setEditingId(null))
                }
              >
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </li>
          ) : (
            <li key={link.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">
                {link.platform} — <span className="text-muted-foreground">{link.url}</span>
                {!link.visible ? (
                  <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
                ) : null}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending || index === 0}
                onClick={() => run(moveSocialLinkAction({ id: link.id, direction: "up" }))}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending || index === links.length - 1}
                onClick={() => run(moveSocialLinkAction({ id: link.id, direction: "down" }))}
              >
                ↓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  run(setSocialLinkVisibleAction({ id: link.id, visible: !link.visible }))
                }
              >
                {link.visible ? "Hide" : "Show"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setForm({ platform: link.platform, iconKey: link.iconKey ?? "", url: link.url });
                  setEditingId(link.id);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(`Delete "${link.platform}"?`)) return;
                  run(deleteSocialLinkAction({ id: link.id }));
                }}
              >
                Delete
              </Button>
            </li>
          ),
        )}
      </ul>

      {creating ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Platform"
            value={newForm.platform}
            onChange={(e) => setNewForm({ ...newForm, platform: e.target.value })}
            className="h-8 w-32"
          />
          <Input
            placeholder="Icon key"
            value={newForm.iconKey}
            onChange={(e) => setNewForm({ ...newForm, iconKey: e.target.value })}
            className="h-8 w-28"
          />
          <Input
            placeholder="https://…"
            value={newForm.url}
            onChange={(e) => setNewForm({ ...newForm, url: e.target.value })}
            className="h-8 flex-1"
          />
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(createSocialLinkAction(newForm), () => {
                setCreating(false);
                setNewForm(emptyForm);
              })
            }
          >
            Add
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          Add social link
        </Button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
