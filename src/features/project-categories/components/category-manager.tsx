"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/create-action";
import {
  createProjectCategoryAction,
  updateProjectCategoryAction,
  deleteProjectCategoryAction,
  moveProjectCategoryAction,
} from "../actions";
import type { ProjectCategory } from "@prisma/client";

export function ProjectCategoryManager({ categories }: { categories: ProjectCategory[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
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
        {categories.map((category, index) => (
          <li key={category.id} className="flex items-center gap-2">
            {editingId === category.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-8"
                />
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(updateProjectCategoryAction({ id: category.id, name: editingName }), () =>
                      setEditingId(null),
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
                <span className="flex-1 text-sm">{category.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending || index === 0}
                  onClick={() =>
                    run(moveProjectCategoryAction({ id: category.id, direction: "up" }))
                  }
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending || index === categories.length - 1}
                  onClick={() =>
                    run(moveProjectCategoryAction({ id: category.id, direction: "down" }))
                  }
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(category.id);
                    setEditingName(category.name);
                  }}
                >
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    if (!confirm(`Delete category "${category.name}"?`)) return;
                    run(deleteProjectCategoryAction({ id: category.id }));
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          placeholder="New category"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-8"
        />
        <Button
          size="sm"
          disabled={isPending || newName.trim().length === 0}
          onClick={() =>
            run(createProjectCategoryAction({ name: newName }), () => setNewName(""))
          }
        >
          Add
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
