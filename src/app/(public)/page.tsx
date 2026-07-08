import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workspace = await getDefaultWorkspace();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <h1 className="text-2xl font-semibold">{workspace.siteTitle ?? workspace.slug}</h1>
    </main>
  );
}
