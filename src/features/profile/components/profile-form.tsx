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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { richTextToParagraphs } from "@/lib/rich-text";
import { upsertProfileAction, uploadAvatarAction, uploadProfileResumeAction } from "../actions";
import { availabilityOptions, upsertProfileSchema, type UpsertProfileInput } from "../schemas";
import { availabilityLabels } from "../labels";
import type { getProfile } from "../queries";

type ProfileWithAssets = Awaited<ReturnType<typeof getProfile>>;

function AssetUploadField({
  label,
  accept,
  currentUrl,
  currentFilename,
  onUpload,
}: {
  label: string;
  accept: string;
  currentUrl: string | null | undefined;
  currentFilename: string | null | undefined;
  onUpload: (file: File) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const result = await onUpload(file);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setFile(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <FormLabel>{label}</FormLabel>
      {currentUrl ? (
        <p className="text-xs text-muted-foreground">
          Current:{" "}
          <a href={currentUrl} target="_blank" rel="noreferrer" className="underline">
            {currentFilename ?? "view"}
          </a>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Not set.</p>
      )}
      <div className="flex items-center gap-2">
        <Input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button type="button" size="sm" variant="outline" disabled={!file || isPending} onClick={submit}>
          {isPending ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function ProfileForm({ profile }: { profile: ProfileWithAssets }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<UpsertProfileInput>({
    resolver: zodResolver(upsertProfileSchema),
    defaultValues: {
      displayName: profile?.displayName ?? "",
      position: profile?.position ?? "",
      headline: profile?.headline ?? "",
      bio: richTextToParagraphs(profile?.bio).join("\n\n"),
      location: profile?.location ?? "",
      availability: profile?.availability ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      heroCtaLabel: profile?.heroCtaLabel ?? "",
      heroCtaUrl: profile?.heroCtaUrl ?? "",
    },
  });

  function onSubmit(values: UpsertProfileInput) {
    setFormError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await upsertProfileAction(values);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Position</FormLabel>
                <FormControl>
                  <Input placeholder="Senior Software Engineer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="headline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Headline</FormLabel>
              <FormControl>
                <Input placeholder="A short one-liner for the hero section" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea rows={6} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <AssetUploadField
            label="Avatar"
            accept="image/png,image/jpeg,image/gif,image/webp"
            currentUrl={profile?.avatarAsset?.url}
            currentFilename={profile?.avatarAsset?.filename}
            onUpload={async (file) => {
              const result = await uploadAvatarAction({ file });
              return result.ok ? { ok: true } : { ok: false, message: result.error.message };
            }}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="availability"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Availability</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availabilityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {availabilityLabels[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Public email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="heroCtaLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hero CTA label</FormLabel>
                <FormControl>
                  <Input placeholder="View my work" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="heroCtaUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hero CTA URL</FormLabel>
                <FormControl>
                  <Input placeholder="/projects" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <AssetUploadField
          label="Public resume (powers the /resume page preview & download)"
          accept="application/pdf"
          currentUrl={profile?.publicResumeAsset?.url}
          currentFilename={profile?.publicResumeAsset?.filename}
          onUpload={async (file) => {
            const result = await uploadProfileResumeAction({ file });
            return result.ok ? { ok: true } : { ok: false, message: result.error.message };
          }}
        />

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save profile"}
        </Button>
        {saved ? <span className="ml-3 text-sm text-muted-foreground">Saved.</span> : null}
      </form>
    </Form>
  );
}
