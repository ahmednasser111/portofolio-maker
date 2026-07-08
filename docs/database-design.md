# Portfolio CMS — Database Design Document (DDD)

> **Status:** Approved, v1.0. Companion to [`architecture.md`](./architecture.md) (System Architecture Document).
> **Scope:** Design only — no SQL, no Prisma, no migrations. This is the definitive data specification.
>
> **Deviations from the architecture doc's early domain-model sketch** (each justified where it appears): unified `Asset` table replaces a dedicated `ResumeAsset` + inline media URLs (§2, §4.7); provenance fields generalized from Project to *all* importable entities (§1, §4.4); a generic key-value `Setting` table is **dropped** in favor of typed columns on `Workspace` (§4.1, §13); ID strategy made explicit (UUIDv7 for content, bigint for analytics events, §1).

---

## 1. Design Philosophy

**Normalization.** 3NF for everything relational by nature: content entities, join tables, ordering, visibility. Every fact lives in exactly one place; ordering is an integer column, never array position; categories are rows, never repeated strings.

**Deliberate denormalization — four cases, each with a stated reason:**

| What | Why JSON/duplicated is correct |
|---|---|
| `Theme.tokens` (JSON) | Deeply nested, always read/written as a whole document, never queried by sub-field, Zod-validated at the boundary, carries `schemaVersion`. Relationalizing ~80 token leaves would be 5+ tables serving zero queries. |
| `Project.sourceSnapshot`, `ImportSession.rawPayload`, `ImportItem.data` (JSON) | Provider-shaped or target-shaped payloads whose schema varies by provider/target and is owned by application Zod schemas, not the database. |
| `Project.techStack` (text array) | Display-only tag list; no cross-project tag queries in v1. Promotion path to a `Tag` join table is documented (§12) and non-breaking. |
| `AnalyticsDailyRollup` (pre-aggregation) | Classic read-model duplication of `AnalyticsEvent`; rebuildable from raw at any time, therefore not a source of truth. |

**Soft delete policy.** `deletedAt` (nullable timestamp) on user-authored content the admin can regret deleting: Project (+ children hidden with parent), SkillCategory, Skill, Experience, Education, Certification, SocialLink, Asset. **Hard delete** for: analytics events (retention policy is the deletion mechanism), ImportSession/ImportItem (discardable working data), ContactMessage (privacy — delete must mean delete), NavigationItem/SeoSetting/Theme rows (configuration, not authored content; disable ≠ delete), auth tables. Rule of thumb: soft-delete *content*, hard-delete *telemetry, working data, and PII*. All content reads go through shared query helpers that always filter `deletedAt IS NULL` — the filter is structurally unforgettable, not conventional.

**Audit strategy.** `createdAt`/`updatedAt` on every table (updatedAt auto-managed). `createdBy`/`updatedBy` (nullable user references, `SetNull` on user deletion) on content tables only — meaningless for analytics rows and auth tables. No full audit-log table in v1: single admin, low value; the design leaves room for an append-only `audit_log` later without touching existing tables (§12).

**Versioning strategy.** Three distinct mechanisms, not one:
1. *Schema-versioned JSON* — `schemaVersion` int on every JSON document column (theme tokens, import payloads) + lazy in-app migration on read.
2. *Provenance snapshots* — `sourceSnapshot` frozen at import time enables future "upstream diff" without content versioning.
3. *Content versioning (publish/draft snapshots)* — **explicitly deferred**; `status` enums leave the seam (§12).

**Workspace isolation.** Every tenant-owned table carries a **non-nullable `workspaceId`** foreign key — including child tables (ProjectLink, Skill, ImportItem) that could technically derive it through their parent. This is deliberate redundant scoping: it lets every query, every index, and every future row-level-security policy filter on the local table without a join, and makes a cross-tenant join bug fail at the WHERE clause instead of leaking data. Full detail in §8.

**ID strategy** (a decision the architecture doc left implicit):
- Content tables: **UUIDv7**, application-generated. Time-ordered → good B-tree locality (random UUIDv4 fragments indexes), globally unique → safe for import/export and future multi-region, non-guessable → no enumeration of public URLs.
- `AnalyticsEvent` and `AnalyticsDailyRollup`: **bigint identity**. Highest-volume tables; 8-byte keys halve index size vs 16-byte UUIDs, and these ids never leave the server.
- Natural keys (slugs) are *additional* unique columns, never primary keys — slugs must be renameable.

**Scalability posture.** One unbounded-growth table (`AnalyticsEvent`) — isolated, partition-ready, FK-light. Everything else grows with human editing speed (thousands of rows per workspace, ever). Optimize the former, refuse to complicate the latter.

---

## 2. Entity List

*Ownership:* which module is the single writer. *Lifecycle:* how rows are born and die.

