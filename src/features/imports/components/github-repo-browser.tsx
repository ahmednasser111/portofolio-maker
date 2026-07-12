"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { listGithubReposAction, stageGithubImportAction } from "../actions";

export function GithubRepoBrowser() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [stageError, setStageError] = useState<string | null>(null);

  const { data: repos, isLoading, error } = useQuery({
    queryKey: ["github-repos"],
    queryFn: async () => {
      const result = await listGithubReposAction({});
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onImport() {
    setStageError(null);
    startTransition(async () => {
      const result = await stageGithubImportAction({ repoIds: [...selected] });
      if (!result.ok) {
        setStageError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading repositories…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!repos || repos.length === 0) {
    return <p className="text-sm text-muted-foreground">No repositories found on this account.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border">
        {repos.map((repo) => (
          <li key={repo.id} className="flex items-start gap-3 p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.has(repo.id)}
              onChange={() => toggle(repo.id)}
            />
            <div>
              <p className="text-sm font-medium">
                {repo.fullName}
                {repo.fork ? (
                  <span className="ml-2 text-xs text-muted-foreground">fork</span>
                ) : null}
                {repo.private ? (
                  <span className="ml-2 text-xs text-muted-foreground">private</span>
                ) : null}
              </p>
              {repo.description ? (
                <p className="text-sm text-muted-foreground">{repo.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={onImport} disabled={selected.size === 0 || isPending}>
        {isPending ? "Importing…" : `Import ${selected.size} selected`}
      </Button>
      {stageError ? <p className="text-sm text-red-600">{stageError}</p> : null}
    </div>
  );
}
