import type { NavigationPage } from "@prisma/client";

// The pages that actually exist as public routes. CERTIFICATIONS stays out
// of this list — the enum value is reserved (database-design.md §5) but
// there's no module/route behind it yet (cut from M1).
export const SEEDED_NAV_PAGES: NavigationPage[] = [
  "HOME",
  "PROJECTS",
  "SKILLS",
  "EXPERIENCE",
  "EDUCATION",
  "ABOUT",
  "CONTACT",
  "RESUME",
];

export const DEFAULT_NAV_LABELS: Record<NavigationPage, string> = {
  HOME: "Home",
  ABOUT: "About",
  SKILLS: "Skills",
  EXPERIENCE: "Experience",
  EDUCATION: "Education",
  CERTIFICATIONS: "Certifications",
  PROJECTS: "Projects",
  CONTACT: "Contact",
  RESUME: "Resume",
};

export const NAV_PAGE_HREF: Record<NavigationPage, string> = {
  HOME: "/",
  ABOUT: "/about",
  SKILLS: "/skills",
  EXPERIENCE: "/experience",
  EDUCATION: "/education",
  CERTIFICATIONS: "/certifications",
  PROJECTS: "/projects",
  CONTACT: "/contact",
  RESUME: "/resume",
};
