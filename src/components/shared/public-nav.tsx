import Link from "next/link";

// Static for M1 — NavigationItem (DB-driven enable/rename/reorder) is M2.
const links = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/skills", label: "Skills" },
  { href: "/experience", label: "Experience" },
  { href: "/education", label: "Education" },
];

export function PublicNav() {
  return (
    <nav className="flex gap-4 border-b p-4 text-sm">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="hover:underline">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
