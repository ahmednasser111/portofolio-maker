# Portfolio CMS — System Architecture Document

> **Status:** Approved, v1.0 — source of truth for implementation.
> **Companion doc:** [`database-design.md`](./database-design.md) (Database Design Document, Part II).

---

## 1. Executive Summary

This system is a **multi-tenant-ready Portfolio CMS** built as a single Next.js App Router application containing two logically separate surfaces:

1. **Portfolio Renderer** — the public website. 100% database-driven, statically cached, zero hardcoded content.
2. **Admin Dashboard** — a hidden, authenticated management surface for all content, theming, imports, integrations, and analytics.

The core architectural bets, each justified later in this document:

| Decision | Choice | Why |
|---|---|---|
| Deployment shape | **Modular monolith** (one Next.js app) | One deploy, shared types, RSC data access without network hops. Split later only if load demands it. |
| Tenancy | **Workspace-scoped from day one** | Every content row carries a `workspaceId`. V1 has exactly one workspace, but SaaS expansion becomes a UI/billing problem, not a data-migration problem. |
| Imports (GitHub, Resume, future) | **Provider abstraction + staging pipeline** | All imports flow through the same `connect → fetch → stage → review → commit` pipeline. Imported content becomes ordinary editable rows; sync never overwrites local edits. |
| Analytics | **First-party event pipeline** (raw events + rollups in Postgres) | The required metrics (project clicks, resume downloads, per-project popularity) are custom events no third-party tool gives you cleanly. Also the strongest portfolio showcase piece. |
| Theming | **Design-token JSON → CSS custom properties**, rendered server-side | No flash of unstyled/wrong theme, Tailwind and shadcn/ui already consume CSS variables, and "multiple themes" becomes "multiple token documents." |
| Public rendering | **RSC + ISR with tag-based revalidation** | Portfolio pages are read-heavy and change rarely. Cache per workspace, invalidate on publish. Scales from 1 to 10,000 tenants without touching the read path. |

The guiding principle: **v1 ships a single-user product on a multi-user skeleton.** We pay the small, cheap costs of future-proofing now (workspace column, provider interface, token-based themes) and explicitly *defer* the expensive ones (billing, team UI, custom domains, per-tenant routing).

---

## 2. Overall Architecture

### 2.1 System context

```
                        ┌────────────────────────────────────────────────┐
                        │                 Vercel Platform                │
                        │                                                │
  Visitor ──────────────┼──▶  Public Portfolio (RSC + ISR cache)         │
     │                  │         │                                      │
     └── beacon ────────┼──▶  Analytics Ingest (Route Handler, edge-ish) │
                        │         │                                      │
  Admin ────────────────┼──▶  Dashboard (auth-gated, dynamic RSC + RSA)  │
                        │         │                                      │
                        │    ┌────▼─────────────────────────┐            │
                        │    │  Application Core            │            │
                        │    │  (feature modules, policies, │            │
                        │    │   providers, data access)    │            │
                        │    └────┬─────────────────────────┘            │
                        │         │                                      │
                        │    Vercel Cron ──▶ Analytics Rollup Job        │
                        └─────────┼──────────────────────────────────────┘
                                  │
             ┌────────────────────┼──────────────────────┐
             ▼                    ▼                      ▼
      PostgreSQL           Blob Storage           External Providers
      (Prisma,             (resume PDFs,          ├─ GitHub API
       pooled)              images/media)         ├─ Vercel API
                                                  └─ LLM API (resume parse)
```

### 2.2 Internal layering

```
┌───────────────────────────────────────────────────────────────┐
│ ROUTING LAYER (app/)                                          │
│   (public) route group   (dashboard) route group   api/       │
│   thin: compose features, no business logic                   │
├───────────────────────────────────────────────────────────────┤
│ FEATURE MODULES (features/*)                                  │
│   profile, projects, skills, experience, education,           │
│   certifications, social-links, navigation, theme, seo,       │
│   resume, integrations, analytics, contact, settings          │
│   each: actions + queries + schemas + components + services   │
├───────────────────────────────────────────────────────────────┤
│ DOMAIN SERVICES (cross-feature)                               │
│   auth/policy engine, provider framework, import pipeline,    │
│   event tracker, cache/revalidation service                   │
├───────────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE (lib/)                                         │
│   prisma client, blob storage adapter, crypto (token          │
│   encryption), rate limiter, geo/UA enrichment, LLM client    │
└───────────────────────────────────────────────────────────────┘
```

**Dependency rule:** arrows point downward only. Routes import features; features import domain services and infrastructure; nothing imports upward. Features never import other features' internals — cross-feature needs go through domain services or explicit public interfaces.

### 2.3 Request flows at a glance

- **Public page:** Request → (middleware: resolve tenant, v1 = default workspace) → RSC page → feature query layer (cached, tagged) → Postgres → HTML. Served from ISR cache on subsequent hits.
- **Dashboard mutation:** Form (RHF + Zod client-side) → Server Action → auth + policy check → Zod re-validation → service → Prisma write → `revalidateTag(workspace)` → typed result envelope back to form.
- **Analytics event:** Client beacon → Route Handler → bot filter + enrichment → append to events table. Cron aggregates into rollups.

