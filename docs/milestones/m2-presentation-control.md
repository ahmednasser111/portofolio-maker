# M2 — Presentation Control

> Status: **done**. Builds on M0 (foundation) and M1 (portfolio content) without modifying them.

## 1. Summary

Implemented the full presentation-control layer: Theme (complete token surface — typography,
light/dark colors, spacing, radius, shadows, animation, layout variants — server-rendered as CSS
custom properties, no flash, with clone-on-activate presets), Navigation (enable/rename/reorder
per page, disabled pages 404), SEO (per-page title/description/OG/noindex, `sitemap.xml`,
`robots.txt`), Contact (public form with honeypot + time-trap, dashboard inbox), and the About and
Resume public pages the roadmap's M2 needed to exist for Navigation's page set to make sense.

Verified locally, live: theme preset activation changes the public site's rendered CSS variables;
disabling a nav page both removes it from the public nav and 404s its route; a custom per-page SEO
title overrides the rendered `<title>`; a contact submission lands in the dashboard inbox;
`sitemap.xml`/`robots.txt` render correctly; M0's dashboard-concealment regression still holds.

## 2. Architectural decisions

- **Full theme token surface, as you chose**, but the DDD/architecture doc's guardrail against
  scope creep (§16) still holds structurally: the schema is a closed set of categories and
  variant *enums* (`hero: "centered"|"split"`, `projects: "grid"|"list"`, etc.), not a raw
  CSS/class passthrough. "Full" means the complete bounded schema, not an escape hatch.
- **Kept M1's file-handling deferral**: `SeoSetting.ogImageUrl` is a plain string, matching
  `Profile.avatarUrl`/`resumeUrl` — no Asset table this milestone either.
- **`workspaces.activeThemeId` introduced now** (deferred since M0) since `themes` finally exists.
  A theme is edited in place (one workspace-owned "live" theme, updated on every save); only
  activating a *preset* creates a new row (clone-on-activate, per DDD §11) — so casual saves don't
  proliferate theme rows, only preset switches do.
- **Navigation seeding is lazy and page-scoped**, not a migration-time data seed: public pages
  read `NavigationItem` rows with a "no row yet ⇒ enabled, default order" fallback, so a fresh
  workspace's nav isn't empty and public requests cost zero extra writes. Real rows only get
  created (idempotent upsert) when an admin visits the dashboard Navigation page — the one place
  that actually needs rows to toggle/rename/reorder.
- **`CERTIFICATIONS` stays in the `NavigationPage` enum but unseeded** — matches the DDD's schema
  fidelity (§5) without offering a toggle for a page that would unconditionally 404 (that module
  was cut from M1).
- **Contact submission is a standalone action, not `createAction`-wrapped** — same reasoning as
  M0's `signInAction`: no actor exists pre-submission to run a policy check against. It still
  returns the same `ActionResult` envelope shape by convention.
- **No real rate limiting on the contact form, stated plainly rather than silently absent.**
  Honeypot + a minimum-fill-time check are zero-infrastructure and genuinely stop unsophisticated
  bots; a distributed limiter needs a durable store (an in-memory one would silently no-op across
  Vercel's stateless serverless invocations, which is worse than nothing because it looks like
  protection). Deferred, flagged as a risk below, not quietly skipped.
