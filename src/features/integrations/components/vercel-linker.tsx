"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { listVercelProjectsAction, attachVercelUrlAction } from "../actions";

export function VercelLinker({ projects }: { projects: { id: string; title: string }[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [vercelProjectId, setVercelProjectId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: vercelProjects, isLoading, error } = useQuery({
    queryKey: ["vercel-projects"],
    queryFn: async () => {
      const res = await listVercelProjectsAction({});
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });

  function onAttach() {
    setResult(null);
    startTransition(async () => {
      const res = await attachVercelUrlAction({ projectId, vercelProjectId });
      if (!res.ok) {
        setResult({ ok: false, message: res.error.message });
        return;
      }
      setResult({ ok: true, message: `Attached ${res.data.url}` });
    });
  }

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">Create a project first, then attach its production URL here.</p>;
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading Vercel projects…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
          value={vercelProjectId}
          onChange={(e) => setVercelProjectId(e.target.value)}
        >
          <option value="">Select Vercel project…</option>
          {vercelProjects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button type="button" onClick={onAttach} disabled={!vercelProjectId || isPending}>
          {isPending ? "Attaching…" : "Attach URL"}
        </Button>
      </div>
      {result ? (
        <p className={`text-sm ${result.ok ? "text-muted-foreground" : "text-red-600"}`}>{result.message}</p>
      ) : null}
    </div>
  );
}