---

## 3. Module Breakdown

Each module owns its schemas (Zod), its data access, its server actions/queries, and its UI components. "Owner" below means the module that is the single writer for those tables.

### Content modules

| Module | Responsibility | Owns (data) | Depends on |
|---|---|---|---|
| **profile** | Identity: name, headline, bio, avatar, contact info, resume file reference | `Profile` | auth/policy, blob storage |
| **projects** | CRUD, ordering, featured flags, media, tech tags, links (repo/demo), slugs, provenance metadata | `Project`, `ProjectMedia`, `ProjectLink` | auth/policy, import pipeline (as commit target), cache service |
| **skills** | Skills grouped into categories, proficiency, ordering | `SkillCategory`, `Skill` | auth/policy |
| **experience** | Work history entries, ordering, date ranges, highlights | `Experience` | auth/policy |
| **education** | Education entries | `Education` | auth/policy |
| **certifications** | Certification entries with issuer, credential URL, expiry | `Certification` | auth/policy |
| **social-links** | Platform, icon, URL, order, visibility | `SocialLink` | auth/policy |
| **contact** | Public contact form intake, spam defense, message inbox in dashboard | `ContactMessage` | rate limiter |

### Presentation modules

| Module | Responsibility | Owns | Depends on |
|---|---|---|---|
| **theme** | Design-token document CRUD, preset management, light/dark sets, token → CSS variable emission | `Theme` | cache service |
| **navigation** | Page enable/disable, rename, reorder; feeds both public nav and route guarding (disabled page → 404) | `NavigationItem` | cache service |
| **seo** | Per-page titles/descriptions, OG image config, sitemap/robots generation inputs | `SeoSetting` | cache service |

### Platform modules

| Module | Responsibility | Owns | Depends on |
|---|---|---|---|
| **auth** | Auth.js config, session shape, login surface, RBAC policy engine (`can(actor, action, resource)`) | `User`, `Workspace`, `Membership` | — (foundation; everything depends on it) |
| **integrations** | Provider connections (GitHub, Vercel), token lifecycle, provider registry | `ProviderConnection` | crypto, provider framework |
| **imports** | Staging pipeline shared by GitHub + Resume: sessions, staged items, review state, commit | `ImportSession`, `ImportItem` | provider framework, target content modules |
| **resume** | PDF upload, text extraction, LLM structured extraction, resume file for public preview/download | `Asset` (kind=RESUME) (+ uses imports) | blob storage, LLM client, imports |
| **analytics** | Event ingestion endpoint, enrichment, rollup jobs, reporting queries, dashboard charts | `AnalyticsEvent`, `AnalyticsDailyRollup` | rate limiter, geo/UA enrichment |
| **settings** | Workspace-level misc settings (site title, published flag, danger zone) | typed columns on `Workspace` | auth/policy |

> **Note:** the `resume` module's storage target and the `settings` module's storage shape were both revised in the Database Design Document — see `database-design.md` §4.7 (unified `Asset` table replaces a dedicated `ResumeAsset`) and §13/§14.1 (typed `Workspace` columns replace a generic key-value `Setting` table).

### Domain services (no UI)

- **Policy engine** — single choke point for authorization. Every server action and route handler calls it. Owned by auth module.
- **Provider framework** — the `ContentProvider` interface + registry (§12). Owned by integrations.
- **Cache service** — wraps Next.js `revalidateTag` with a small vocabulary of tags (`portfolio:{workspaceId}`, `theme:{workspaceId}`, …) so features never hand-roll tag strings.
- **Event tracker** — tiny client helper + server ingestion contract; features emit semantic events (`project_view`, `github_click`) without knowing storage details.

---

## 4. Folder Structure

```
src/
  app/
    (public)/                 # portfolio renderer — no auth
      layout.tsx              # injects theme CSS vars, nav from DB
      page.tsx                # home
      about/  skills/  experience/  education/
      certifications/  projects/  projects/[slug]/
      contact/  resume/
    (dashboard)/
      dashboard/              # auth-gated shell
        page.tsx              # overview
        profile/  projects/  imports/github/  imports/resume/
        integrations/vercel/  skills/  experience/  education/
        certifications/  theme/  navigation/  social/
        analytics/  seo/  settings/
    api/
      auth/[...nextauth]/     # Auth.js handlers
      track/                  # analytics beacon ingest
      integrations/           # OAuth callbacks (github, vercel)
      files/                  # resume download/preview streaming
      cron/rollup/            # Vercel Cron target (protected)
    sitemap.ts  robots.ts
  features/
    <feature>/                # one folder per module in §3
      actions.ts              # server actions (mutations)
      queries.ts              # cached read functions for RSC
      schemas.ts              # Zod — single source of truth
      service.ts              # business logic, no framework imports
      components/             # feature-specific UI
  domain/
    policy/                   # can(), roles, permission map
    providers/                # ContentProvider interface, registry,
                              #   github/, vercel/, resume/
    imports/                  # staging pipeline service
    tracking/                 # event names, tracker contract
    cache/                    # tag vocabulary + revalidation helpers
  lib/
    db.ts                     # Prisma client (pooled)
    blob.ts  crypto.ts  rate-limit.ts  geo.ts  ua.ts  llm.ts
  components/
    ui/                       # shadcn/ui primitives
    shared/                   # cross-feature composites
  styles/
prisma/
  schema.prisma  migrations/  seed.ts
```

