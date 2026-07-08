import { PublicNav } from "@/components/shared/public-nav";

// Theme token injection lands in M2. Nav is a static list for now —
// NavigationItem (DB-driven enable/rename/reorder) is also M2.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      <main>{children}</main>
    </>
  );
}
