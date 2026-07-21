# M4 — Resume Import, Asset Table, Real File Uploads

> Status: **done**. Builds on M0–M3 without modifying their behavior (the imports pipeline is
> extended, not replaced).

## 1. Summary

Introduced the `Asset` table (deferred since M1) and a real blob-storage upload pipeline, then
built the resume-import feature on top of it: PDF upload → deterministic text extraction → LLM
structured extraction → the same generic stage/review/commit pipeline M3 built for GitHub, now
exercised with its non-`PROJECT` target types for the first time (`EXPERIENCE`, `EDUCATION`,
`SKILL`, `PROFILE_SUMMARY`). Also used the new Asset infrastructure to upgrade three fields that
had been plain URL strings since M1/M2 (`Profile.avatarUrl`/`resumeUrl`, `SeoSetting.ogImageUrl`)
into real file uploads, exactly as those milestones' docs said would happen "whenever a real
Asset/upload subsystem lands."

Verified: full Prisma schema/migration/generate/build pipeline against the real dev DB (schema
validates, migrations apply cleanly, `pnpm build` succeeds); a throwaway script round-tripped the
new Zod draft schemas and confirmed the new columns/relations (`Asset`, `Profile.avatarAsset`,
`Experience.source`/`externalId`, `SeoSetting.ogImageAsset`) are queryable against the live
database; a second throwaway script confirmed `createAsset`'s magic-byte sniffing correctly
rejects a non-PDF file for the `RESUME` kind and correctly passes a real `%PDF-` header through to
the (credential-gated) blob upload call. **The LLM extraction call itself and a real blob upload
were not live-tested** — no `ANTHROPIC_API_KEY` or `BLOB_READ_WRITE_TOKEN` is configured in this
sandbox. See §5 Risks.

## 2. Architectural decisions

