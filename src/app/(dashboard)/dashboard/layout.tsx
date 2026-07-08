import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardNav } from "@/components/shared/dashboard-nav";

// Defense in depth (architecture.md §6.5): middleware already conceals
// unauthenticated access with a 404 rewrite before requests reach here, but
// this layout re-verifies independently rather than trusting that alone.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/access");
  }

  return (
    <div className="min-h-screen space-y-6 p-6">
      <DashboardNav />
      {children}
    </div>
  );
}
