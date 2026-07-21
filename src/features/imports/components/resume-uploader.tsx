"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stageResumeImportAction } from "../actions";

export function ResumeUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const result = await stageResumeImportAction({ file });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setFile(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Upload a PDF resume. It&apos;s parsed and sent to an LLM to draft experience, education, skills,
        and a profile summary — nothing is saved until you review and commit below.
      </p>
      <Input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <Button type="button" onClick={onSubmit} disabled={!file || isPending}>
        {isPending ? "Extracting…" : "Upload & extract"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