| # | Entity | Purpose | Owner module | Lifecycle | Depends on |
|---|---|---|---|---|---|
| 1 | **User** | Login identity (global, not tenant-scoped) | auth | Seeded in v1; self-service later. Hard delete (GDPR) with `SetNull` on audit refs | — |
| 2 | **Account** | Auth.js OAuth account linkage (GitHub login later) | auth | Created on OAuth link; cascade-deleted with User | User |
| 3 | **VerificationToken** | Auth.js email flows (future) | auth | Ephemeral, self-expiring | — |
| 4 | **Workspace** | The tenant; owns all content | auth | Seeded in v1; created at sign-up later. Hard delete = full tenant cascade (guarded app flow) | — |
| 5 | **Membership** | User↔Workspace + role | auth | Created with workspace (OWNER); invites later. Cascade with either parent | User, Workspace |
| 6 | **Profile** | Identity content: name, headline, bio, contacts | profile | Exactly one per workspace, created with it; never deleted independently | Workspace, Asset |
| 7 | **Asset** | Every uploaded file: avatar, project media file, resume PDF, OG image | assets (infra-adjacent) | Uploaded → referenced → soft-deleted → blob GC | Workspace |
| 8 | **Project** | Portfolio project | projects | Manual create or import commit; soft delete | Workspace |
| 9 | **ProjectLink** | Typed links per project (repo, demo, …) | projects | Lives and dies with project (cascade) | Project |
| 10 | **ProjectMedia** | Ordered media per project | projects | Cascade with project; references Asset | Project, Asset |
| 11 | **SkillCategory** | Grouping + ordering of skills | skills | CRUD; soft delete cascades (app-level) to skills | Workspace |
| 12 | **Skill** | Individual skill | skills | CRUD or resume-import commit; soft delete | SkillCategory |
| 13 | **Experience** | Work history entry | experience | CRUD or resume-import; soft delete | Workspace |
| 14 | **Education** | Education entry | education | CRUD or resume-import; soft delete | Workspace |
| 15 | **Certification** | Certification entry | certifications | CRUD or resume-import; soft delete | Workspace |
| 16 | **SocialLink** | Social/profile links | social-links | CRUD; soft delete | Workspace |
| 17 | **NavigationItem** | Page enable/rename/order | navigation | Seeded full set per workspace; toggled, never deleted | Workspace |
| 18 | **SeoSetting** | Per-page-key SEO metadata | seo | Upserted per page key; hard delete OK (config) | Workspace |
| 19 | **ContactMessage** | Public contact form intake | contact | Created by visitors; hard delete (privacy) | Workspace |
| 20 | **Theme** | Design-token document; presets | theme | Seeded presets (global rows) + workspace rows; active one referenced by Workspace | Workspace (nullable — global presets) |
| 21 | **ProviderConnection** | Encrypted provider credentials + status | integrations | Connect → active → revoked/disconnected (hard delete on disconnect) | Workspace |
| 22 | **ImportSession** | One import run (repo batch / one resume) | imports | PENDING→…→COMMITTED/DISCARDED; prunable after retention | Workspace, User |
| 23 | **ImportItem** | One staged item within a session | imports | Reviewed → committed (records created entity); cascade with session | ImportSession |
| 24 | **AnalyticsEvent** | Append-only raw telemetry | analytics | Inserted by ingest; deleted by retention job only | Workspace (loose — see §4.9) |
| 25 | **AnalyticsDailyRollup** | Pre-aggregated read model | analytics | Rebuilt idempotently per (workspace, day); kept indefinitely | Workspace |

Notably absent, on purpose: `Session` table (JWT strategy — architecture doc §6.5), generic `Setting` key-value table (dropped — §13), `Tag`/`Portfolio`/`Subscription` (future, seams documented in §12).

---

## 3. Complete Entity Relationships

### 3.1 ERD

```
User 1──* Account                (cascade on user delete)
User 1──* Membership *──1 Workspace   (cascade both directions)
User 1··* [createdBy/updatedBy on content]   (SetNull)

Workspace 1──1 Profile           (cascade)
Workspace 1──* Asset             (cascade)
Workspace 1──* Project 1──* ProjectLink        (cascade)
                        1──* ProjectMedia *··1 Asset  (media cascade w/ project;
                                                       Asset ref = Restrict)
Workspace 1──* SkillCategory 1──* Skill        (cascade)
Workspace 1──* Experience | Education | Certification | SocialLink   (cascade)
Workspace 1──* NavigationItem | SeoSetting | ContactMessage          (cascade)
Workspace 0..1──* Theme          (workspaceId NULL ⇒ global preset; cascade when owned)
Profile   *··0..1 Asset  (avatarAssetId, SetNull)
Profile   *··0..1 Asset  (publicResumeAssetId, SetNull)

Workspace 1──* ProviderConnection             (cascade)
Workspace 1──* ImportSession 1──* ImportItem  (cascade)
ImportSession *··0..1 Asset   (resume PDF, SetNull)
ImportItem ··▶ created entity (POLYMORPHIC soft pointer: targetType + entityId, NO FK)

Workspace 1──* AnalyticsEvent                 (cascade; entityId inside is a
                                               loose pointer, NO FK — §4.9)
Workspace 1──* AnalyticsDailyRollup           (cascade)
```

Legend: `──` enforced FK; `··` nullable/loose reference; `▶` polymorphic pointer.

### 3.2 Relationship inventory

| Relationship | Cardinality | Optional? | On parent delete |
|---|---|---|---|
| User → Account | 1:N | child optional | **Cascade** |
| User ↔ Workspace via Membership | M:N | — | **Cascade** from either side |
| User → content `createdBy/updatedBy` | 1:N | nullable | **SetNull** (content outlives its author) |
| Workspace → every tenant table | 1:N | required | **Cascade** (tenant deletion is total; app flow guards it) |
| Workspace → Profile | 1:1 | required (created together) | Cascade |
| Project → ProjectLink / ProjectMedia | 1:N | children optional | **Cascade** (hard); soft delete hides children via parent |
| ProjectMedia → Asset | N:1 | required | **Restrict** (delete media row first; prevents dangling blobs) |
| Profile → Asset (avatar, public resume) | N:1 | nullable | **SetNull** |
| SkillCategory → Skill | 1:N | — | **Cascade** (hard); soft delete of category app-cascades `deletedAt` to skills |
| Workspace → Theme | 1:N | `workspaceId` nullable (global preset) | Cascade when owned; presets undeletable by tenants (app rule) |
| ImportSession → ImportItem | 1:N | — | **Cascade** |
| ImportSession → Asset (resume) | N:1 | nullable | SetNull |
| ImportItem → created entity | polymorphic 0..1 | nullable | **No FK** — see §9.6 |
| AnalyticsEvent → Workspace | N:1 | required | Cascade |
| AnalyticsEvent → entity (project etc.) | loose | nullable | No FK (events must survive entity deletion and stay partition-friendly) |

**M:N note:** the only true many-to-many is User↔Workspace, and it is materialized as `Membership` because the edge carries payload (role, joinedAt). No implicit M:N join tables anywhere — every join table must earn columns or not exist.

