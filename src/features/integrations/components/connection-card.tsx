"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ProviderType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { connectProviderAction, disconnectProviderAction } from "../actions";
import { connectProviderSchema, type ConnectProviderInput } from "../schemas";
import type { ProviderAccountMeta } from "@/domain/providers/types";

type Connection = {
  status: string;
  accountMeta: ProviderAccountMeta | null;
  connectedAt: Date;
} | null;

export function ConnectionCard({
  provider,
  label,
  description,
  tokenHelp,
  connection,
}: {
  provider: ProviderType;
  label: string;
  description: string;
  tokenHelp: string;
  connection: Connection;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ConnectProviderInput>({
    resolver: zodResolver(connectProviderSchema),
    defaultValues: { provider, token: "" },
  });

  function onSubmit(values: ConnectProviderInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await connectProviderAction(values);
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      form.reset({ provider, token: "" });
      router.refresh();
    });
  }

  function onDisconnect() {
    setFormError(null);
    startTransition(async () => {
      const result = await disconnectProviderAction({ provider });
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {label}
          {connection ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Connected as {connection.accountMeta?.username ?? "unknown"}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Not connected
            </span>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {connection ? (
          <Button type="button" variant="outline" onClick={onDisconnect} disabled={isPending}>
            {isPending ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-2">
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input type="password" placeholder={tokenHelp} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? "Connecting…" : "Connect"}
              </Button>
            </form>
          </Form>
        )}
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
      </CardContent>
    </Card>
  );
}
