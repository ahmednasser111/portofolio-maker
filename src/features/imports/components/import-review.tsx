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
import type {
  ProjectDraft,
  ExperienceDraft,
  EducationDraft,
  SkillDraft,
  ProfileSummaryDraft,
} from "@/domain/imports/target-schemas";

type ReviewItem = {
  id: string;
  status: string;
  targetType: string;
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

// One line each — the review screen's job is "what is this row", not a full
// preview. Project gets a dedicated structured editor below (it's the
// original/most-used target); the M4 targets share a plain JSON editor
// rather than four bespoke inline forms — a deliberate scope call for this
// milestone (see the milestone doc).
function describeItem(targetType: string, data: unknown): { title: string; subtitle: string | null } {
  switch (targetType) {
    case "PROJECT": {
      const d = data as ProjectDraft;
      return { title: d.title, subtitle: d.summary };
    }
    case "EXPERIENCE": {
      const d = data as ExperienceDraft;
      return { title: `${d.role} @ ${d.company}`, subtitle: `${d.startDate} – ${d.endDate ?? "present"}` };
    }
    case "EDUCATION": {
      const d = data as EducationDraft;
      return { title: d.institution, subtitle: d.degree };
    }
    case "SKILL": {
      const d = data as SkillDraft;
      return { title: d.name, subtitle: d.categoryName };
    }
    case "PROFILE_SUMMARY": {
      const d = data as ProfileSummaryDraft;
      return { title: "Profile summary", subtitle: d.headline };
    }
    default:
      return { title: targetType, subtitle: null };
  }
}

function ProjectEditor({
  draft,
  onSave,
  onCancel,
  isPending,
}: {
  draft: ProjectDraft;
  onSave: (next: ProjectDraft) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(draft.title);
  const [summary, setSummary] = useState(draft.summary ?? "");
  const [tags, setTags] = useState(draft.tags.join(", "));

  return (
    <div className="space-y-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary" rows={2} />
      <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            onSave({
              ...draft,
              title,
              summary: summary.trim().length > 0 ? summary.trim() : null,
              tags: tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0),
            })
          }
        >
          Save edit
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Raw-JSON fallback editor for the M4 targets (see describeItem's comment).
function JsonEditor({
  data,
  onSave,
  onCancel,
  isPending,
}: {
  data: unknown;
  onSave: (next: unknown) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [text, setText] = useState(JSON.stringify(data, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="font-mono text-xs" />
      {parseError ? <p className="text-sm text-red-600">{parseError}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => {
            try {
              onSave(JSON.parse(text));
              setParseError(null);
            } catch {
              setParseError("Invalid JSON.");
            }
          }}
        >
          Save edit
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const { title, subtitle } = describeItem(item.targetType, item.data);
  const [editing, setEditing] = useState(false);
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

  function saveEdit(editedData: unknown) {
    setRowError(null);
    startTransition(async () => {
      const result = await reviewImportItemAction({ itemId: item.id, decision: "EDITED", editedData });
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
        <p className="text-sm text-muted-foreground">Skipped — this already exists in your portfolio.</p>
      ) : editing ? (
        item.targetType === "PROJECT" ? (
          <ProjectEditor
            draft={item.data as ProjectDraft}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
            isPending={isPending}
          />
        ) : (
          <JsonEditor
            data={item.data}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
            isPending={isPending}
          />
        )
      ) : (
        <>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
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
            {isPending ? "Committing…" : `Commit ${committable.length} item(s)`}
          </Button>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={isPending}>
            Discard session
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Session {sessionStatus.toLowerCase()} —{" "}
          {sessionStatus === "COMMITTED" ? "committed items are live." : "no changes were made."}
        </p>
      )}
      {sessionError ? <p className="text-sm text-red-600">{sessionError}</p> : null}
    </div>
  );
}