**Delete-behavior principles:** Cascade inside an aggregate (project→links, session→items). Cascade for tenant teardown. SetNull for cross-aggregate references (audit refs, avatar). Restrict where a dangling file/blob would result. Never rely on cascade as a *feature* users trigger casually — destructive flows are app-guarded (typed confirmation), DB cascade is the consistency backstop.

---

## 4. Table Design

Conventions applying to every table unless stated: PK `id` (UUIDv7); `createdAt`/`updatedAt`; tenant tables add non-nullable `workspaceId` (FK, cascade) and content tables add `createdBy`/`updatedBy` (nullable, SetNull) + `deletedAt` where §1 says so. Growth figures assume the 10,000-workspace horizon.

### 4.1 Identity & tenancy

**`users`** — Login identities.
- Uniques: `email` (case-insensitive via citext or lowercased app-side — recommend app-side lowercasing, one less extension).
- Nullable: `name`, `image`, `passwordHash` (null for OAuth-only users).
- No workspaceId, no soft delete (GDPR hard delete).
- Growth: = registered users. Tiny.

**`accounts`** — Auth.js OAuth links. Standard Auth.js shape: provider, providerAccountId, token fields.
- Unique: `(provider, providerAccountId)`.
- FK: `userId` cascade. Growth: ≤ a few per user.

**`verification_tokens`** — Auth.js standard; unique `(identifier, token)`; expiry column; ephemeral. Included in schema from day one (cheap) even though unused until email flows exist.

**`workspaces`** — Tenant root. Typed settings live *here*, not in a key-value table: `slug` (unique, future subdomain key), `siteTitle`, `isPublished`, `activeThemeId` (see §4.6 note), future `customDomain` (nullable, unique).
- Uniques: `slug`; later `customDomain`.
- Growth: = tenants. Tiny.

**`memberships`** — User↔Workspace with `role` (MembershipRole enum), `joinedAt`.
- PK: composite `(userId, workspaceId)` — natural, prevents duplicates by construction; no surrogate id needed.
- Indexes: PK covers user→workspaces; add `(workspaceId)` for member lists.
- Growth: users × small constant.

### 4.2 Profile

**`profiles`** — 1:1 with workspace: displayName, headline, bio (structured rich text JSON — see XSS defense, architecture doc §13), location, publicEmail, phone (nullable), `avatarAssetId` (nullable, SetNull), `publicResumeAssetId` (nullable, SetNull — which uploaded resume powers public preview/download).
- Unique: `workspaceId` (enforces 1:1).
- Nullable: everything except displayName — empty portfolio must be representable.
- No soft delete (lives with workspace). Growth: 1/workspace.

### 4.3 Projects aggregate

**`projects`**
- Columns: title, `slug`, summary, description (rich text JSON), `status` (ProjectStatus), `featured` bool, `sortOrder` int, startDate/endDate (nullable), `techStack` text[], provenance: `source` (ContentSource), `externalId` (nullable), `importedAt` (nullable), `sourceSnapshot` (nullable JSON + `snapshotSchemaVersion`).
- Uniques: `(workspaceId, slug)` — **as a partial unique index `WHERE deletedAt IS NULL`**, so a soft-deleted project frees its slug. Prisma can't express partial indexes natively; the generated migration SQL is hand-edited (supported, documented workflow). This is the correct tool; the alternative (mangling slug on delete) corrupts data to satisfy tooling. Flagged as the one place schema and Prisma file intentionally diverge.
- Indexes: `(workspaceId, status, sortOrder)` — the public listing query; `(workspaceId, source, externalId)` — import duplicate detection. Featured filter uses the listing index with app-side filter (rows per workspace are few; no extra index needed).
- Soft delete: yes. Growth: ~10–50/workspace. Trivial.

**`project_links`** — `projectId` (cascade), `workspaceId`, `type` (ProjectLinkType), `label` (nullable), `url`, `sortOrder`.
- Index: `(projectId, sortOrder)`. No soft delete (edited inline with project). Growth: ~2–4/project.

**`project_media`** — `projectId` (cascade), `workspaceId`, `assetId` (Restrict), `mediaType` (MediaType), `altText`, `sortOrder`.
- Index: `(projectId, sortOrder)`; `(assetId)` for reverse lookup before asset deletion. Growth: ~0–10/project.

### 4.4 Résumé-shaped content

Shared shape: `workspaceId`, `sortOrder`, soft delete, audit, provenance (`source`, `importedAt` — generalized across the board, not just Project; Experience/Skill/Education/Certification rows created by resume import must also record where they came from, or the import-review "duplicate" flag and any future re-import diffing is impossible for them).

**`experiences`** — company, role, location (nullable), `employmentType` (EmploymentType, nullable), startDate, endDate (nullable ⇒ present), highlights (rich JSON list), description (nullable).
- Index: `(workspaceId, sortOrder)`. Growth: ~5–20/workspace.

**`educations`** — institution, degree (nullable), field (nullable), startDate/endDate (nullable), description (nullable). Same indexing. Growth: ~1–5/workspace.

**`certifications`** — name, issuer, issueDate (nullable), expiryDate (nullable), credentialId (nullable), credentialUrl (nullable). Same indexing. Growth: ~0–20/workspace.

**`skill_categories`** — name, `sortOrder`. Unique: `(workspaceId, name)` partial on not-deleted. Index `(workspaceId, sortOrder)`.

**`skills`** — `categoryId` (cascade), `workspaceId`, name, `level` (SkillLevel, nullable — not everyone wants proficiency bars), iconKey (nullable), `sortOrder`.
- Unique: `(workspaceId, name)` partial on not-deleted (duplicate-detection anchor for resume import). Index `(categoryId, sortOrder)`. Growth: ~20–100/workspace.

### 4.5 Social & navigation & SEO & contact

**`social_links`** — `platform` **string** (not enum — §5 explains), iconKey, url, `sortOrder`, `visible` bool. Index `(workspaceId, sortOrder)`. Soft delete. Growth: ~5–15/workspace.