**Why this shape:**

- **Feature-first, not layer-first.** A layer-first structure (`/actions`, `/components`, `/queries` at top level) scatters every feature across four directories; adding "Testimonials" later would mean touching all of them. Here, a new feature is one new folder plus routes — this is the property that makes the "Future Features" list cheap.
- **`app/` stays thin.** Route files compose feature components and call feature queries. All logic that would need to survive a routing change (or a future mobile API) lives in `features/` and `domain/`.
- **`domain/` holds what features share.** Putting the provider framework or policy engine inside any single feature would create sideways imports between features. This layer is the explicit home for cross-cutting business concepts.
- **Route groups give free surface separation.** `(public)` and `(dashboard)` have different root layouts (theme injection vs. admin shell), different caching behavior (static vs. dynamic), and different middleware treatment, without leaking into the URL.

---

## 5. Domain Model

All content entities carry: `id`, `workspaceId`, `createdAt`, `updatedAt`, and (where user-facing) `deletedAt` for soft delete. Described conceptually — full table-level detail (PKs, FKs, indexes, constraints) lives in `database-design.md`.

### Identity & tenancy

- **User** — a login identity. Email, name, credentials/OAuth identity (per Auth.js). Global, not workspace-scoped.
- **Workspace** — the tenant. Owns *all* content. Has a slug (future subdomain/custom-domain key), a published flag.
- **Membership** — joins User ↔ Workspace with a **role** (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`). V1 seeds exactly one User with an `OWNER` membership in one Workspace. This single join table is the entire foundation for teams and SaaS later.

### Portfolio content

- **Profile** — 1:1 with Workspace. Name, headline, bio (rich text), location, email, avatar asset, current resume asset reference.
- **Project** — title, slug (unique *per workspace*), summary, rich description, status (draft/published/archived), featured flag, display order, date range. **Provenance fields:** `source` (`MANUAL` | `GITHUB` | `RESUME`), `externalId` (e.g., GitHub repo id), `importedAt`, `sourceSnapshot` (JSON of what the provider returned at import time — enables "show upstream diff" later without enabling silent overwrite).
  - **ProjectLink** — typed links (repository, live demo, other), each independently trackable.
  - **ProjectMedia** — ordered images/video refs with alt text.
  - Tech tags: simple string array on Project for v1; promotable to a join table if tag-based filtering becomes a feature.
- **SkillCategory** → **Skill** — category (name, order) has many skills (name, proficiency level, order, optional icon).
- **Experience** — company, role, location, employment type, start/end (null end = present), highlights (rich list), order.
- **Education** — institution, degree, field, dates, description, order.
- **Certification** — name, issuer, issue/expiry dates, credential id + URL, order.
- **SocialLink** — platform (free-form string, not enum), icon key, URL, order, visible flag.
- **ContactMessage** — sender name/email, body, read flag, received timestamp.

### Presentation

- **Theme** — modeled as a table (not a singleton) so multiple themes/presets are a row-insert away; the active one is a pointer column on Workspace (`activeThemeId`), not a flag on Theme — see `database-design.md` §4.6. Holds a versioned **token document** (JSON, Zod-validated): typography scale, color palettes for light *and* dark, spacing scale, radii, shadows, animation preferences (including reduced-motion), layout variant keys.
- **NavigationItem** — page key (enum of known public pages), custom label, order, enabled flag. Disabled → hidden from nav *and* route returns 404.
- **SeoSetting** — per page key: title, description, OG config; plus workspace-level defaults.

### Integrations & imports

- **ProviderConnection** — workspace + provider type (`GITHUB`, `VERCEL`), **encrypted** access token, provider account metadata, connection status, connectedAt. One row per provider per workspace.
- **ImportSession** — workspace, provider type, status (`PENDING` → `REVIEWING` → `COMMITTED` / `DISCARDED`, plus processing/failure/rollback states), createdBy, raw payload reference. One session per import run (a GitHub repo selection batch, one resume upload).
- **ImportItem** — belongs to session. `targetType` (project, experience, skill, education, certification, profile-summary), extracted data (JSON matching the target's Zod schema), review status (`PENDING`, `ACCEPTED`, `EDITED`, `REJECTED`, …), and after commit, a pointer to the created entity.
- **Asset** — every uploaded file (avatar, project media, resume PDF, OG image): blob URL, filename, size, checksum, kind. Unified table — see `database-design.md` §4.7 (this generalizes what an earlier draft called `ResumeAsset`).

### Analytics

- **AnalyticsEvent** — append-only. Workspace, event type (enum: `page_view`, `project_view`, `project_click`, `github_click`, `demo_click`, `social_click`, `resume_download`, …), occurredAt, path, entity reference (e.g., projectId), **anonymous visitor hash** (daily-salted, no PII stored), country, city, device class, OS, browser, referrer domain.
- **AnalyticsDailyRollup** — pre-aggregated: workspace + date + dimension + dimension value + event type → count (+ unique-visitor count). Dashboards read only this table.

### Relationship summary

```
User ──< Membership >── Workspace ──── Profile (1:1)
                            │
                            ├──< Project ──< ProjectLink / ProjectMedia
                            ├──< SkillCategory ──< Skill
                            ├──< Experience / Education / Certification
                            ├──< SocialLink / NavigationItem / SeoSetting
                            ├──< ContactMessage
                            ├──< Theme (active one referenced by Workspace.activeThemeId)
                            ├──< ProviderConnection
                            ├──< ImportSession ──< ImportItem ──▶ (created entity)
                            ├──< Asset
                            └──< AnalyticsEvent / AnalyticsDailyRollup
```

---

## 6. Data Flow

### 6.1 GitHub import (manual, never auto-overwrites)

1. Admin connects GitHub (OAuth app or PAT) → token encrypted → `ProviderConnection`.
2. Admin opens GitHub Import → server fetches repo list live (name, description, language, stars, topics, homepage). Nothing stored yet.
3. Admin selects repos → system creates one `ImportSession` + one `ImportItem` per repo, mapping repo metadata → project draft shape (description → summary, homepage → demo link, topics → tech tags, repo URL → repository link).
4. **Review screen:** admin edits/accepts/rejects each item. Already-imported repos (matching `externalId`) are flagged as duplicates and skipped by default.
5. Commit → accepted items become `Project` rows with `source=GITHUB`, `externalId`, `sourceSnapshot`. Session marked `COMMITTED`. Cache tag revalidated.
6. From here the project is an ordinary editable entity. A later "re-sync" can only ever create a *new review diff* against `sourceSnapshot` — it never writes directly to the project.

### 6.2 Resume import

1. Admin uploads PDF → validated (MIME sniffing, size cap) → stored in blob storage → `Asset` (kind=RESUME).
2. Server extracts raw text from the PDF (deterministic extraction step).
3. Text goes to an LLM with a strict instruction to produce structured output matching our Zod schemas for experience/skills/projects/education/certifications/summary. Output is Zod-parsed; failures fall back to per-section retry or partial results. *(Justification in §12 — deterministic resume parsers are brittle across layouts; LLM extraction + mandatory human review is the pragmatic choice.)*
4. Parsed sections become an `ImportSession` with typed `ImportItem`s.
5. **Review screen** groups items by target type; admin edits, accepts, rejects per item. Potential duplicates (same company+role, same skill name) are flagged.
6. Commit fans out accepted items to their respective content tables with `source=RESUME`. Nothing touches the database's live content before this step.

### 6.3 Portfolio rendering

1. Request hits a `(public)` route. Middleware resolves the workspace — v1: the single default workspace; future: by hostname.
2. RSC page calls feature `queries.ts` functions. These are wrapped in Next's cache with tags like `portfolio:{workspaceId}` and read only published, non-deleted rows.
3. Root layout fetches active Theme + NavigationItems; theme tokens are emitted as CSS custom properties in a server-rendered `<style>`/inline root attribute — **no client-side theme fetch, no flash**.
4. Page is cached via ISR. Any dashboard mutation calls the cache service → `revalidateTag` → next request re-renders once.
5. Disabled pages (Navigation module) render 404. Resume preview streams the public `Asset` through a route handler (which also lets us count downloads server-side).

### 6.4 Analytics

1. A tiny client tracker in the public layout sends beacons (`navigator.sendBeacon`/fetch) to `POST /api/track`: event type, path, entity id, referrer. **No cookies, no localStorage** — visitor identity is computed server-side.
2. Ingest handler: rate limit per IP → bot filter (UA heuristics + header sanity) → enrich with Vercel geo headers (country/city) and parsed UA (device/OS/browser) → compute `hash(dailySalt + ip + ua)` for unique-visitor counting → append `AnalyticsEvent`. Raw IP is **never stored**.
3. Server-observed events (resume download) are recorded directly by their route handlers — more reliable than client beacons.
4. Vercel Cron hits `/api/cron/rollup` (secret-protected): aggregates yesterday's events into `AnalyticsDailyRollup` across dimensions (country, city, device, OS, browser, event type, project).
5. Dashboard analytics pages query rollups (fast, small) via TanStack Query for interactive date-range filtering; "today" can be computed live from the raw table since one day of events is small.

### 6.5 Authentication

1. Admin visits login (linked nowhere on the public site).
2. Auth.js verifies credentials/OAuth → issues **JWT session** containing userId, active workspaceId, and role. *(JWT over database sessions: middleware runs in the Edge runtime where a DB round-trip per request is costly/awkward; revocation needs are minimal for v1 and can be handled with a token-version claim later.)*
3. Middleware guards `/dashboard/**`: no valid session → **rewrite to 404** (not a redirect to login — see §13, dashboard concealment).
4. Defense in depth: the dashboard layout re-verifies the session server-side, and **every server action independently** re-checks session + membership + `can(actor, action, resource)`. Middleware is a convenience layer, never the only gate.

---

## 7. Authentication Architecture

- **Users** are global identities; **Workspaces** own content; **Membership** binds them with a role. Ownership is *always* expressed through Membership — never a `userId` on content rows. Content rows reference `workspaceId` only. This is the single most important SaaS-readiness decision: adding a second admin or a second tenant requires zero schema change.
- **Roles** (on Membership): `OWNER` (everything, incl. destructive settings and integrations), `ADMIN` (all content + theme + analytics), `EDITOR` (content CRUD only), `VIEWER` (read-only dashboard). V1 uses only `OWNER`, but the policy engine speaks this vocabulary from day one.
- **Permissions** live in a central policy module as a static map `role → allowed actions per resource type`, exposed as `can(actor, action, resource)`. Features never inline role checks — one choke point means one place to audit and one place to extend (per-resource permissions, feature flags) later.
- **Session claims** carry `{ userId, workspaceId, role }`. All server actions derive the workspace from the session, **never from client input** — this structurally eliminates cross-tenant IDOR for mutations.
- **Registration is disabled** in v1. The single admin user is seeded. Sign-up flows are a SaaS-phase feature.

---

## 8. API Design Philosophy

### Server Actions vs Route Handlers — a clear rule, not case-by-case taste

| Use **Server Actions** for | Use **Route Handlers** for |
|---|---|
| All dashboard mutations (CRUD, reorder, theme save, import review decisions) | Analytics beacon ingest (public, high-volume, called from non-form context) |
| Anything invoked from a React form/component by an authenticated user | OAuth callbacks (GitHub, Vercel) — external redirect targets |
| | File streaming (resume preview/download) — needs response-body control |
| | Cron endpoints — invoked by platform, not a user |
| | Auth.js catch-all |

Rationale: server actions give free progressive enhancement, type-safe co-location with forms, and built-in origin (CSRF) protection — ideal for the dashboard. Route handlers are for machine-to-machine and non-HTML responses. There is **no general REST API in v1**; if a public API becomes a feature, it is added as versioned route handlers reusing the same feature services (which is why services never import framework code).

### Reads

- **Public site:** RSC direct calls to `queries.ts`. No client fetching, no API layer.
- **Dashboard:** RSC for initial data; **TanStack Query** only where interactivity demands refetching — analytics date-range filtering, GitHub repo list browsing, import review. Query functions call thin route handlers or server actions; keys are namespaced per feature.

### Validation — one schema, three uses

Each feature's `schemas.ts` Zod schema is used by (1) React Hook Form via resolver for instant client feedback, (2) the server action as the **authoritative** re-validation (client validation is UX, never security), (3) the import pipeline to validate provider/LLM output before staging. Types are inferred from Zod — no hand-written duplicate interfaces.

### Error handling

- Server actions **never throw for expected failures**. They return a discriminated union envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message, fieldErrors? } }` with a small closed set of error codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `PROVIDER_ERROR`, `RATE_LIMITED`, `INTERNAL`).
- Unexpected exceptions are caught at a single wrapper (every action is built through a `createAction` helper that composes: auth → policy → Zod parse → handler → envelope), logged with a correlation id, and surfaced as `INTERNAL` with no stack/internal details leaked.
- Route handlers mirror the same envelope as JSON + proper HTTP status codes.
- The `createAction` wrapper is a deliberate pattern: it makes "forgot the auth check" structurally impossible rather than a code-review hope.

---

## 9. Database Strategy

> Full detail — every table, index, constraint, and enum — lives in `database-design.md`. This section states the strategic posture only.

- **Normalization:** 3NF for all content entities — they are relational by nature (ordering, visibility, per-row provenance). **Deliberate JSON exceptions:** theme token documents (deeply nested, always read/written whole, schema-versioned), `sourceSnapshot` on projects, and `ImportItem` extracted payloads (shape varies by target type). JSON columns are always Zod-validated at the application boundary and carry a `schemaVersion`.
- **Indexes:** every tenant-scoped table gets a composite index led by `workspaceId`. Analytics: `(workspaceId, occurredAt)` on events; unique `(workspaceId, date, eventType, dimension, dimensionValue)` on rollups. `(workspaceId, provider)` unique on connections; `(workspaceId, source, externalId)` on projects for duplicate detection.
- **Soft deletes:** `deletedAt` on user-facing content (projects, experience, etc.) — enables trash/restore UX and protects against accidental loss. Hard deletes for: analytics events (retention policy instead), import sessions/items (discardable working data), contact messages (privacy — deleting means deleting). All list queries filter `deletedAt IS NULL` via shared query helpers so the filter can't be forgotten.
- **Audit fields:** `createdAt`/`updatedAt` everywhere; `createdBy`/`updatedBy` (userId) on content tables — meaningless with one user, essential for teams, nearly free now.
- **Serverless posture:** Prisma through a connection pooler (Neon pooled connection string or pgbouncer) — serverless function fan-out will exhaust direct Postgres connections. This is a day-one requirement, not an optimization.
- **Migrations:** Prisma Migrate, additive-first discipline (expand → migrate data → contract) so deploys never race the schema. Some constructs (partial unique indexes, `NULLS NOT DISTINCT`) require hand-edited migration SQL — documented convention, not ad hoc.
- **Future scale valves** (documented now, exercised later): time-partition `AnalyticsEvent` by month; move analytics to a dedicated store (e.g., ClickHouse/Tinybird) behind the analytics module's query interface; read replicas for the public read path. None require schema redesign because analytics is already isolated behind rollups.

---

## 10. Theme Architecture

- **Themes are data, not code.** A theme is a JSON **design-token document**: typography (font family keys, size scale, weights, line heights), color palette (semantic tokens — `background`, `foreground`, `primary`, `muted`, `accent`, etc. — with a light set and a dark set), spacing scale, radius scale, shadow scale, animation settings (enabled, intensity, respect-reduced-motion), and a `layout` section of *variant keys* (e.g., hero: `centered | split`, projects: `grid | list`).
- **Semantic tokens only.** The renderer consumes `--color-primary`, never `#3b82f6`. This is exactly the contract shadcn/ui and Tailwind (CSS-variable mode) already use, so the entire component library becomes themeable for free.
- **Server-side emission.** The public root layout loads the active theme and renders tokens as CSS custom properties on `<html>` during SSR — themed content on first paint, no flash. Dark mode uses the class strategy: both palettes are emitted; a tiny inline script applies stored/system preference before paint.
- **Layout variants are bounded, not arbitrary.** Each section supports a small enum of designed variants; the token document selects one. This is the guardrail against the biggest scope-creep risk in this project (§16): "everything configurable" must mean "everything configurable *within a designed system*," not a page builder.
- **Multiple themes later:** the Theme table already holds many rows; "theme gallery" is a picker that updates `Workspace.activeThemeId`. Preset themes ship as seed data (global rows); activating one clones it into a workspace-owned row (see `database-design.md` §11). A theme marketplace/template system (future) is new rows plus the existing clone operation — no architecture change.
- **Validation & versioning:** token documents are Zod-validated on save; `schemaVersion` + lazy migration functions handle token-schema evolution.

---

## 11. Analytics Architecture

*(Flow detailed in §6.4; this section covers the decisions.)*

- **Build vs. buy:** compared first-party pipeline vs. Plausible/Umami/Vercel Analytics. Third-party tools handle page views well but the requirements are dominated by **custom, entity-linked events** (per-project views/clicks, GitHub clicks, resume downloads, "most popular projects") that would require awkward custom-event gymnastics and still leave the data outside our dashboard. First-party wins on requirements fit and portfolio-demonstration value. Cost: we own bot filtering and privacy — both addressed below.
- **Event taxonomy is a closed enum** owned by the tracking domain service. Features emit semantic events; adding an event type is one enum entry + one rollup dimension. No free-form event names (they rot into inconsistency).
- **Privacy by design:** no cookies or client-side identifiers → no consent-banner dependency in most jurisdictions; unique visitors via daily-salted server-side hash (same-day uniqueness, cross-day linkage impossible by construction); raw IP never persisted; city/country from Vercel headers only.
- **Two-table model:** append-only raw events (write-optimized, retention-limited, e.g., 13 months) + daily rollups (read-optimized, kept forever, tiny). Dashboards never scan raw events except for "today." This is the standard warehouse pattern shrunk to Postgres scale, and it's what makes the 10,000-user story (§14) credible.
- **Reporting:** dashboard charts (views over time, top projects, geo/device/browser breakdowns, click-through funnels) query rollups with date-range params via TanStack Query. Rollup queries are simple grouped sums — no window-function heroics needed.
- **Integrity:** ingest endpoint is rate-limited per IP+workspace, validates event names against the enum, checks entity references exist (cheaply, cached), and drops obvious bots. Accept that client-side analytics is approximate; server-side events (downloads) are exact.

---

## 12. Provider Architecture

One abstraction covers GitHub, Vercel, Resume, and future providers (GitLab, LinkedIn, Behance, …). Two orthogonal capabilities, because Vercel proves they don't always co-occur:

1. **Connection capability** — how a provider authenticates: OAuth flow or token/upload; token storage (encrypted), status checks, disconnect semantics. Owned by `ProviderConnection`.
2. **Import capability** — `listImportables()` (browse remote items), `fetchItem()`, and `mapToStagedItems()` (provider shape → our Zod-typed `ImportItem`s). Everything downstream — staging, review UI, duplicate detection, commit — is **provider-agnostic**, implemented once in the imports pipeline.

How each provider maps:

| Provider | Connection | Import | Notes |
|---|---|---|---|
| **GitHub** | OAuth/PAT | repos → project items | full pipeline |
| **Resume** | none (file upload is the "source") | PDF → multi-type items | proves the pipeline handles heterogeneous targets |
| **Vercel** | token | **none** — it's a *linking* provider: browse projects, store one production URL on a ProjectLink | proves connection ≠ import; no fake import machinery forced on it |
| Future (GitLab, LinkedIn…) | varies | varies | register in provider registry; review UI and commit logic already exist |

Design consequences worth calling out:

- The **review-before-commit staging step is mandatory in the pipeline itself**, not per-provider etiquette. No provider can write directly to content tables. This structurally enforces the "local edits never overwritten" requirement.
- **LLM-based resume extraction** (vs. deterministic parsing libraries): resume layouts are wildly heterogeneous; rule-based parsers fail unpredictably and silently. An LLM with schema-constrained output + Zod validation + the mandatory human review screen turns "parsing accuracy" from a correctness problem into a UX-assist problem. The LLM client sits behind an interface in `lib/llm.ts` so the model/provider is swappable and the feature degrades gracefully (manual entry) if unconfigured.
- Provider modules live in `domain/providers/{github,vercel,resume}/` and are registered in a registry keyed by provider type — the integrations UI renders from the registry, so adding a provider doesn't touch shared UI code.

---

## 13. Security Review

| # | Attack vector | Protection |
|---|---|---|
| 1 | **Dashboard discovery** | Zero links from public surface; middleware **rewrites unauthenticated `/dashboard/**` to 404** (existence concealment beats a login redirect); `noindex` + robots disallow on dashboard paths; login page at a non-obvious route. Accept that obscurity is a layer, not the defense — auth is. |
| 2 | **Broken auth / brute force** | Auth.js with hashed credentials (or OAuth-only); rate limiting on login; generic error messages; short-lived JWT with rotation. |
| 3 | **IDOR / cross-tenant access** | `workspaceId` always derived from session, never from request input; shared query helpers require workspace scope as a non-optional argument; policy engine on every action. This matters *now* because it must be habitual before tenant #2 exists. |
| 4 | **CSRF** | Server actions carry built-in origin checking; state-changing route handlers (there are few) verify origin/tokens; OAuth callbacks validate `state`. |
| 5 | **XSS via user content** | Bio/descriptions stored as structured rich text (not raw HTML); rendered through a sanitizing renderer with an allowlist; imported provider text treated as untrusted (a malicious GitHub repo description is an injection vector). CSP headers as backstop. |
| 6 | **File upload abuse** | PDF-only via magic-byte sniffing (not extension/MIME header trust); hard size cap; stored in blob storage (never the DB, never the server FS); served with forced content-type and `Content-Disposition`; upload rate-limited. |
| 7 | **Provider token theft** | Tokens encrypted at rest (AES-GCM, key in env, never in DB); minimal OAuth scopes (GitHub: public repo read); tokens never sent to the client; revocation on disconnect. |
| 8 | **SSRF via provider URLs** | Server only calls allowlisted API hosts (api.github.com, api.vercel.com, LLM endpoint); user-supplied URLs (demo links, social links) are stored/rendered, never fetched server-side. |
| 9 | **Analytics ingest abuse** | Rate limit per IP; event-enum validation; payload size cap; bot filtering; endpoint can only append events — no reads, no other writes. Worst case is noisy data, never data compromise. |
| 10 | **Contact form spam/abuse** | Honeypot field + time-trap; rate limit; message length caps; if email relay is added later, fixed recipient (no header injection surface). |
| 11 | **Cron endpoint abuse** | Secret bearer token checked (Vercel cron secret); idempotent rollups (safe to re-run). |
| 12 | **Info leakage** | Error envelopes never expose stack traces or internals; consistent 404s for not-found vs. forbidden on public surface; security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) set globally. |
| 13 | **Supply chain** | Lockfile integrity, dependency audit in CI, minimal dependency surface for the public bundle. |

---

## 14. Scalability Review

**1 user (v1 reality).** Everything comfortably fits: one Postgres instance, ISR means the public site is effectively static and survives traffic spikes (the actual risk for a portfolio is a Hacker News spike, and cached RSC pages absorb it), analytics volume is trivial. The multi-tenant schema costs nothing at this scale — `workspaceId` on every query with a seeded constant.

**100 users.** No architectural change. Composite `workspaceId`-led indexes keep every query tenant-local. Cache tags are already per-workspace, so one user's edits never invalidate another's pages. Connection pooling (already mandatory) handles function fan-out. Rollups keep analytics dashboards O(days × dimensions), not O(events). Work at this stage is *product*, not architecture: sign-up flow, workspace switcher, billing — all of which land on the existing User/Workspace/Membership model.

**10,000 users.** The architecture has explicit valves, each behind an existing interface:
- *Public reads:* already ISR-cached; hostname-based tenant resolution (middleware is the single place that resolves tenants) enables subdomains/custom domains via Vercel's domains API.
- *Database:* partition `AnalyticsEvent` by month (it's the only unbounded-growth table); read replicas for public queries; Postgres at this scale (~10⁷–10⁸ content rows) is comfortably within range.
- *Analytics ingest:* if write volume demands it, put a queue in front of ingestion or swap the storage engine — the tracking service and rollup interface isolate this from every dashboard consumer.
- *Jobs:* cron rollups become per-workspace-sharded jobs or move to a queue worker.
- The honest bottleneck ordering: analytics events table → connection count → everything else. Both leaders have named mitigations that don't ripple.

---

## 15. Development Roadmap

Each milestone ends with a deployed, working application.

- **M0 — Foundation (skeleton that deploys).** Scaffold, Tailwind + shadcn/ui, Prisma + Postgres + pooling, Auth.js with seeded admin, Workspace/User/Membership schema, middleware + 404 concealment, `(public)`/`(dashboard)` shells, `createAction` wrapper + policy engine stub, CI. *Exit: log in, see empty dashboard; public site renders placeholder from DB.*
- **M1 — Core content, end to end.** Profile, Projects (+links/media), Skills, Experience, Education, Certifications, Social Links: full dashboard CRUD (RHF + Zod + server actions) and public rendering with ISR + tag revalidation. Soft delete + ordering patterns established here become the template for everything after. *Exit: complete portfolio manageable and publicly rendered — the minimum lovable product.*
- **M2 — Presentation control.** Theme module (token editor, light/dark, server-side emission), Navigation builder (enable/rename/reorder, 404 for disabled), SEO module (metadata, sitemap, robots, OG), contact form + message inbox, resume upload + public preview/download. *Exit: the site is fully personalized without touching code.*
- **M3 — Provider framework + GitHub + Vercel.** ProviderConnection with token encryption, provider registry, import staging pipeline + generic review UI, GitHub repo import, Vercel project linking. *Exit: import repos as projects; attach production URLs.*
- **M4 — Resume import.** PDF text extraction, LLM structured extraction behind `lib/llm.ts`, multi-target review flow reusing M3's pipeline UI. *Exit: upload resume → review → populate portfolio.*
- **M5 — Analytics.** Beacon + ingest handler, enrichment + privacy hashing, event instrumentation across public site, cron rollups, dashboard reporting (overview + per-project + geo/device). *Exit: full analytics dashboard on live traffic.*
- **M6 — Hardening & flagship polish.** Security pass against §13, rate limiting everywhere it's specified, a11y + Core Web Vitals, empty/loading/error states, seed data, tests on the load-bearing seams (policy engine, import pipeline, analytics rollups, action wrapper), architecture docs in-repo. *Exit: production-quality flagship.*

Sequencing rationale: M1 before theming proves the data spine; M3 before M4 because resume import *reuses* the staging pipeline — building GitHub first forces the abstraction to be real, not speculative; analytics last because it instruments surfaces that must exist first.

---

## 16. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Theme scope creep** — "everything configurable" drifts toward building a page builder | High | Bounded token schema + enum layout variants (§10). Treat new configurability as new *variants*, never arbitrary CSS. This is the project's #1 scope discipline point. |
| **Resume extraction quality** — LLM output wrong/incomplete; user trust damaged | Medium | Mandatory review screen (never auto-save), per-section retry, graceful manual-entry fallback, schema-constrained output + Zod rejection of malformed items. Frame the feature as "draft assistant," not magic. |
| **Multi-tenancy that exists but is untested** — single-tenant habits (missed workspace filters) hide until tenant #2 | High | Query helpers make workspace scope a required argument; seed a second "canary" workspace in dev/test fixtures from M1 so cross-tenant leaks fail loudly and early. |
| **Analytics table growth** | Medium | Rollups + retention policy from day one; partition plan documented (§9); storage engine swappable behind module interface. |
| **Serverless connection exhaustion** | Medium (certain, if ignored) | Pooler mandatory in M0, not retrofitted. |
| **Auth.js + Edge middleware friction** (JWT decode in edge runtime, config split) | Low-Medium | Known pattern: split auth config (edge-safe core for middleware, full config for handlers); decided upfront in M0 rather than discovered mid-build. |
| **Over-engineering for a SaaS that may not come** | Medium | The future-proofing budget is capped at: workspace column, Membership model, provider interface, token themes. Everything else (billing, invites, domains, i18n) is explicitly *not* built. If the list grows, that's the smell. |
| **Vercel lock-in** (geo headers, cron, blob) | Low | Each sits behind a `lib/` adapter (geo.ts, blob.ts, cron is one route). Acceptable, contained. |
| **Import duplicate handling** ambiguity (re-importing same repo/resume) | Low | `externalId` matching + duplicate flagging in review; documented rule: re-import creates review diffs, never silent writes. |

---

## 17. Future Improvements (natural fits, in rough order of leverage)

1. **Publish/draft snapshots** — content versioning with an explicit publish step; the tag-based cache and status fields already point this direction.
2. **Blog** — a new feature folder + entities; rendering, SEO, theming, analytics all apply automatically.
3. **Portfolio templates** — theme presets + seed content bundles; Theme table and token model already support it.
4. **Multiple workspaces / SaaS** — sign-up, workspace switcher, billing on the existing Membership spine; custom domains via the middleware tenant-resolution seam.
5. **AI content generation** — `lib/llm.ts` already exists for resume parsing; "improve my bio," "draft project description from README" are prompt features, not architecture.
6. **Testimonials** — another content module stamped from the M1 pattern.
7. **Import/export portfolios** — the Zod schemas double as the export format contract; import reuses the staging pipeline.
8. **Team members** — roles beyond OWNER activate the existing policy vocabulary; add invites + `updatedBy` surfacing (fields already present).
9. **Multi-language** — the costliest one: content tables need locale-aware sibling rows. The feature-module isolation keeps it a per-entity migration, not a rewrite; not cheap, but contained.
10. **Webhook-assisted GitHub sync** — upgrade manual sync to "upstream changed" notifications feeding the same review-diff flow (never auto-apply).

---

**Status:** approved alongside `database-design.md`. Next step: milestone **M0** (§15).