- **Discovered a second real Prisma typing gap** (after M1's UUIDv7 one): `findUnique` on a
  compound unique key that includes a nullable field (`SeoSetting`'s `(workspaceId, page)`, hand-
  edited to `NULLS NOT DISTINCT`) doesn't accept `page: null` in its generated TypeScript type,
  even though the database constraint is exactly designed to make that lookup well-defined.
  Prisma's types don't know about the hand-edit. Worked around with `findFirst` + manual
  find-then-create-or-update instead of `upsert` — functionally identical, the DB constraint still
  guarantees at most one row either way. Documented inline in `src/features/seo/queries.ts` and
  `actions.ts` so it isn't rediscovered from scratch next time a nullable-field compound unique
  shows up.
- **`prisma migrate dev` doesn't work at all in this non-interactive environment** (discovered
  this milestone, not M1 — M1's migrations happened to avoid the code path that triggers it). Even
  `--create-only` prompts for confirmation when the schema diff includes anything the CLI
  considers "risky," and there's no TTY to answer it. Worked around with `prisma migrate diff`
  against a throwaway shadow database to get the SQL, hand-assembled the migration folder, and
  applied it with `prisma migrate deploy` (which is designed to be non-interactive). The diff also
  surfaced a real, useful thing to know: Prisma's differ doesn't understand the partial indexes
  from M1's hand-edits and proposed recreating them — those statements were removed from the
  final migration since the indexes already exist. This is now the documented migration workflow
  for this environment, not a one-off workaround — see the note added to `database-design.md`'s
  spirit (recorded here and in memory, since the DDD itself is about design not tooling
  mechanics).

## 3. Database changes

One migration, `m2_presentation_control` (hand-assembled per the discovery above — see its header
comment for the exact edits). New enum: `NavigationPage`. New tables: `themes` (+ CHECK
`isPreset ⇒ workspaceId IS NULL`, hand-edited), `navigation_items`, `seo_settings` (+
`NULLS NOT DISTINCT` unique, hand-edited), `contact_messages`. New column:
`workspaces.activeThemeId` (nullable FK, `onDelete: Restrict`). `UUID_ID_MODELS` in `src/lib/db.ts`
extended with `Theme`, `NavigationItem`, `SeoSetting`, `ContactMessage`. Two global theme presets
("Default", "Ocean") added to `prisma/seed.ts`.

## 4. Tradeoffs

- Theme editor uses plain text inputs (with a live color-swatch preview) rather than a color-picker
  or slider widgets — keeps the *implementation* simple despite the *schema* being complete, no new
  UI dependency for something the roadmap didn't ask for.
- Layout variants only branch in two places (Home hero, Projects listing) — the other token
  categories (typography, spacing, shadows, animation intensity) are stored, validated, and
  emitted as CSS variables, but nothing in the current markup consumes the finer-grained ones
  beyond what Tailwind's defaults already do. They're real and wired end-to-end at the data layer;
  visually exercising all of them further is component-styling work, not an architecture gap.
- SEO per-page rows use the fixed `NavigationPage` enum as their key, which is why individual
  project pages get their own metadata resolution (project title/summary) instead of a
  `SeoSetting` row each — there's no per-project SEO override table, and that felt like the right
  scope line rather than adding one unasked-for.

## 5. Risks

- **Contact form has no real rate limiting** (stated above, not hidden). If spam becomes an actual
  problem before a proper limiter is built, the honeypot/time-trap combination is the only current
  defense.
- **Theme editor is the largest form in the app** (~45 fields). It's validated the same way every
  other form is (Zod, server-authoritative), so a bad save is rejected with field errors rather
  than corrupting rendering — but it's the first place a future contributor is likely to feel the
  "no shared form abstraction" decision's weight, since it's the one form big enough that a
  section-repeating helper might start to pay for itself. Noted for the M6 risk review, not
  acted on now.
- **The `prisma migrate dev` non-interactivity issue will recur** every future milestone that adds
  a migration in this environment. The shadow-database-diff workaround is now documented, but it's
  a manual, easy-to-get-wrong process (forgetting to drop the shadow DB, missing a diff-noise
  statement) compared to the tool just working. Worth revisiting if this ever runs somewhere with
  a proper TTY (e.g., a real terminal session instead of this harness).

## 6. Future considerations

- M3/M4 (GitHub/Resume import) are unaffected by this milestone — no schema overlap.
- Whenever a real Asset/upload subsystem lands, `SeoSetting.ogImageUrl` upgrades the same way
  `Profile.avatarUrl`/`resumeUrl` will.
- A theme marketplace/template system (mentioned in the DDD as a future direction) is already
  most of the way there: presets are global rows and clone-on-activate *is* the "install" flow.
- If the contact form ever needs real rate limiting, Upstash Redis (or Vercel KV) is the natural
  fit for a serverless deployment — sized as its own small task, not a re-opening of this
  milestone.

## 7. Manual testing checklist

Dashboard (as the seeded OWNER):
- [ ] Theme: edit a handful of tokens across each section, save, confirm the public site reflects
      them; activate each preset, confirm it clones (doesn't mutate the preset) and the public
      site updates.
- [ ] Navigation: disable a page, confirm it disappears from public nav and 404s directly; rename
      a page's label; reorder two pages; re-enable.
- [ ] SEO: set a title/description/OG image on one page and on the Defaults row, confirm the
      public page's `<title>`/meta tags reflect the page-specific one, and an un-set page falls
      back to Defaults then to the workspace site title.
- [ ] Messages: submit the public contact form for real (through a browser, not curl) and confirm
      it lands in the inbox; mark read; delete.

Public site:
- [ ] `/about` and `/resume` render Profile data gracefully with nothing set (empty states).
- [ ] `/sitemap.xml` lists exactly the enabled, non-noindex pages plus published project slugs;
      `/robots.txt` disallows `/dashboard`, `/access`, `/concealed-404`.
- [ ] Hero layout variant (`centered` vs `split`) and Projects layout variant (`grid` vs `list`)
      visibly change when toggled in the Theme editor.

Cross-cutting:
- [ ] Logged out, `/dashboard/**` still 404s — M0 regression check.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` green locally; CI green after push.
