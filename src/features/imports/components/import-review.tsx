"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  reviewImportItemAction,
  commitImportSessionAction,
  discardImportSessionAction,
} from "../actions";
import type { ProjectDraft } from "@/domain/imports/target-schemas";

type ReviewItem = {
  id: string;
  status: string;
  externalId: string | null;
  data: unknown;
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  ACCEPTED: "bg-green-100 text-green-800",
  EDITED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  SKIPPED_DUPLICATE: "bg-yellow-100 text-yellow-800",
  COMMITTED: "bg-purple-100 text-purple-800",
};

function ReviewRow({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const draft = item.data as ProjectDraft;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [summary, setSummary] = useState(draft.summary ?? "");
  const [tags, setTags] = useState(draft.tags.join(", "));
  const [isPending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);

  const locked = item.status === "COMMITTED" || item.status === "SKIPPED_DUPLICATE";

  function decide(decision: "ACCEPTED" | "REJECTED") {
    setRowError(null);
    startTransition(async () => {
      const result = await reviewImportItemAction({ itemId: item.id, decision });
      if (!result.ok) {
        setRowError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function saveEdit() {
    setRowError(null);
    startTransition(async () => {
      const editedData: ProjectDraft = {
        ...draft,
        title,
        summary: summary.trim().length > 0 ? summary.trim() : null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      };
      const result = await reviewImportItemAction({
        itemId: item.id,
        decision: "EDITED",
        editedData,
      });
      if (!result.ok) {
        setRowError(result.error.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
          {item.status.replace("_", " ").toLowerCase()}
        </span>
      </div>
      {item.status === "SKIPPED_DUPLICATE" ? (
        <p className="text-sm text-muted-foreground">
          Skipped — a project with this GitHub repo is already imported.
        </p>
      ) : editing ? (
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summary"
            rows={2}
          />
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={saveEdit} disabled={isPending}>
              Save edit
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {draft.summary ? <p className="text-sm text-muted-foreground">{draft.summary}</p> : null}
          {!locked ? (
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => decide("ACCEPTED")} disabled={isPending}>
                Accept
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => decide("REJECTED")}
                disabled={isPending}
              >
                Reject
              </Button>
            </div>
          ) : null}
        </>
      )}
      {rowError ? <p className="text-sm text-red-600">{rowError}</p> : null}
    </li>
  );
}

export function ImportReview({
  sessionId,
  sessionStatus,
  items,
}: {
  sessionId: string;
  sessionStatus: string;
  items: ReviewItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sessionError, setSessionError] = useState<string | null>(null);

  const committable = items.filter((i) => i.status === "ACCEPTED" || i.status === "EDITED");
  const isFinal = sessionStatus === "COMMITTED" || sessionStatus === "DISCARDED";

  function onCommit() {
    setSessionError(null);
    startTransition(async () => {
      const result = await commitImportSessionAction({ sessionId });
      if (!result.ok) {
        setSessionError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onDiscard() {
    setSessionError(null);
    startTransition(async () => {
      const result = await discardImportSessionAction({ sessionId });
      if (!result.ok) {
        setSessionError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border">
        {items.map((item) => (
          <ReviewRow key={item.id} item={item} />
        ))}
      </ul>
      {!isFinal ? (
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onCommit} disabled={committable.length === 0 || isPending}>
            {isPending ? "Committing…" : `Commit ${committable.length} project(s)`}
          </Button>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={isPending}>
            Discard session
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Session {sessionStatus.toLowerCase()} — {sessionStatus === "COMMITTED" ? "committed items are live." : "no changes were made."}
        </p>
      )}
      {sessionError ? <p className="text-sm text-red-600">{sessionError}</p> : null}
    </div>
  );
}
