"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/create-action";
import {
  createSkillAction,
  updateSkillAction,
  deleteSkillAction,
  setSkillVisibleAction,
  moveSkillAction,
} from "../actions";
import { skillLevelOptions } from "../schemas";
import type { Skill, SkillCategory } from "@prisma/client";

const levelLabels: Record<(typeof skillLevelOptions)[number], string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};

type CategoryWithSkills = SkillCategory & { skills: Skill[] };

export function SkillManager({ categories }: { categories: CategoryWithSkills[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLevel, setEditingLevel] = useState<string>("");
  const [newNameByCategory, setNewNameByCategory] = useState<Record<string, string>>({});

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

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No skill categories yet — add one above to start adding skills.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category.id}>
          <h3 className="mb-2 text-sm font-semibold">{category.name}</h3>
          {category.skills.length === 0 ? (
            <p className="mb-2 text-sm text-muted-foreground">No skills in this category yet.</p>
          ) : (
            <ul className="mb-2 space-y-1">
              {category.skills.map((skill, index) => (
                <li key={skill.id} className="flex items-center gap-2">
                  {editingId === skill.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 w-40"
                      />
                      <Select value={editingLevel} onValueChange={setEditingLevel}>
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue placeholder="No level" />
                        </SelectTrigger>
                        <SelectContent>
                          {skillLevelOptions.map((level) => (
                            <SelectItem key={level} value={level}>
                              {levelLabels[level]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          run(
                            updateSkillAction({
                              id: skill.id,
                              categoryId: skill.categoryId,
                              name: editingName,
                              level: editingLevel as never,
                              iconKey: skill.iconKey ?? "",
                            }),
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
                      <span className="flex-1 text-sm">
                        {skill.name}
                        {skill.level ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {levelLabels[skill.level]}
                          </span>
                        ) : null}
                        {!skill.visible ? (
                          <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
                        ) : null}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending || index === 0}
                        onClick={() => run(moveSkillAction({ id: skill.id, direction: "up" }))}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending || index === category.skills.length - 1}
                        onClick={() => run(moveSkillAction({ id: skill.id, direction: "down" }))}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          run(setSkillVisibleAction({ id: skill.id, visible: !skill.visible }))
                        }
                      >
                        {skill.visible ? "Hide" : "Show"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(skill.id);
                          setEditingName(skill.name);
                          setEditingLevel(skill.level ?? "");
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => {
                          if (!confirm(`Delete skill "${skill.name}"?`)) return;
                          run(deleteSkillAction({ id: skill.id }));
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="New skill"
              value={newNameByCategory[category.id] ?? ""}
              onChange={(e) =>
                setNewNameByCategory((prev) => ({ ...prev, [category.id]: e.target.value }))
              }
              className="h-8 w-40"
            />
            <Button
              size="sm"
              disabled={isPending || !(newNameByCategory[category.id] ?? "").trim()}
              onClick={() =>
                run(
                  createSkillAction({
                    categoryId: category.id,
                    name: newNameByCategory[category.id] ?? "",
                    level: "",
                    iconKey: "",
                  }),
                  () => setNewNameByCategory((prev) => ({ ...prev, [category.id]: "" })),
                )
              }
            >
              Add skill
            </Button>
          </div>
        </div>
      ))}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
