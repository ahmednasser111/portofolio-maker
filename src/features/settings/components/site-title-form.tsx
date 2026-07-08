"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateSiteTitleAction } from "../actions";
import { updateSiteTitleSchema, type UpdateSiteTitleInput } from "../schemas";

export function SiteTitleForm({ initialSiteTitle }: { initialSiteTitle: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<UpdateSiteTitleInput>({
    resolver: zodResolver(updateSiteTitleSchema),
    defaultValues: { siteTitle: initialSiteTitle },
  });

  function onSubmit(values: UpdateSiteTitleInput) {
    setFormError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateSiteTitleAction(values);
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-2">
        <FormField
          control={form.control}
          name="siteTitle"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Site title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </form>
      {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
      {saved ? <p className="mt-2 text-sm text-muted-foreground">Saved.</p> : null}
    </Form>
  );
}