**`navigation_items`** — `page` (NavigationPage enum), customLabel (nullable ⇒ default label), `sortOrder`, `enabled` bool.
- Unique: `(workspaceId, page)`. Seeded complete on workspace creation; toggled, never deleted → no soft delete. Growth: fixed ~9/workspace.

**`seo_settings`** — `page` (nullable NavigationPage — NULL means the workspace-default row, deliberately not a sentinel enum value, avoids polluting the enum), title, description, `ogImageAssetId` (nullable, SetNull), noindex bool.
- Unique: `(workspaceId, page)` with `NULLS NOT DISTINCT` (Postgres 15+) so the single default row per workspace is also enforced. Growth: ≤10/workspace.

**`contact_messages`** — senderName, senderEmail, body, `readAt` (nullable — doubles as read flag), no updatedBy/createdBy (visitor-created).
- Index: `(workspaceId, createdAt DESC)` — inbox query. Hard delete + retention policy (e.g., 24 months). Growth: unbounded but slow; retention caps it.

### 4.6 Theme

**`themes`** — `workspaceId` **nullable** (NULL ⇒ global preset), name, `tokens` JSON, `schemaVersion` int, `isPreset` bool, `basePresetId` (nullable self-reference — which preset a workspace theme was cloned from; SetNull).
- Active theme: pointer column `workspaces.activeThemeId` (nullable FK, Restrict — can't delete the active theme) rather than an `isActive` flag on themes. A flag needs a partial unique index and can drift to zero-or-two actives; a pointer is one nullable column and structurally exactly-one-or-none.
- Index: `(workspaceId)`; global preset listing filters `workspaceId IS NULL` (tiny). Growth: presets (dozens, global) + ~1–5/workspace.

### 4.7 Assets

**`assets`** — one table for every uploaded file: `kind` (AssetKind), storage key/URL, filename, mimeType, sizeBytes, checksum (sha-256, duplicate detection + integrity), width/height (nullable, images).
- A single unified table (rather than a dedicated resume table plus ad hoc media URL columns) buys: one upload pipeline, one orphan-GC job (find assets with no referrers), one place for per-workspace storage quotas (SaaS future), one security review surface. Cost: `kind`-specific columns are nullable — acceptable for four kinds with 90% shared shape.
- Indexes: `(workspaceId, kind, createdAt DESC)` — pickers/listings; `(workspaceId, checksum)` — dedupe on upload.
- Soft delete: yes (blob GC only after soft-delete grace period). Growth: ~10–100/workspace.

### 4.8 Integrations & imports

**`provider_connections`** — `provider` (ProviderType), `encryptedToken` (bytea/base64 — AES-GCM ciphertext + IV; key in env, never in DB), `accountMeta` JSON (provider username, avatar…), `status` (ConnectionStatus), `connectedAt`, `lastCheckedAt` (nullable).
- Unique: `(workspaceId, provider)`. Hard delete on disconnect (token must not linger, even soft-deleted). Growth: ≤ providers/workspace.

**`import_sessions`** — `provider` (ProviderType), `status` (ImportSessionStatus), `sourceAssetId` (nullable — resume PDF), `rawPayload` JSON (nullable — provider response snapshot) + `payloadSchemaVersion`, `error` (nullable text — failure diagnostics), `committedAt` (nullable).
- Index: `(workspaceId, createdAt DESC)` — history listing. Hard delete via retention (e.g., discarded >30 days). Growth: low; retention-capped.

**`import_items`** — `sessionId` (cascade), `workspaceId`, `targetType` (ImportTargetType), `data` JSON (Zod-shaped for target) + `dataSchemaVersion`, `status` (ImportItemStatus), `duplicateOfId` (nullable — the existing entity it appears to duplicate; loose pointer, no FK), `createdEntityType`/`createdEntityId` (nullable polymorphic pointer, set at commit), `externalId` (nullable — provider identity, e.g. GitHub repo id, for dedupe).
- Indexes: `(sessionId, status)` — review screen; `(workspaceId, externalId)` — "already imported?" lookups.
- Polymorphic pointer justification in §9.6. Growth: items × sessions; retention-capped with sessions.

### 4.9 Analytics

**`analytics_events`** — PK **bigint identity**. Columns: `workspaceId`, `eventType` (AnalyticsEventType), `occurredAt`, `path`, `entityId` (nullable UUID, loose), `visitorHash` (fixed-length, daily-salted), `country` (nullable, ISO-3166-1 alpha-2), `city` (nullable), `deviceClass` (DeviceClass), `os` (nullable, normalized string), `browser` (nullable, normalized string), `referrerDomain` (nullable). **No createdBy/updatedBy/updatedAt/deletedAt** — append-only telemetry, minimal row width.
- Indexes: `(workspaceId, occurredAt)` — every rollup and "today" query; `(workspaceId, eventType, occurredAt)` — per-metric live queries. Nothing else; every index taxes the hot write path.
- No FK on `entityId` (events outlive projects; keeps table partition-friendly). Keep the `workspaceId` FK in v1 (integrity > the negligible write cost at this scale); documented to drop when partitioning lands.
- Growth: the only unbounded table — say 10k workspaces × 100 events/day ≈ 10⁶ rows/day worst case. Retention 13 months + partitioning plan (§10).

**`analytics_daily_rollups`** — PK bigint identity. Columns: `workspaceId`, `date`, `eventType`, `dimension` (RollupDimension), `dimensionValue` (string; empty for TOTAL), `count` int, `uniqueVisitors` int.
- Unique: `(workspaceId, date, eventType, dimension, dimensionValue)` — makes the rollup job idempotent by construction (delete-day + reinsert, or upsert).
- Index: unique above serves all dashboard queries (leftmost prefix `workspaceId, date`). Growth: bounded — workspaces × days × dimensions × cardinality; ~10²–10³ rows/workspace/day worst case, kept indefinitely (small).

---

## 5. Enumerations

Postgres native enums via Prisma. **Ground rule:** DB enums only for domains that are *closed by the codebase* (adding a value requires a deploy anyway). Adding values to PG enums is a safe online migration; renaming/removing is painful — so churn-prone domains stay strings with app-level validation.

| Enum | Values | Why it exists / notes |
|---|---|---|
| **MembershipRole** | OWNER, ADMIN, EDITOR, VIEWER | Policy-engine vocabulary (architecture doc §7). Full set from day one even though v1 uses OWNER only — retrofitting an enum under live policies is worse than carrying three unused values. |
| **ProjectStatus** | DRAFT, PUBLISHED, ARCHIVED | Public queries filter PUBLISHED. ARCHIVED ≠ soft-deleted: archived is intentional "keep but hide," deletable is regret-protection. |
| **ContentSource** | MANUAL, GITHUB, RESUME | Provenance on all importable entities (§4.4). Extends per new import provider. |
| **ProviderType** | GITHUB, VERCEL, RESUME | Keys `provider_connections`, `import_sessions`, and the provider registry. One enum across both capabilities (connection/import); which providers support which capability is application knowledge, not schema. |
| **ConnectionStatus** | ACTIVE, EXPIRED, REVOKED, ERROR | Drives "reconnect needed" UI without a live provider call. |
| **ImportSessionStatus** | PENDING, PROCESSING, REVIEWING, COMMITTED, DISCARDED, FAILED, ROLLED_BACK | Pipeline state machine (§9.3). PROCESSING exists for the async LLM extraction step; ROLLED_BACK records undo (§9.7). |
| **ImportItemStatus** | PENDING, ACCEPTED, EDITED, REJECTED, SKIPPED_DUPLICATE, COMMITTED | Per-item review state. EDITED vs ACCEPTED is deliberately distinguished — it measures extraction quality (how often humans must fix the LLM) for free. |
| **ImportTargetType** | PROJECT, EXPERIENCE, EDUCATION, SKILL, CERTIFICATION, PROFILE_SUMMARY | Discriminates `import_items.data` shape and commit fan-out target. |
| **ThemeMode** | LIGHT, DARK, SYSTEM | Workspace default color-scheme preference (stored in theme tokens or profile; enum defined once). |
| **NavigationPage** | HOME, ABOUT, SKILLS, EXPERIENCE, EDUCATION, CERTIFICATIONS, PROJECTS, CONTACT, RESUME | Closed by code — each value is a built route. New public page ⇒ new route ⇒ deploy ⇒ enum addition is naturally coupled. |
| **AnalyticsEventType** | PAGE_VIEW, PROJECT_VIEW, PROJECT_CLICK, GITHUB_CLICK, DEMO_CLICK, SOCIAL_CLICK, RESUME_VIEW, RESUME_DOWNLOAD, CONTACT_SUBMIT | Closed taxonomy (architecture doc §11) — free-form event names rot. Ingest rejects anything else. |
| **RollupDimension** | TOTAL, COUNTRY, CITY, DEVICE, OS, BROWSER, REFERRER, PROJECT, PATH | One rollup table serves every dashboard breakdown; adding a breakdown = one value + one aggregation branch. |
| **DeviceClass** | DESKTOP, MOBILE, TABLET, OTHER | Coarse, stable classification; finer detail (os/browser) stays in normalized strings. |
| **ProjectLinkType** | REPOSITORY, LIVE_DEMO, DOCUMENTATION, OTHER | Typed links make per-type analytics (GITHUB_CLICK vs DEMO_CLICK) and per-type icons trivial. |
| **MediaType** | IMAGE, VIDEO | Rendering discriminator for project media. |
| **AssetKind** | AVATAR, PROJECT_MEDIA, RESUME, OG_IMAGE, OTHER | Upload validation rules (allowed MIME, size caps) key off kind. |
| **SkillLevel** | BEGINNER, INTERMEDIATE, ADVANCED, EXPERT | Semantic display levels. Enum over 1–5 int: the renderer needs labels, not math. Nullable — proficiency display is optional. |
| **EmploymentType** | FULL_TIME, PART_TIME, CONTRACT, FREELANCE, INTERNSHIP, VOLUNTEER | Standard resume vocabulary; resume-import extraction maps into it. |

**Deliberately NOT enums:**
- **SocialPlatform** — platforms churn (rebrands, new networks). String column + app-level known-platform list (for icon mapping) + free entry. A DB enum here guarantees an annoying migration the day a platform renames itself.
- `country`, `city`, `os`, `browser` — open-world normalized strings.

---

## 6. Constraints

**Unique constraints** (beyond PKs; "partial" = `WHERE deletedAt IS NULL`, hand-edited migration):

| Table | Constraint | Purpose |
|---|---|---|
| users | email | one identity per email |
| accounts | (provider, providerAccountId) | Auth.js requirement |
| workspaces | slug; customDomain (future) | routing keys |
| memberships | PK (userId, workspaceId) | one role per user per workspace |
| profiles | workspaceId | enforce 1:1 |
| projects | (workspaceId, slug) *partial* | public URL identity; soft-delete frees slug |
| skill_categories | (workspaceId, name) *partial* | duplicate prevention |
| skills | (workspaceId, name) *partial* | resume-import dedupe anchor |
| navigation_items | (workspaceId, page) | one row per page |
| seo_settings | (workspaceId, page) `NULLS NOT DISTINCT` | one row per page + one default row |
| provider_connections | (workspaceId, provider) | one connection per provider |
| analytics_daily_rollups | (workspaceId, date, eventType, dimension, dimensionValue) | idempotent rollups |

**Check constraints** (few, high-value; business logic beyond these lives in Zod/services):
- Date sanity: `endDate IS NULL OR endDate >= startDate` (experiences, educations, projects); `expiryDate >= issueDate` (certifications).
- Non-negative: `sortOrder >= 0`; `sizeBytes > 0` (assets); `count >= 0`, `uniqueVisitors >= 0` (rollups).
- Theme ownership coherence: `isPreset = true ⇒ workspaceId IS NULL` (and the inverse for owned themes) — expressible as one CHECK; prevents the "tenant-owned preset" corrupt state.

**Business constraints enforced in the application layer** (documented so nobody hunts for them in the schema): exactly-one active theme (pointer column makes it structural), "providers never write content tables directly" (pipeline design), workspace teardown confirmation, preset immutability for tenants, event-enum validation at ingest, upload MIME/size rules per AssetKind.

**Referential integrity rules** — every FK is real and indexed (Postgres does *not* auto-index FK referencing columns; every FK column appears in at least one index, usually the workspace-led composite). The three deliberate integrity holes are: `import_items` polymorphic pointer (§9.6), `analytics_events.entityId` (§4.9), `import_items.duplicateOfId` — each loose because the referent may legitimately die first, and each consumed only by code that tolerates absence.

---

## 7. Index Strategy

**Principles.** (1) Every tenant query starts with `workspaceId` ⇒ every index on a tenant table leads with it — one B-tree descent lands in the tenant's rows, and index locality *is* tenant locality. (2) Content tables are read-heavy/write-rare: index generously for reads, don't fret over write cost. (3) `analytics_events` is the one write-hot table: exactly two indexes, resist all additions. (4) Composite indexes ordered by (equality cols → sort col) so listing queries are index-order scans, no sort node.

**Read-heavy (public rendering).** The renderer's queries are: `(workspaceId, status, sortOrder)` on projects (listing), `(workspaceId, slug)` partial unique (detail page — doubles as the lookup index), `(workspaceId | categoryId, sortOrder)` on each content table, `(workspaceId, page)` on navigation/SEO. Every public query is a single index range scan. At portfolio scale these tables would be fast unindexed; the indexes matter at 10k tenants where a table holds 10⁶ rows across tenants but each query must touch ~10².

**Write-heavy (analytics ingest).** `(workspaceId, occurredAt)` + `(workspaceId, eventType, occurredAt)` only. Both are append-friendly (monotonic time on the right). Dashboards read rollups, so raw-table indexes exist for the rollup job and "today" panel, not for exploration. No index on `visitorHash` — uniques are computed inside day-bounded rollup scans, never point-looked-up.

**Rollups.** The unique `(workspaceId, date, eventType, dimension, dimensionValue)` serves every dashboard query via leftmost prefixes (date-range scans per workspace, then filter narrows). No secondary indexes needed.

**Imports.** `(sessionId, status)` — review screen groups by status; `(workspaceId, externalId)` on import_items and `(workspaceId, source, externalId)` on projects — the two sides of duplicate detection; `(workspaceId, createdAt DESC)` on sessions — history.

**Searching.** V1 has no search feature (portfolios are small; dashboard lists filter client-side). Documented seam: if project search lands, add a generated tsvector column + GIN index on projects — additive migration, no design impact now. Refusing speculative GIN indexes is deliberate.

**Sorting.** All manual ordering uses integer `sortOrder`, assigned in gaps of 1,000 (insert-between without renumbering; occasional compaction in app code). Fractional/lexicographic ordering rejected: cleverness with no payoff at ≤100-row lists.

---

## 8. Workspace Isolation

1. **Ownership:** all content rows reference `workspaceId`, never `userId`. Users own nothing; memberships grant access. (Architecture doc §7 — restated as the schema's load-bearing wall.)
2. **Redundant scoping on children:** child tables (project_links, skills, import_items…) carry `workspaceId` even though it's derivable via the parent. Buys: joinless tenant filtering, tenant-led indexes on every table, and — decisive — the ability to enable **Postgres row-level security** per table later without restructuring. RLS policies can only see the table's own columns; a child without `workspaceId` can't be RLS-protected cheaply.
3. **Application enforcement (v1):** workspaceId always derived from session claims, never request input; the shared data-access helpers take workspace scope as a required parameter — a query without it doesn't type-check.
4. **Cross-workspace write protection:** mutations resolve the target row by `(id, workspaceId)` pairs, not bare id — a stolen/guessed UUID from another tenant yields NOT_FOUND, indistinguishable from nonexistence.
5. **Database-level backstop (SaaS phase, documented seam):** RLS with a `current_setting`-based workspace GUC, set per transaction. Not in v1 — RLS + Prisma + pooled connections requires per-transaction discipline that isn't worth the ceremony for one tenant — but nothing in the schema blocks it *because of point 2*.
6. **Testing:** the canary second workspace (architecture doc §16) is a schema-level commitment: dev/test seeds always contain ≥2 workspaces so any missing scope filter produces visibly wrong data immediately.
7. **Global rows:** the only tables with nullable/absent workspaceId are `themes` (presets), `users`, `accounts`, `verification_tokens`. Everything else is tenant-total.

---

## 9. Import Pipeline Storage

1. **One pipeline, provider-shaped edges.** `import_sessions` + `import_items` serve GitHub, Resume, and future providers identically; only the *creation* of a session differs (repo selection vs PDF upload). Vercel never touches these tables (linking provider, not import provider).
2. **GitHub storage:** session holds `rawPayload` (selected repos' API responses, schema-versioned); one item per repo, `targetType=PROJECT`, `externalId`=repo id, `data`=mapped project draft.
3. **State machines.** Session: `PENDING → PROCESSING → REVIEWING → COMMITTED | DISCARDED | FAILED`, plus `COMMITTED → ROLLED_BACK`. Item: `PENDING → ACCEPTED | EDITED | REJECTED | SKIPPED_DUPLICATE → COMMITTED`. Transitions enforced in the imports service (single writer); statuses are facts, not suggestions — the review UI renders purely from them, so an interrupted review resumes exactly where it stopped.
4. **Resume storage:** uploaded PDF is an `assets` row (kind=RESUME) referenced by `sessionId.sourceAssetId`; extraction output becomes heterogeneous items (`targetType` varies). LLM never writes content tables — only `import_items.data`, Zod-validated before insert.
5. **Duplicate detection:** at staging time, each item is checked — by `externalId` against `projects(workspaceId, source, externalId)` for GitHub; by normalized natural keys for resume items (skill name against the partial unique, company+role+startDate for experiences). Matches set `duplicateOfId` + status `SKIPPED_DUPLICATE` (admin can override). Detection is *advisory at staging, revalidated at commit* inside the commit transaction — review sessions are long-lived and the world changes under them.
6. **Commit & the polymorphic pointer.** Commit runs in one transaction: for each accepted item, insert the target entity (with `source`, `importedAt`, and snapshot where applicable), then write `createdEntityType` + `createdEntityId` back to the item. This pointer is deliberately FK-less: a table-per-target FK (five nullable FK columns) buys integrity on a low-risk, admin-only working table at the cost of permanent schema noise; committed entities may later be hard-deleted while the session row (audit trail) survives. The pointer is consumed only by rollback and "what did this import create?" views, both of which tolerate dangling references.
7. **Rollback:** "undo this import" = soft-delete every entity the session's pointers name (skipping ones edited since commit — `updatedAt > committedAt` guard, surfaced to the admin), set session `ROLLED_BACK`. Soft delete makes rollback itself reversible. No temporal-table machinery — the pointers are the undo log.
8. **Retention:** discarded sessions pruned after ~30 days; committed sessions kept longer (provenance/audit) but prunable — content provenance survives independently via the entities' own `source`/`importedAt`/`sourceSnapshot` columns. Sessions are working data, not the system of record for provenance. That separation is what makes pruning safe.

---

## 10. Analytics Storage

1. **Two-table contract** (§4.9): append-only raw `analytics_events` (write-optimized, retention-limited) + `analytics_daily_rollups` (read-optimized, permanent). Dashboards read rollups exclusively, except a "today" panel scanning one day of raw events per workspace via `(workspaceId, occurredAt)`.
2. **Rollup mechanics:** daily cron aggregates the previous UTC day per workspace into the dimension matrix (TOTAL + per-country/city/device/os/browser/referrer/project/path counts + per-day unique `visitorHash` counts). Idempotent by the unique constraint: re-running a day is delete-and-reinsert within a transaction. Backfill = run for any historical date while raw rows still exist.
3. **Known limitation, accepted:** daily unique counts don't sum across days (a returning visitor counts each day — and *cannot* be linked across days anyway, since the salt rotates; that's the privacy design working as intended). Dashboards label the metric "daily uniques." Exact multi-day uniques would require stable visitor identity — a privacy regression, refused. If ever needed, HyperLogLog sketches per day (mergeable) are the upgrade path, and they slot into the rollup table as an extra column.
4. **Retention:** raw events deleted after 13 months (month-13 enables year-over-year). Rollups kept forever — bounded size. Retention job is a batched cron delete until partitioning arrives, then partition drops (instant, no vacuum debt).
5. **Partitioning plan (documented, not built):** trigger ≈ when the events table approaches ~50–100M rows or retention deletes visibly strain vacuum. Monthly range partitions on `occurredAt`; migration = create partitioned table, dual-write or backfill, swap names in one transaction. Prisma doesn't manage partitions — this becomes a hand-authored migration; queries are unchanged (partitioning is transparent). The FK from events to workspaces is dropped at this point (noted in §4.9).
6. **Performance:** ingest is a single-row insert hitting two append-friendly indexes — thousands/sec on baseline Postgres, orders of magnitude above need. Rollup job is one sequential day-range scan per day. Dashboard queries are sub-millisecond rollup range scans. Nothing here needs cleverness before ~10⁷ events/month.
7. **Privacy at the storage layer:** no raw IP column *exists* (can't leak what isn't stored); `visitorHash` = keyed hash of (daily salt, IP, UA) computed in the ingest handler, salt never persisted beyond its day; city is the coarsest geo stored; retention doubles as data-minimization.
8. **ClickHouse/Tinybird migration path:** the analytics module's read interface (rollup-shaped queries) and write interface (event contract) are the seams. Migration = dual-write events to the new store, rebuild rollup queries there, flip the read interface, retire the Postgres tables. No other module knows analytics' storage engine — this is why events have no FKs *into* content and content has none into events.

---

## 11. Theme Storage

1. **JSON document, relational envelope** — the `themes` row is relational (identity, ownership, preset lineage, versioning); the token payload is one JSON column. Full relationalization (token-per-row EAV) was considered and rejected: themes are read whole on every public render and written whole from the editor; no query ever asks "which workspaces use radius 8px." EAV would add joins, lose Zod's nested validation, and gain nothing. The reverse (theme as an opaque blob on workspace) was also rejected: no presets, no multiple themes, no lineage.
2. **Versioning:** `schemaVersion` int + ordered in-app migration functions, applied lazily on read and persisted on next write. Token schema evolution (new token groups, renames) never requires a data migration across all tenants at deploy time.
3. **Presets:** global rows (`workspaceId NULL`, `isPreset` true, CHECK-enforced coherence). Activating a preset **clones** it into a workspace-owned row (recording `basePresetId`) rather than referencing it — edits stay tenant-local, preset updates never mutate live sites, and "reset to preset" diffs against the lineage parent. Clone-on-activate is the load-bearing decision here.
4. **Marketplace (future):** preset rows grow publisher/visibility/pricing metadata or a sibling listing table keyed to theme id; the clone-on-activate flow *is already* the "install" flow. No storage redesign.
5. **Dark/light:** both palettes live inside one token document (architecture doc §10) — a theme is a complete design system, not a per-mode artifact. `ThemeMode` preference (default LIGHT/DARK/SYSTEM) is a scalar setting, not a separate theme row.

---

## 12. Future Expansion

| Feature | Schema impact | Verdict |
|---|---|---|
| **Multiple workspaces per user** | None — Membership already M:N; sign-up + switcher are product work | Free |
| **Multiple portfolios per workspace** | Would need a `Portfolio` entity between Workspace and all content — every table re-keyed. **Decision: refuse; workspace ≡ portfolio (1:1) is a modeling axiom.** "Second portfolio" = second workspace; the switcher makes this a UX nuance, not a schema concept | Free (by policy) |
| **Custom domains** | One nullable unique column on workspaces (already sketched) + middleware resolution | Trivial |
| **Blog** | New tables (posts, maybe tags) stamped from the content-table pattern: workspaceId, slug partial-unique, status, soft delete, audit | Additive |
| **Testimonials** | One new content table, same stamp | Additive |
| **Portfolio templates** | Theme presets (§11) + seed content bundles = JSON documents in a `content_templates` table; import reuses the staging pipeline | Additive |
| **AI-generated content** | No storage change — AI drafts flow through existing entities; optionally `ContentSource.AI` value | Enum addition |
| **Multi-language** | The expensive one. Path: `locale` column + translation sibling tables (`project_translations` holding the translatable text columns, base row keeps structure). Contained per-entity migration because translatable text is already separable from structural columns; not cheap, but not a rewrite. Do nothing now | Deferred, seam documented |
| **Teams** | Roles/policy vocabulary already present; `updatedBy` already recorded | Free |
| **Invitations** | New `invitations` table (workspaceId, email, role, token, expiresAt) — self-contained | Additive |
| **Billing** | New `subscriptions` table keyed 1:1 to workspace (plan, status, external customer id) + plan-limit checks in services. Payment state lives in the provider (Stripe); DB stores the mirror | Additive |
| **Audit log** | Append-only `audit_log` (workspaceId, actorId, action, entityType, entityId, diff JSON) written by the `createAction` wrapper — one insertion point, zero existing-table changes | Additive |

Pattern worth naming: nearly everything lands as *new tables stamped from existing patterns* because ownership (workspaceId), lifecycle (soft delete + audit), and identity (UUIDv7 + partial-unique slugs) are uniform conventions rather than per-table inventions.

---

## 13. Potential Weaknesses (self-critique)

1. **Polymorphic pointers trade integrity for simplicity** (`import_items.createdEntityId`, `analytics_events.entityId`). Dangling references are *possible by design*. Contained: both consumers tolerate absence, neither feeds public rendering. Residual risk: a future developer treats the pointer as reliable. Mitigation: the data-access helpers for these columns return `Option`-shaped results, making absence impossible to ignore at the type level.
2. **Hand-edited migrations for partial unique indexes** (projects.slug, skills.name, etc.) are a tooling seam: `prisma migrate dev` regenerating from schema won't know about them; drift checks and a documented migration-editing convention are required. Alternative (unique-with-slug-mangling) was rejected, but this is real, recurring friction — the price of correct soft-delete semantics under Prisma. Revisit if Prisma ships partial-index support.
3. **Daily-unique semantics** (§10.3) will eventually confuse someone comparing numbers to Google Analytics. A metrics-definition doc is part of the analytics milestone, not an afterthought.
4. **JSON columns hide schema from the database.** `tokens`, `import_items.data`, rich-text fields are invisible to SQL-level validation; a Zod bug can persist malformed documents. Mitigated by schemaVersion + validate-on-read, but acknowledged: the database no longer guarantees these shapes, the application does.
5. **Possible over-engineering, monitored:** redundant `workspaceId` on child tables (justified by RLS-readiness, but it *is* extra columns and extra FK maintenance); `ImportSessionStatus.PROCESSING` (only resume needs async — GitHub sessions skip it; harmless); provenance columns on education/certifications (near-zero cost, symmetric with siblings). None rise to removal; all noted so future review can re-check.
6. **Possible under-engineering:** no full-text search (deliberate — §7); no optimistic-locking version column on content tables (single admin, last-write-wins is fine; a `version` int becomes worthwhile with teams — additive); no HLL for uniques (documented upgrade path).
7. **Bottleneck ordering** (unchanged from the architecture doc): analytics_events growth → connection count under serverless fan-out → nothing else for a long time. Both have named, non-rippling mitigations (partitioning; pooling already mandatory).
8. **Future migrations we are knowingly deferring:** events partitioning (mechanical, documented), multi-language translation tables (contained), dropping the events→workspace FK (one line). The one migration this design *cannot* absorb cheaply — portfolio-per-workspace decomposition — is refused as an axiom in §12 precisely because it would be a rewrite; that refusal is itself a recorded architectural bet.

---

## 14. Recommendations (pre-implementation checklist)

1. **Deviations from the architecture doc's early sketch are adopted formally:** unified `assets` table; provenance (`source`, `importedAt`) on all importable entities; `ContentSource` naming; `workspaces.activeThemeId` pointer instead of an active flag; drop a generic `Setting` key-value table for typed workspace columns. All argued above.
2. **Fix the ID strategy before the first migration** (UUIDv7 content / bigint analytics) — the single hardest thing to change later.
3. **Establish the migration-editing convention in M0:** partial unique indexes, `NULLS NOT DISTINCT`, and CHECK constraints all require hand-edited migration SQL under Prisma. Document the workflow (generate → edit → never regenerate blindly) and add a schema-drift check to CI *in the foundation milestone*, not when the first drift incident happens.
4. **Target PostgreSQL 15+** (needed for `NULLS NOT DISTINCT`; sane baseline anyway).
5. **Seed discipline from M1:** two workspaces (primary + canary), full navigation rows, ≥2 theme presets, one user per role in test fixtures — the isolation and policy guarantees are only real if fixtures exercise them.
6. **Write the rollup job idempotently on day one** (delete-day-reinsert in a transaction) — retrofitting idempotency after a double-run corrupts historical dashboards is miserable.
7. **Encrypt provider tokens with envelope room:** store `keyVersion` alongside ciphertext so key rotation is a background re-encrypt, not a crisis.
8. **Define rich-text JSON structure early** (one shared Zod schema for bio/description/highlights) — three ad-hoc rich-text shapes is avoidable debt.
9. **Add `version`/optimistic-lock columns only when teams land** — recorded so it's a decision, not an omission.
10. **Keep this DDD as the single source of truth in-repo** and require schema PRs to update it — a design doc that drifts from `schema.prisma` is worse than none.

---

**Status:** approved alongside `architecture.md`. Next step: milestone **M0** (see `architecture.md` §15).