- **Certifications dropped from this milestone's scope, by explicit decision with the user.** The
  DDD lists resume import fanning out to Certifications too, but the `Certification` model and its
  CRUD feature were never built (cut from M1 on the user's explicit objectives at the time). Rather
  than silently building a full new content-management feature under a "resume import" milestone,
  this was flagged and the user chose to keep M4 scoped to Experience/Education/Skill/
  Profile-summary — Certifications stays deferred, unchanged from the M1 decision, until it gets
  its own milestone.
- **Provenance columns (`source`/`externalId`/`importedAt`/`sourceSnapshot`) added to `Experience`,
  `Education`, `Skill`** — a real gap found while building this milestone. The DDD calls for these
  on every importable entity ("generalized across the board, not just Project... or the
  duplicate flag and re-import diffing is impossible"), but M1 shipped without them since no import
  pipeline existed yet to need them. Added now via a second migration, mirroring `Project`'s
  existing columns exactly.
- **Resume import bypasses `ConnectionProvider`/`ImportProvider`** (`domain/providers/resume/provider.ts`
  is a standalone `stageResumeImport` function, not a registry entry). Those interfaces model
  token-based connect+list, which doesn't apply to a one-off PDF upload — exactly what M3's registry
  comment already predicted ("RESUME is absent until M4... its 'import' is a one-off upload handled
  outside this registry").
- **`stageImportSession` split into `createProcessingSession` + `stageItemsIntoSession`.** GitHub's
  session creation and item-staging are synchronous and always succeed together, so
  `stageImportSession` still does both in one call. Resume's LLM step can fail independently of
  session creation, so it creates the session as `PROCESSING` (with `sourceAssetId` already set)
  *before* calling the LLM, and only calls `stageItemsIntoSession` on success — a failed extraction
  still leaves an inspectable `FAILED` session with an error message and the uploaded PDF, not a
  vanished upload.
- **Duplicate detection generalized per target type** (`findDuplicateExternalIds` in
  `domain/imports/service.ts`): `PROJECT` keeps its `externalId`-against-`Project` check; `SKILL`
  matches on normalized name against the existing partial-unique anchor; `EXPERIENCE` matches on
  company+role; `EDUCATION` matches on institution+degree. `PROFILE_SUMMARY` has no natural
  duplicate concept (singleton target) and is never flagged. Since these targets have no stable
  external id of their own, the resume provider synthesizes one from the natural key (e.g.
  `skill:typescript`, `experience:acme corp|engineer`) purely so the existing
  externalId-keyed dedupe map can carry every target type uniformly.
- **LLM extraction is a single structured-output call, not an agent/tool loop** — this is a
  classification/extraction task (resume text → JSON matching a fixed schema), which is the
  "single LLM call" tier, not agentic. `src/lib/llm.ts` calls the Anthropic SDK directly with
  `output_config.format` (a hand-written JSON schema, not a Zod-derived one — the installed
  `@anthropic-ai/sdk`'s `zodOutputFormat` helper requires Zod v4 schema instances, and this
  project is on Zod v3; rather than fight that interop, the LLM boundary emits plain JSON which our
  existing v3 Zod schemas in `target-schemas.ts` then validate, per architecture.md §12's stated
  rule that the LLM never bypasses Zod either way). Malformed individual items are dropped rather
  than failing the whole extraction (`safeMapItems` in `lib/llm.ts`) — one bad experience entry
  doesn't lose the whole resume's skills.
- **`lib/pdf.ts` uses `unpdf`, not `pdf-parse`.** `pdf-parse` has filesystem/native-binding
  behavior that's unreliable in a Vercel serverless function; `unpdf` is built specifically for
  serverless/edge extraction (wraps a serverless-safe PDF.js build) and needed nothing beyond
  `getDocumentProxy` + `extractText`.
- **`lib/blob.ts` uses `@vercel/blob`**, matching architecture.md's named `blob.ts` adapter and the
  already-Vercel-deployed hosting — no new infrastructure to run or configure locally beyond a
  store token. Vercel Blob computes `Content-Type`/`Content-Disposition` itself from the object's
  content type; `getAssetDownloadUrl` (a thin wrapper over the SDK's `getDownloadUrl`) derives the
  forced-download variant of a blob URL for the public resume page's "Download" link, while
  `Asset.url` itself is the inline-serving variant used for the iframe preview and `<img>` tags.
- **Magic-byte sniffing, not trusting `File.type` or the extension** (`domain/assets/service.ts`'s
  `sniffMimeType`) — architecture.md §13 risk #6 explicitly calls this out for the resume upload
  surface; applied to every `Asset` kind (avatar/OG image included), not just resumes.
- **Committing a resume import also sets `Profile.publicResumeAssetId`** to the session's
  `sourceAssetId` (in `commitImportSession`, gated on `provider === RESUME`). The alternative —
  requiring a separate manual "attach this as my public resume" step after every import — added
  friction for no real benefit; the admin can still re-upload a different public resume afterward
  via the Profile form's own upload widget, which always wins going forward (commit only advances
  the pointer forward, never re-overwrites an admin's later manual choice on a *subsequent* import
  of the same session — it's a plain field set, not a lock).
- **Asset replacement soft-deletes the previous asset** (`replaceAsset` in `domain/assets/service.ts`,
  and the equivalent inline logic in the resume-commit path) — blob garbage collection is a future
  background job per database-design.md §4.7, not synchronous with the row.
- **Review-screen editing for the four new target types uses a plain JSON textarea**
  (`import-review.tsx`'s `JsonEditor`), not four bespoke structured forms mirroring
  Experience/Education/Skill's manual CRUD forms. Accept/Reject/Commit — the actual "review" in
  "upload → review → populate" — works fully structured; only the optional pre-accept *edit* step
  is lower-fidelity for non-Project targets. A deliberate scope call for this milestone, not an
  oversight — see §4 Tradeoffs.

## 3. Database changes

Two migrations, hand-assembled per the now-standard shadow-DB-diff workflow (see M2/M3's docs for
why `prisma migrate dev` doesn't work in this environment):

- `20260721120000_m4_resume_import` — new `AssetKind` enum; new `assets` table (soft-delete,
  `(workspaceId, kind)` index); `Profile.avatarUrl`/`resumeUrl` → `avatarAssetId`/
  `publicResumeAssetId` (both `SetNull`); `SeoSetting.ogImageUrl` → `ogImageAssetId` (`SetNull`);
  `ImportSession.sourceAssetId` added (`SetNull`).
- `20260721120500_m4_experience_education_skill_provenance` — `source`/`externalId`/`importedAt`/
  `sourceSnapshot` added to `Experience`, `Education`, `Skill`, matching `Project`'s existing
  columns, plus a `(workspaceId, source, externalId)` index on each.

Both diffs proposed recreating three of M1's hand-edited partial unique indexes
(`projects_workspaceId_slug_key`, `skill_categories_workspaceId_name_key`,
`skills_workspaceId_name_key`) as plain indexes — stripped from both migrations, same as every
milestone since M2. `UUID_ID_MODELS` in `src/lib/db.ts` extended with `Asset`.

## 4. Tradeoffs

- **Non-Project review-screen edits are raw JSON**, not structured per-field forms (§2). Building
  four dedicated inline editors mirroring the manual CRUD forms' field sets was judged more UI work
  than this milestone's exit criteria ("upload → review → populate") actually needs — Accept/Reject
  fully covers "review." A natural follow-up once this pipeline sees real usage and the JSON editor
  proves annoying.
- **No per-section LLM retry.** architecture.md §16 lists "per-section retry" as a mitigation for
  extraction quality; this milestone does one extraction call for the whole resume and drops
  individually-malformed items (§2) rather than re-prompting a failed section. Simpler, and the
  human review step is still the real safety net either way — retry is a quality-of-life addition,
  not a correctness one.
- **No provider abstraction for the LLM beyond `lib/llm.ts` being the only call site** — there's no
  `LlmProvider` interface/registry the way GitHub/Vercel have one, since there's exactly one
  consumer of exactly one capability (resume structured extraction) today. Matches the "no shared
  abstraction until duplication is proven" convention; if `lib/llm.ts` grows a second distinct use
  (e.g. "improve my bio" from §17's future-improvements list), that's when an interface earns its
  keep.
- **Certifications, ProjectMedia still not built** (§2) — unchanged scope decisions from M1,
  reaffirmed rather than silently expanded here.
- **Resume text is truncated to 50,000 characters** before the LLM call (`lib/llm.ts`) — generous
  for any real resume (which are 1-3 pages of text), just a hard ceiling against a pathological
  upload burning tokens unbounded.

## 5. Risks

- **LLM extraction and blob upload were not live-tested** — this sandbox has neither
  `ANTHROPIC_API_KEY` nor `BLOB_READ_WRITE_TOKEN` configured (no `ant auth login` profile either).
  Everything up to the network boundary was verified directly: the Zod draft schemas round-trip
  real data, the magic-byte sniffer correctly gates both valid and invalid uploads before ever
  reaching `@vercel/blob`, and the full pipeline typechecks/lints/builds. The actual LLM call
  shape (`output_config.format` with a hand-written JSON schema) and the real blob `put()`/
  `getDownloadUrl()` behavior need a real pass with both credentials configured before this is
  considered fully proven — see the checklist below.
- **No automated tests on the extended import pipeline** — same gap M3 already flagged for the
  base pipeline, now larger (4 more target types, the dedupe generalization, the Asset service).
  Still explicitly M6's job ("tests on the load-bearing seams... import pipeline"), not this
  milestone's.
- **A missing `Profile` row hard-fails resume commit and avatar/resume uploads.** If the admin
  never once saved the Profile form, `PROFILE_SUMMARY` commit and both new upload actions throw a
  clear `ActionError` telling them to save Profile's basic info first, rather than silently
  skipping or auto-creating a profile with placeholder data. Loud-and-clear over silent, but it is
  a real dependency between features that didn't exist before this milestone.
- **Asset blob GC is not implemented** — `replaceAsset`/resume-commit soft-delete the superseded
  `Asset` row (`deletedAt`), but nothing yet actually deletes the underlying blob from storage.
  Matches database-design.md §4.7's stated design (soft-delete now, GC job later) but means
  storage usage only grows until that job exists.

## 6. Future considerations

- Certifications getting its own model + CRUD milestone would let resume import's `CERTIFICATION`
  target type (already reserved in `ImportTargetType`, unused) finally light up — same
  find-or-create-category pattern used for Skills would extend cleanly.
- Structured per-field review editors for Experience/Education/Skill/ProfileSummary, replacing the
  JSON textarea fallback (§4) — highest-leverage follow-up if this pipeline sees real admin usage.
- Per-section LLM retry (§4) once single-shot extraction quality is observed to actually need it.
- A background blob-GC job for soft-deleted `Asset` rows past a grace period (§5) — natural fit for
  M5's cron infrastructure once that exists for analytics rollups.
- `lib/llm.ts` is the seam architecture.md §17 already named for "improve my bio" / "draft project
  description from README" style AI content-generation features — same call shape, different
  prompt and schema.

## 7. Manual testing checklist

Requires `ANTHROPIC_API_KEY` and `BLOB_READ_WRITE_TOKEN` set (neither configured in this sandbox):

- [ ] Dashboard → Profile: upload a real avatar image and a PDF as the public resume; confirm both
      appear on `/` and `/about` (avatar) and `/resume` (preview + forced-download link).
- [ ] Dashboard → SEO: upload an OG image for a page; confirm the page's `<meta property="og:image">`
      resolves to the uploaded asset's URL.
- [ ] Dashboard → Imports → Resume: upload a real multi-section PDF resume; confirm extraction
      produces a review screen with Experience/Education/Skill/Profile-summary rows.
- [ ] Accept a few rows, Edit one via the JSON textarea, Reject one; Commit — confirm real
      `Experience`/`Education`/`Skill`/`Profile` rows appear in their respective dashboard sections,
      and the uploaded PDF becomes the public `/resume` page's file.
- [ ] Re-upload the same resume: confirm previously-committed Experience/Education/Skill entries
      show as "skipped — already exists," not as fresh reviewable rows.
- [ ] Upload a non-PDF file (e.g. a renamed `.txt`) to the resume importer: confirm it's rejected
      with a clear error, not silently accepted.
- [ ] Upload a scanned-image PDF with no extractable text: confirm the session ends up `FAILED`
      with a readable error, not stuck or silently empty.

Cross-cutting:

- [ ] Logged out, `/dashboard/**` still 404s — M0 regression check.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` green locally (confirmed in this session); CI green
      after push.
