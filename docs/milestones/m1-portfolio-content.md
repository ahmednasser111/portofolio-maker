# M1 — Portfolio Content Management Foundation

> Status: **done**. Builds on M0 (`docs/milestones/m0-foundation.md`) without modifying it.

## 1. Summary

Implemented the real content model and first complete CRUD workflow: Profile, Projects (with
categories and typed links), Skills (with categories), Experience, Education, and Social Links —
full dashboard management for all six, and full public rendering from Postgres for all six.
GitHub/Resume import stay schema-only placeholders (`ContentSource` enum + provenance columns on
Project) — no import pipeline yet, as scoped.

Verified locally, live: every dashboard page renders (200) for the authenticated OWNER and 404s
when logged out (M0 regression intact); seeded real rows through Prisma directly (bypassing the
UI, as a stand-in for browser automation) and confirmed the full chain — dashboard list pages,
public home hero, `/projects` + `/projects/[slug]`, `/skills`, `/experience`, `/education` — all
rendered the seeded data correctly, then cleaned the verification data back out.

## 2. Architectural decisions

Full reasoning for each of these was presented before implementation (per your process) — this
section is the durable record.

- **Four additive deviations from the Database Design Document**, none structural: (1) `Profile`
  gains `position`, `availability`, `heroCtaLabel`/`heroCtaUrl` — fields this milestone's
  objectives asked for that the DDD hadn't itemized; (2) `Profile.avatarUrl`/`resumeUrl` are
  plain URL strings rather than FKs into the DDD's `Asset` table — file uploads are deferred to
  whichever milestone actually needs them; (3) a new `ProjectCategory` entity mirrors
  `SkillCategory` (categories as rows, per the DDD's own normalization rule) but `SetNull`s
  `Project.categoryId` on delete instead of cascading — a project is independent and valuable, a
  skill is a meaningless leaf outside its category; (4) `visible` added to `Skill`/`Experience`/
  `Education` (`SocialLink` already had it).
- **Certifications and `ProjectMedia`** — both in the original roadmap's M1 sketch — are cut from
  this milestone since the concrete objectives didn't ask for them. Same patterns (Experience's
  for Certifications, the deferred Asset table for ProjectMedia) cover them trivially later.
- **Rich text as schema-versioned plain text**, not a WYSIWYG: `{ schemaVersion: 1, content }` /
  `{ schemaVersion: 1, items }` in `src/lib/rich-text.ts`, used by `Profile.bio`,
  `Project.description`, `Experience.highlights`. Satisfies the DDD's "schema-versioned JSON"
  design literally; a real editor becomes a compatible upgrade (bump `schemaVersion`) later, not
  a migration.
- **Reordering via move-up/down**, not drag-and-drop — no new frontend dependency, fine at the
  row counts a personal portfolio actually has. Shared as a plain utility
  (`src/lib/sort-order.ts`), not a component abstraction.
- **Slug generation**: `slugify()` + collision-suffixing (`src/lib/slug.ts`), auto-suggested from
  title but editable. The uniqueness constraint is the DDD's anticipated **hand-edited partial
  unique index** (`WHERE "deletedAt" IS NULL`) — hit for the first time in this milestone, along
  with the same pattern for `skill_categories.name` and `skills.name`. Documented inline in the
  migration file's header, per the convention M0 flagged it would need.
- **`createAction` reused unchanged** for every mutation across all six modules — no wrapper
  changes needed. **Policy engine reused unchanged** too — every module maps to the existing
  `content` resource in `src/domain/policy/can.ts`. Both confirm M0's abstractions were scoped
  correctly rather than needing rework.
- **One category per project** (FK, not M:N) and **`tags` stays a plain string array** (the
  DDD's `techStack`, same field) — matches how a portfolio site actually filters, avoids a join
  table nothing asked to be multi-valued.
- **Static public nav** (`src/components/shared/public-nav.tsx`) and a **shared dashboard nav**
  (`src/components/shared/dashboard-nav.tsx`) — the one piece of intentionally shared UI, since
  it's cross-cutting layout chrome, not feature logic. `NavigationItem` (DB-driven enable/rename/
  reorder) is still M2 — this nav is a placeholder, not the real system.
- **Accepted duplication across Experience/Education/Social Links' manager components** by
  design, per your explicit instruction — each module owns its components rather than sharing a
  generic list/ordering abstraction. Skills/Project categories share a near-identical shape too,
  for the same reason.
- **Discovered and fixed a real gap in the M0 `createAction`/UUIDv7 design**: the Prisma Client
  extension in `src/lib/db.ts` only intercepts top-level `.create()` calls, not nested writes
  (e.g. `project.create({ data: { links: { create: [...] } } })`), and — more fundamentally —
  TypeScript requires `id` explicitly at every call site regardless, since the schema has no
  `@default()` for it. Every create call site in this milestone passes `id: uuidv7()` explicitly;
  the extension remains as a defensive backstop, not the primary mechanism. This should have been
  caught in M0's milestone doc and wasn't — noted here so it isn't lost.
- **`Prisma.JsonNull` vs plain `null`**: nullable `Json?` columns require the sentinel
  `Prisma.JsonNull`, not `null`, to clear the column to SQL NULL. Used consistently in
  Profile/Project/Experience's rich-text field handlers.

