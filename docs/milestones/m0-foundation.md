# M0 — Foundation

> Milestone from `architecture.md` §15. Status: **done**.

## Summary

Stood up the deployable skeleton: Next.js 15 (App Router, TS strict) + Tailwind v4 + shadcn/ui,
Prisma against local Docker Postgres (identity/tenancy schema only — `User`, `Account`,
`VerificationToken`, `Workspace`, `Membership`), Auth.js v5 (Credentials + JWT sessions),
middleware-based dashboard concealment, a `createAction` wrapper (auth → policy → Zod →
handler → envelope) and a minimal policy engine, and CI (typecheck/lint/build). Exercised the
whole chain with one real (if small) feature — editing the workspace site title from the
dashboard — rather than a throwaway smoke test.

Verified locally, live: unauthenticated `/dashboard` → 404 (URL unchanged); credentials sign-in
→ session cookie → `/dashboard` → 200 rendering the correct email/role/workspace; public `/`
renders the seeded workspace's `siteTitle` from the database.

## Decisions made

- **Hand-authored the scaffold instead of `create-next-app`.** The repo already had a committed
  feature-first tree (`docs/architecture.md` §4); `create-next-app` both refuses non-empty
  directories and would have generated a conflicting default structure.
- **Tailwind v4**, CSS-first config (`@theme` in `globals.css`) — current recommended path for
  new Next 15 projects, and its CSS-variable model pairs naturally with the token-based theme
  system landing in M2.
- **Auth.js v5, Credentials provider, JWT sessions, no database adapter.** JWT was already the
  architecture decision (middleware runs on Edge, can't do a DB round-trip); no adapter is
  needed because nothing persists server-side sessions. Split `auth.config.ts` (edge-safe:
  callbacks + pages, no providers needing Node APIs) from `auth.ts` (adds Credentials, which
  calls Prisma + bcrypt and therefore must stay off the Edge runtime).
- **Middleware does zero DB work.** Tenant resolution in v1 is a hardcoded single workspace —
  real per-request DB reads happen in the Node-runtime RSC page, not in Edge middleware, since
  Prisma can't run there without a driver adapter we haven't adopted.
- **Dashboard concealment via rewrite, not redirect.** Unauthenticated `/dashboard/**` rewrites
  to a top-level `/concealed-404` page that calls `notFound()` — URL bar stays on the original
  path, response is a genuine 404. That route sits outside the middleware matcher so there's no
  rewrite loop.
- **UUIDv7 via a Prisma Client extension**, not a DB default — Postgres has no native v7
  generator. `src/lib/db.ts` keeps an explicit allow-list of models that get an auto-generated
  `id` on create; `Membership` is excluded (composite natural PK). The list is meant to grow
  with each milestone, not to be reintroduced from scratch.
- **`createAction` demonstrated with a real (if tiny) mutation** — editing the workspace site
  title — instead of a throwaway "ping" action. Also clarified a boundary the architecture doc
  implied but didn't spell out: `createAction` wraps *mutations* only; reads stay direct Prisma
  calls in RSCs/`queries.ts`, so nothing here reads through it.
- **Prisma schema scoped strictly to M0** — no `Profile`/`Project`/`Theme`/etc. yet, and
  `Workspace.activeThemeId` is deferred to M2 since the `Theme` table it FKs to doesn't exist
  yet. Kept the migration set small and honest about what's actually built.
- **Login at `/access`**, not `/login` — cheap partial mitigation from the security review's
  "non-obvious route" note. Not the actual defense (auth is); just doesn't advertise itself.
- **Pages marked `force-dynamic`** rather than left to default static/ISR behavior — they read
  from the DB and there's no cacheable content model yet (that's the ISR + tag-revalidation work
  in M1). Keeps `next build`/CI from needing a live database.
- **GitHub remote created and pushed** (`ahmednasser111/portofolio-maker`, private).

## Tradeoffs

- The `createAction` wrapper re-fetches the actor's `Membership` on every call rather than
  trusting anything cached in the JWT beyond `userId`. Slightly more DB load per mutation;
  buys correctness if a role changes mid-session (JWT wouldn't reflect a stale role otherwise).
  Fine at v1 scale; worth revisiting if per-mutation latency ever matters.
- CI builds against a placeholder `DATABASE_URL` rather than spinning up a real Postgres
  service container. Works because every DB-touching page is `force-dynamic` (no build-time
  queries), but means CI doesn't currently catch a broken migration — only `prisma generate`
  (schema-valid) is checked, not `migrate deploy` against a real database. Acceptable while the
  schema is this small; flagged as a gap to close before the schema grows in M1.
- Login form is invoked directly from a client component (`await signInAction(values)`) rather
  than via the native `<form action={}>` binding some Auth.js examples use. Chosen to fit RHF's
  `handleSubmit` pattern consistently with how every future feature form will work — costs one
  extra `router.refresh()` call after a successful sign-in.

## Risks

- No test suite yet (by design — that's M6). The `createAction` wrapper, policy matrix, and
  UUIDv7 extension are exactly the kind of load-bearing seam the roadmap flags for coverage;
  they're currently only verified by the manual login/curl pass done in this milestone.
- The Prisma Client UUIDv7 extension's allow-list (`src/lib/db.ts`) is easy to forget to update
  — adding a new `@id` model in M1+ without adding it to `UUID_ID_MODELS` would silently leave
  `id` unset and fail at insert time (loud failure, not silent corruption, but still a manual
  step to remember). Worth a lint rule or test if it bites us.
- `next-auth@beta` (v5) is still pre-1.0. Pinned, not on a floating range, but a future
  dependency bump needs a changelog check, not a blind upgrade.

## Future considerations

- M1 introduces the real content schema (Profile, Project, Skills, …) and is when the "canary
  second workspace" seed (per `database-design.md` §14.5) should actually land — there's no
  content yet to test isolation against, so it was correctly skipped here.
- M2 adds the `Theme` table and `Workspace.activeThemeId`; also the point where `force-dynamic`
  gets replaced by real ISR + tag-based revalidation once there's cacheable content.
- Revisit CI to run migrations against an actual Postgres service container once the schema is
  non-trivial enough that a broken migration is a real risk worth catching in CI.
