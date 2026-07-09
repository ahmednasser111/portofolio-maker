"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/create-action";
import { deleteMessageAction, markMessageReadAction } from "../actions";
import type { ContactMessage } from "@prisma/client";

export function MessageInbox({ messages }: { messages: ContactMessage[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      await action;
      router.refresh();
    });
  }

  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {messages.map((message) => (
        <li
          key={message.id}
          className={message.readAt ? "rounded-md border p-3" : "rounded-md border p-3 bg-muted"}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {message.senderName} — <span className="text-muted-foreground">{message.senderEmail}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {message.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {!message.readAt ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(markMessageReadAction({ id: message.id }))}
                >
                  Mark read
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  if (!confirm("Delete this message?")) return;
                  run(deleteMessageAction({ id: message.id }));
                }}
              >
                Delete
              </Button>
            </div>
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap">{message.body}</p>
        </li>
      ))}
    </ul>
  );
}