## 3. Database changes

One migration, `m1_portfolio_content` (schema and full rationale in `docs/database-design.md`
§4.2–§4.5; deviations above). New enums: `AvailabilityStatus`, `ProjectStatus`, `ContentSource`,
`ProjectLinkType`, `SkillLevel`, `EmploymentType`. New tables: `profiles`, `project_categories`,
`projects`, `project_links`, `skill_categories`, `skills`, `experiences`, `educations`,
`social_links`. Three hand-edited partial unique indexes (`projects.slug`,
`skill_categories.name`, `skills.name`, all `WHERE "deletedAt" IS NULL`) — documented inline in
the migration file. `src/lib/db.ts`'s `UUID_ID_MODELS` allow-list extended with every new model.

## 4. Tradeoffs

- Inline `useState`-managed forms (Skills/Categories/Experience/Education/Social Links) instead
  of React Hook Form, reserving RHF for the two full-page forms (Profile, Project) where Zod's
  field-level error messages matter more. Less validation polish on the small inline editors —
  acceptable since the server action is still the authoritative validator either way.
- Project edit replaces all `ProjectLink` rows on every save (delete-then-recreate) rather than
  diffing. Simple to reason about; fine at 2–4 links per project — would need revisiting if
  projects ever had dozens of links.
- Ordering (`sortOrder`) for Projects is workspace-wide, not per-category — matches the DDD's
  `(workspaceId, status, sortOrder)` index and how the listing page actually queries, at the cost
  of "reorder within category" not being a distinct operation from "reorder overall."
- Verification used direct Prisma inserts rather than clicking through the actual dashboard forms
  in a browser (no browser automation available here) — confirms the query/render layer
  thoroughly, but the RHF/Zod client-side form paths themselves (Profile, Project) weren't
  exercised end-to-end by a real submit. Worth a manual click-through before this is genuinely
  "done" in the eyes of daily use.

## 5. Risks

- **`createAction`'s id-generation gap** (§2) means every future module's `.create()` calls must
  remember `id: uuidv7()` by hand — TypeScript enforces it (compile error if forgotten), so this
  is a loud failure, not a silent one, but it's a manual step every module repeats. A future
  Prisma Client extension approach that's actually type-transparent (if Prisma ever supports it)
  would remove this repetition.
- **Delete-then-recreate on `ProjectLink`** briefly leaves a project with zero links mid-transaction
  — wrapped in `db.$transaction` so it's atomic from any concurrent reader's perspective, but
  worth knowing if link-count invariants are ever added.
- **No tests** (still by design, M6). The slug-collision logic, the rich-text schema-version
  helpers, and the sort-order swap logic are the load-bearing seams introduced this milestone
  most worth covering first when M6 arrives.
- **Static nav duplication**: the dashboard nav and public nav are two separate hardcoded lists.
  Low risk (both are placeholder until M2's `NavigationItem`), but a page added to one without
  the other is an easy miss until then.

## 6. Future considerations

- M2 (Theme + `NavigationItem` + SEO) replaces both static nav components with the DB-driven
  version, and gives the public layout real token-based styling instead of the current bare
  Tailwind defaults.
- Certifications slots in later using the exact Experience/Education stamp (schema + inline
  manager component) — no new pattern needed.
- The Asset/upload subsystem, whenever it lands (resume import in M4, or sooner if wanted),
  upgrades `Profile.avatarUrl`/`resumeUrl` and adds `ProjectMedia` — both call sites are already
  isolated to a handful of known spots.
- Rich text can upgrade from plain-text-JSON to a real block editor by bumping `schemaVersion`
  and adding a migration function in `src/lib/rich-text.ts` — no table changes needed.

## 7. Manual testing checklist

Dashboard (as the seeded OWNER):
- [ ] Profile: fill out every field, save, reload — values persist; clear a field, save — it's
      actually cleared (not stuck from a previous save).
- [ ] Projects: create a category, rename it, reorder it; create a project with a category, tags,
      dates, and 2+ links; edit it (change slug, links); publish → verify status badge; unpublish;
      archive; feature/unfeature; reorder two projects; delete a project (confirm dialog fires);
      delete a category that has projects in it → those projects show "Uncategorized".
- [ ] Skills: create category, add skills with/without a level, reorder within category, hide a
      skill, delete a skill, delete a category with skills in it → skills disappear from the
      public site (soft-deleted, not just hidden).
- [ ] Experience / Education: add, edit every field (including clearing end date to mean
      "present" for Experience), reorder, hide, delete.
- [ ] Social Links: add, edit, reorder, hide, delete.

Public site:
- [ ] `/` reflects Profile (hero, availability, CTAs, bio paragraphs), featured projects, social
      links; renders a graceful empty state with no profile at all.
- [ ] `/projects` lists only published projects; `/projects/[slug]` 404s for a draft/archived/
      unknown slug and shows links/tags/category for a published one.
- [ ] `/skills`, `/experience`, `/education` show only `visible` rows in the right order.

Cross-cutting:
- [ ] Logged out, `/dashboard/**` still 404s (URL unchanged) — M0 regression check.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` green locally; CI green after push.
