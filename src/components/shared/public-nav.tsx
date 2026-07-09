import Link from "next/link";
import type { PublicNavLink } from "@/features/navigation/queries";

export function PublicNav({ links }: { links: PublicNavLink[] }) {
  return (
    <nav className="flex gap-4 border-b p-4 text-sm">
      {links.map((link) => (
        <Link key={link.page} href={link.href} className="hover:underline">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
