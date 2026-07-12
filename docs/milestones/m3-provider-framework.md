# M3 — Provider Framework, GitHub Import, Vercel Linking

> Status: **done**. Builds on M0–M2 without modifying them.

## 1. Summary

Implemented the provider abstraction from architecture.md §12 (connection capability vs. import
capability), the shared staging/review/commit pipeline from §6.1, and its first two providers:
GitHub (both capabilities — connect via PAT, browse repos, stage, review, commit as Projects) and
Vercel (connection only — connect via token, browse projects, attach a production URL to an
existing Project's `LIVE_DEMO` link).

Verified: pages render correctly behind real auth in disconnected/connected states; a real
invalid-token call against both `api.github.com` and `api.vercel.com` correctly surfaces
`PROVIDER_ERROR` with the provider's actual rejection reason; the full stage → accept → commit path
was run against the real dev database (creates a `Project` with `source=GITHUB`, `externalId`,
`sourceSnapshot`, and its `ProjectLink`), duplicate detection correctly marks a re-staged repo
`SKIPPED_DUPLICATE`, and the discard path correctly moves a session to `DISCARDED`. No headless
browser was available in this sandbox (no sudo for Playwright's system deps, binary download timed
out) — GitHub/Vercel PAT connect was verified via the real API's error path, not a full browser
click-through with a real token.

## 2. Architectural decisions

- **GitHub connects via PAT, not OAuth App** — the DDD left this open ("OAuth app or PAT"). Chosen
  with the user: for a single-admin v1, an OAuth App (client id/secret registration, callback route,
  CSRF state handling) is pure overhead versus pasting a token, and it makes GitHub and Vercel the
  same shape (`ConnectionCard` is one component for both). OAuth's UX win (click-to-connect, no
  manual token copying) matters once other people connect their own accounts — a real SaaS-phase
  concern, not v1's.
- **`ConnectionProvider` / `ImportProvider` as two separate interfaces** (`domain/providers/types.ts`),
  exactly per architecture.md §12. Vercel implements only the former — proving the split is real, not
  speculative, per the DDD's own framing of Vercel's role.
- **`ImportProvider` has `listImportables` + `mapToStagedItems`, not a third `fetchItem`.** The
  architecture doc mentions `fetchItem()` but GitHub's list endpoint already returns everything
  needed to stage a repo (description, homepage, topics, language) — no per-repo follow-up call is
  needed in this milestone. Added if/when a provider actually needs it, not before.
- **`ContentError` surfaced via a new `ActionError` class in `create-action.ts`.** `PROVIDER_ERROR`
  was already declared in the `ErrorCode` union back in M0 but the generic `catch` collapsed every
  throw to `INTERNAL`, so it was dead code. `ActionError` lets a handler throw a specific code+message
  (used here for "GitHub token is invalid or expired", "Connect Vercel first", etc.) — completing
  something M0 already designed for, not new surface area.
- **`ProjectDraft` (the PROJECT-target staged-item shape) lives in `domain/imports/target-schemas.ts`,
  not in `features/imports`.** Provider modules (`domain/providers/github/provider.ts`) need to
  produce data matching it; domain code can't import a feature's schema without breaking the
  downward-only dependency rule (architecture.md §2.2), so the canonical schema had to live in
  `domain/`.
- **`ProviderType` enum includes `RESUME`, unused this milestone** — same reserved-value convention
  as `NavigationPage.CERTIFICATIONS` in M2. Resume import (M4) has no connection step (plain file
  upload), so `RESUME` will only ever appear on `ImportSession.provider`, never on a
  `ProviderConnection` row — an application-level rule, not schema-enforced.
- **`ImportSessionStatus`/`ImportItemStatus`/`ImportTargetType` are the DDD's full enums**, even
  though GitHub only exercises a subset (`PENDING → REVIEWING → COMMITTED/DISCARDED/FAILED`,
  `targetType=PROJECT` only). `PROCESSING`/`ROLLED_BACK` and the non-PROJECT target types are M4's
  (async LLM extraction, multi-target fan-out) — reserved now so M4 is additive, not a schema change.
- **Duplicate detection at staging time, not commit time** — a re-staged repo (matching
  `(workspaceId, source, externalId)` against existing `Project` rows) is marked
  `SKIPPED_DUPLICATE` immediately, before the admin even sees it as a normal reviewable item. Matches
  architecture.md §6.1 step 4 exactly ("flagged as duplicates and skipped by default").
- **Commit only ever creates, never updates.** There is no code path from `commitImportSession` back
  to an existing `Project` row — re-importing an already-imported repo always produces a
  `SKIPPED_DUPLICATE` item, never an overwrite. This is the "local edits never overwritten" guarantee
  from architecture.md §12 enforced structurally, not by convention.
- **TanStack Query installed now**, first use. It was already in the approved stack (project memory)
  but nothing needed client-side refetching until GitHub repo browsing / import review — exactly the
  scenario architecture.md §10 named as its reason for being in the stack. Wrapped once in
  `QueryProvider` around the whole dashboard layout (reusable for M4's resume review and later
  analytics filtering, not a one-off).
