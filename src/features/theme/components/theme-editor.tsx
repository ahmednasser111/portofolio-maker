"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useFormContext, type Path } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveThemeAction, activatePresetAction } from "../actions";
import { themeTokensSchema, type ThemeTokens } from "../token-schema";
import type { Theme } from "@prisma/client";

function TextField({ name, label }: { name: Path<ThemeTokens>; label: string }) {
  const { control } = useFormContext<ThemeTokens>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input {...field} value={String(field.value ?? "")} className="h-8" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ColorField({ name, label }: { name: Path<ThemeTokens>; label: string }) {
  const { control, watch } = useFormContext<ThemeTokens>();
  const value = watch(name) as string;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <div className="flex items-center gap-2">
            <span
              className="h-6 w-6 shrink-0 rounded border"
              style={{ background: value }}
              aria-hidden
            />
            <FormControl>
              <Input {...field} value={String(field.value ?? "")} className="h-8" />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function ThemeEditor({
  tokens,
  presets,
}: {
  tokens: ThemeTokens;
  presets: Theme[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<ThemeTokens>({
    resolver: zodResolver(themeTokensSchema),
    defaultValues: tokens,
  });

  function onSubmit(values: ThemeTokens) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveThemeAction(values);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function activatePreset(presetId: string) {
    startTransition(async () => {
      const result = await activatePresetAction({ presetId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {presets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Presets:</span>
          {presets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => activatePreset(preset.id)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Typography</h2>
            <TextField name="typography.fontFamily" label="Font family" />
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              <TextField name="typography.scale.xs" label="xs" />
              <TextField name="typography.scale.sm" label="sm" />
              <TextField name="typography.scale.base" label="base" />
              <TextField name="typography.scale.lg" label="lg" />
              <TextField name="typography.scale.xl" label="xl" />
              <TextField name="typography.scale.2xl" label="2xl" />
              <TextField name="typography.scale.3xl" label="3xl" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TextField name="typography.weights.normal" label="Weight: normal" />
              <TextField name="typography.weights.medium" label="Weight: medium" />
              <TextField name="typography.weights.bold" label="Weight: bold" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TextField name="typography.lineHeights.tight" label="Line height: tight" />
              <TextField name="typography.lineHeights.normal" label="Line height: normal" />
              <TextField name="typography.lineHeights.relaxed" label="Line height: relaxed" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Colors — light</h2>
            <div className="grid grid-cols-3 gap-3">
              <ColorField name="colors.light.background" label="Background" />
              <ColorField name="colors.light.foreground" label="Foreground" />
              <ColorField name="colors.light.primary" label="Primary" />
              <ColorField name="colors.light.primaryForeground" label="Primary foreground" />
              <ColorField name="colors.light.muted" label="Muted" />
              <ColorField name="colors.light.mutedForeground" label="Muted foreground" />
              <ColorField name="colors.light.accent" label="Accent" />
              <ColorField name="colors.light.accentForeground" label="Accent foreground" />
              <ColorField name="colors.light.border" label="Border" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Colors — dark</h2>
            <div className="grid grid-cols-3 gap-3">
              <ColorField name="colors.dark.background" label="Background" />
              <ColorField name="colors.dark.foreground" label="Foreground" />
              <ColorField name="colors.dark.primary" label="Primary" />
              <ColorField name="colors.dark.primaryForeground" label="Primary foreground" />
              <ColorField name="colors.dark.muted" label="Muted" />
              <ColorField name="colors.dark.mutedForeground" label="Muted foreground" />
              <ColorField name="colors.dark.accent" label="Accent" />
              <ColorField name="colors.dark.accentForeground" label="Accent foreground" />
              <ColorField name="colors.dark.border" label="Border" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Spacing &amp; radius &amp; shadows</h2>
            <div className="grid grid-cols-5 gap-2">
              <TextField name="spacing.xs" label="Spacing xs" />
              <TextField name="spacing.sm" label="Spacing sm" />
              <TextField name="spacing.md" label="Spacing md" />
              <TextField name="spacing.lg" label="Spacing lg" />
              <TextField name="spacing.xl" label="Spacing xl" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TextField name="radius.sm" label="Radius sm" />
              <TextField name="radius.md" label="Radius md" />
              <TextField name="radius.lg" label="Radius lg" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TextField name="shadows.sm" label="Shadow sm" />
              <TextField name="shadows.md" label="Shadow md" />
              <TextField name="shadows.lg" label="Shadow lg" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Animation</h2>
            <FormField
              control={form.control}
              name="animation.enabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm">Enabled</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="animation.respectReducedMotion"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm">Respect reduced-motion preference</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="animation.intensity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Intensity</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="subtle">Subtle</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="playful">Playful</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Layout</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="layout.hero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Hero layout</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="centered">Centered</SelectItem>
                        <SelectItem value="split">Split</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="layout.projects"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Projects layout</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          </section>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save theme"}
          </Button>
          {saved ? <span className="ml-3 text-sm text-muted-foreground">Saved.</span> : null}
        </form>
      </Form>
    </div>
  );
}
