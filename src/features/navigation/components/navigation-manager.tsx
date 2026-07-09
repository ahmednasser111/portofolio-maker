"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/create-action";
import {
  moveNavigationItemAction,
  renameNavigationItemAction,
  setNavigationItemEnabledAction,
} from "../actions";
import { DEFAULT_NAV_LABELS } from "../labels";
import type { NavigationItem } from "@prisma/client";

export function NavigationManager({ items }: { items: NavigationItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
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
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2">
            <Switch
              checked={item.enabled}
              disabled={isPending}
              onCheckedChange={(checked) =>
                run(setNavigationItemEnabledAction({ id: item.id, enabled: checked }))
              }
            />
            {editingId === item.id ? (
              <>
                <Input
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  placeholder={DEFAULT_NAV_LABELS[item.page]}
                  className="h-8 w-48"
                />
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      renameNavigationItemAction({ id: item.id, customLabel: editingLabel }),
                      () => setEditingId(null),
                    )
                  }
                >
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className={item.enabled ? "flex-1 text-sm" : "flex-1 text-sm opacity-50"}>
                  {item.customLabel ?? DEFAULT_NAV_LABELS[item.page]}
                  <span className="ml-2 text-xs text-muted-foreground">({item.page})</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending || index === 0}
                  onClick={() => run(moveNavigationItemAction({ id: item.id, direction: "up" }))}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending || index === items.length - 1}
                  onClick={() => run(moveNavigationItemAction({ id: item.id, direction: "down" }))}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingLabel(item.customLabel ?? "");
                  }}
                >
                  Rename
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
