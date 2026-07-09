import type { Metadata } from "next";
import { getDefaultWorkspace } from "@/lib/workspace";
import { requireEnabledPage } from "@/features/navigation/queries";
import { resolveSeoMetadata } from "@/features/seo/queries";
import { toMetadata } from "@/features/seo/to-metadata";
import { ContactForm } from "@/features/contact/components/contact-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getDefaultWorkspace();
  return toMetadata(await resolveSeoMetadata(workspace.id, "CONTACT"));
}

export default async function ContactPage() {
  const workspace = await getDefaultWorkspace();
  await requireEnabledPage(workspace.id, "CONTACT");

  return (
    <div className="mx-auto max-w-md space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Contact</h1>
      <ContactForm />
    </div>
  );
}