- **Vercel production-URL resolution** goes through the latest production deployment
  (`/v6/deployments?target=production`), not a field on the Project object itself — Vercel's API
  doesn't expose a stable "current production URL" field on a project, only via its deployments.
- **No new import history/audit UI beyond a plain list** — `ImportSession` history on the GitHub
  import page is a bare timestamp+status list. A real audit trail (diffing `sourceSnapshot` against
  current values, "re-sync" flows) is out of scope until a milestone actually asks for it.

## 3. Database changes

One migration, `m3_provider_framework` (hand-assembled per the now-standard shadow-DB-diff workflow
— see M2's milestone doc for why `prisma migrate dev` doesn't work in this environment). New enums:
`ProviderType`, `ConnectionStatus`, `ImportSessionStatus`, `ImportItemStatus`, `ImportTargetType`.
New tables: `provider_connections` (unique `(workspaceId, provider)`, hard delete on disconnect),
`import_sessions`, `import_items`. The diff tool again proposed recreating three of M1's hand-edited
partial unique indexes (`projects_workspaceId_slug_key`, `skill_categories_workspaceId_name_key`,
`skills_workspaceId_name_key`) as plain indexes — stripped from the final migration, same as M2.
`UUID_ID_MODELS` in `src/lib/db.ts` extended with `ProviderConnection`, `ImportSession`,
`ImportItem`.

## 4. Tradeoffs

- The review-screen edit form only exposes title/summary/description/tags — links are carried
  through unedited from the provider's mapping. Editing individual project links inline was judged
  more complexity than this milestone's admin actually needs (repo URL and homepage are usually
  already correct); full link editing is a normal Project edit after commit.
- Vercel project browsing has no pagination (fetches up to 100 projects, matching GitHub's repo
  fetch) — fine for a single-admin's own account, would need cursor pagination for an account with
  more projects than that.
- `ProviderConnection.keyVersion` is stored but `crypto.ts` doesn't yet branch on it — only one key
  version has ever existed. The column exists so a future key rotation is additive (per DDD §14.7),
  not so rotation works today.

## 5. Risks

- **No automated tests on the import pipeline** (staging, duplicate detection, commit) — verified
  manually this milestone via a throwaway script against the real dev DB (see §1), not via a
  regression suite. M6's hardening pass explicitly lists "tests on the load-bearing seams... import
  pipeline" — this is exactly that seam.
- **GitHub/Vercel PAT connect flow itself (the browser form → encrypt → store round trip with a real
  valid token) was not click-through verified** — no headless browser was available in this sandbox.
  The pieces were verified separately (pages render correctly in the disconnected state; real invalid
  tokens are correctly rejected end-to-end through the actual server action and real provider APIs;
  the DB-side encrypt/decrypt and upsert logic is exercised directly). Worth a real manual pass with
  an actual PAT before this is considered fully proven — see the checklist below.
- **PAT expiry has no proactive detection.** `ConnectionStatus.EXPIRED`/`ERROR` exist in the enum but
  nothing currently transitions a connection into them — a connection only gets checked when it's
  used (e.g., listing repos fails with `PROVIDER_ERROR`). A background token-health check is a
  reasonable M6/hardening addition, not built now.

## 6. Future considerations

- M4 (Resume import) reuses this exact pipeline (`domain/imports/service.ts`) unmodified — only
  session creation differs (a PDF upload + LLM extraction instead of a repo selection), and it'll
  exercise `ImportSessionStatus.PROCESSING` and the non-PROJECT `ImportTargetType` values already
  reserved in the schema.
- If key rotation is ever needed, `ProviderConnection.keyVersion` plus a small `decryptWithVersion`
  branch in `crypto.ts` is the whole change — the schema already has the room.
- A "reconnect needed" banner keyed off `ConnectionStatus` would be a natural small addition once
  something actually starts setting `EXPIRED`/`ERROR`.

## 7. Manual testing checklist

Dashboard (as the seeded OWNER):

- [ ] Integrations: connect GitHub with a real PAT (repo read scope), confirm the card flips to
      "Connected as `<username>`"; connect Vercel with a real token, same check.
- [ ] Imports → GitHub: browse the real repo list, select 1–2 repos, stage; confirm the review screen
      shows one row per repo with title/summary prefilled from GitHub.
- [ ] Review: Accept one item, Edit-then-save another (change title/tags), Reject a third; confirm
      status badges update without a full page reload glitch.
- [ ] Commit: confirm accepted/edited items become real `Project` rows (visible on
      `/dashboard/projects`) with a `REPOSITORY` link pointing at the GitHub URL, and (if the repo had
      a homepage) a `LIVE_DEMO` link too.
- [ ] Re-stage the same repo: confirm it shows as "skipped — already imported" instead of a normal
      reviewable row.
- [ ] Integrations → Vercel linking: pick a local project + a Vercel project, attach; confirm the
      project's `LIVE_DEMO` link updates to the real production URL.
- [ ] Disconnect GitHub and Vercel; confirm both integration pages fall back to the "not connected"
      prompt and `/dashboard/imports/github` redirects to the connect-first message.

Cross-cutting:

- [ ] Logged out, `/dashboard/**` still 404s — M0 regression check.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` green locally; CI green after push.
