"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { createProjectAction, updateProjectAction } from "../actions";
import {
  createProjectSchema,
  projectLinkTypeOptions,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "../schemas";
import type { Project, ProjectCategory, ProjectLink } from "@prisma/client";

const linkTypeLabels: Record<(typeof projectLinkTypeOptions)[number], string> = {
  REPOSITORY: "Repository",
  LIVE_DEMO: "Live demo",
  DOCUMENTATION: "Documentation",
  OTHER: "Other",
};

type ProjectWithLinks = Project & { links: ProjectLink[] };

export function ProjectForm({
  project,
  categories,
}: {
  project: ProjectWithLinks | null;
  categories: ProjectCategory[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = project ? updateProjectSchema : createProjectSchema;
  const form = useForm<CreateProjectInput | UpdateProjectInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(project ? { id: project.id } : {}),
      title: project?.title ?? "",
      slug: project?.slug ?? "",
      summary: project?.summary ?? "",
      description: richTextToParagraphs(project?.description).join("\n\n"),
      categoryId: project?.categoryId ?? "",
      tags: project?.tags.join(", ") ?? "",
      startDate: project?.startDate ? project.startDate.toISOString().slice(0, 10) : "",
      endDate: project?.endDate ? project.endDate.toISOString().slice(0, 10) : "",
      links: project?.links.map((l) => ({ type: l.type, label: l.label ?? "", url: l.url })) ?? [],
    },
  });

  const linkFields = useFieldArray({ control: form.control, name: "links" });

  function onSubmit(values: CreateProjectInput | UpdateProjectInput) {
    setFormError(null);
    startTransition(async () => {
      const result = project
        ? await updateProjectAction(values as UpdateProjectInput)
        : await createProjectAction(values as CreateProjectInput);

      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      router.push("/dashboard/projects");
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input placeholder="auto-generated from title if left blank" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary</FormLabel>
              <FormControl>
                <Input placeholder="One line for cards/listings" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea rows={6} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Uncategorized" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <Input placeholder="comma, separated, tags" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <FormLabel>Links</FormLabel>
          {linkFields.fields.map((linkField, index) => (
            <div key={linkField.id} className="flex gap-2">
              <FormField
                control={form.control}
                name={`links.${index}.type`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectLinkTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {linkTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FormField
                control={form.control}
                name={`links.${index}.label`}
                render={({ field }) => <Input placeholder="Label (optional)" {...field} />}
              />
              <FormField
                control={form.control}
                name={`links.${index}.url`}
                render={({ field }) => <Input placeholder="https://…" {...field} />}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => linkFields.remove(index)}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => linkFields.append({ type: "REPOSITORY", label: "", url: "" })}
          >
            Add link
          </Button>
        </div>

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : project ? "Save changes" : "Create project"}
        </Button>
      </form>
    </Form>
  );
}
