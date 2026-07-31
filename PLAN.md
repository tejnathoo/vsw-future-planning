# PLAN — VSW Slack Intake Service (build plan)

**Sequencing principle:** anything that can *block you late* — credentials, external-system access, live-schema drift, or architecture-shaping decisions — is pulled **forward** into the Foundation stage and proven with a smoke test *before* any feature is built. The one piece of core logic that needs no credentials (the dedup engine) also moves early, since it's pure and fully unit-testable offline. Only once the whole external surface is green and the back-end "spine" is proven do we attach the four intake front-ends, ordered **easy → hard** (URL → CSV → image → PDF). Do not improvise ordering; write every deviation into the [Execution Log](#execution-log).

Companion docs: [PRD.md](PRD.md) (what/why) · [AGENTS.md](AGENTS.md) (how + hard rules + dedup code).
`⛔ HUMAN GATE` = only Tej can do it (Slack app, credentials, Railway).

---

## Target architecture (additive)

```
Slack @mention ONLY (text / CSV / PDF / image / md-txt — file uploads with no
mention are ignored; app_mention is the sole trigger for all 5 paths)
        │
        ▼
  Intake handler (ack <3s, route, download files with Bot token)
        │
   ┌────┼───────────┬──────────────────┬──────────────────┐
   │    │           │                  │                  │
 URL   CSV        Image               PDF              MD/TXT
   │    │           │                  │                  │
   │    ▼           ▼                  ▼                  ▼
   │  parse    Gemini vision     Gemini document    Anthropic text
   │   rows    → org names       understanding      extraction (+D12
   │    │           │            → org names        substring check)
   │    │           │                  │                  │
   │    └───────────┴──────────────────┴─────────┬────────┘
   │                                              ▼
   │                              classify (Anthropic, corrected enum)
   │                                              ▼
   │                     dedup/merge (ported §7 engine) vs Staging + Master
   │                                              ▼
   │                     write data-staging (append new / merge G,N,P)
   │                                              ▼
   │                                   threaded Slack reply
   ▼
 POST → existing n8n /webhook/vsw/scrape-url  (n8n owns the rest)
        └→ immediate "sent to the scraper" thread reply
```

The four write-in-service front-ends (CSV/image/PDF/text) all converge on one shared spine: **classify → dedup/merge → write → reply**. Build the spine once, prove it, then attach front-ends.

---

## Stage 0 — Repo & tooling ✅
- [x] Old stagehand project moved to `~/Desktop/vsw-scrape` (own repo/history/remote).
- [x] Fresh git repo here → `vsw-future-planning.git`.
- [x] Planning docs (PRD/PLAN/AGENTS/CLAUDE), `.gitignore`, `.env.example`, README.
- [x] `npm init` + TypeScript toolchain (`tsconfig.json` strict + `types:["node"]`, `src/`, `tests/`, build/test/dev scripts via `tsc`/`vitest`/`tsx`).
- [ ] Dockerfile, Railway config — deferred to Stage 4 (deploy), not needed to keep building.
- [ ] Boot-time env validation (fail fast on missing required vars) — deferred to Stage 2 (`index.ts` doesn't exist yet).
- **Verify:** `npm run build` compiles cleanly (`tsc --noEmit` clean); `npm test` runs; `.env` loads (proven by the Stage 1B smoke tests reading it); `git status` shows no secrets tracked.

---

## Stage 1 — Foundation: unblock everything ⛔ (front-loaded blockers)

> Goal: after this stage, **no later stage can be blocked** by a missing credential, an access grant that wasn't given, a schema that drifted, or the core algorithm being wrong. Each external dependency gets a tiny throwaway smoke test that proves the *credential-level* surface works end to end. Do these first even though they feel like "not building features" — they are the highest-risk items.

### 1A · Acquire every credential & access grant ⛔ HUMAN GATES ✅
- [x] **Slack app**: bot user (`future_planning_bot` on Vancouver Startup Week); tokens → `.env`.
- [x] **Google service account** (`vsw-future-planning@vsw-future-planning.iam.gserviceaccount.com`); sheet shared as Editor; key JSON → `./secrets/service-account.json` (gitignored).
- [x] **Gemini** API key (covers image **and** PDF; billing enabled, Sheets API + Generative Language API both enabled). **Anthropic** API key (rotated; using `claude-opus-4-8`). **Firecrawl** key captured (optional path).
- [x] **n8n**: `/webhook/vsw/scrape-url` confirmed reachable.

### 1B · Connectivity smoke tests ✅ — `smoke-test.ts`, `npm run smoke` — **6/6 passing**
- [x] **Slack auth**: `auth.test` confirms bot identity + workspace; token formats (`xoxb-`/`xapp-`) validated.
- [x] **Sheets read+write+delete**: read `data-staging` header (18 cols, A=Organization, R=Review Status match §5.1 exactly); appended + deleted a throwaway row — proves genuine *edit* access, not just view.
- [x] **Gemini**: `gemini-2.5-pro` responds correctly (text-only call; full vision/PDF payloads exercised in Stage 3).
- [x] **Anthropic**: classification call correctly returned `"Professional services"` for KPMG — a real enum value.
- [x] **n8n webhook**: reachable (404 on GET is expected — it's POST-only; not exercised with a real payload to avoid triggering a live scrape).
- Deferred to Stage 3 (needs a real Slack file, not just credentials): Slack file download via `url_private` + Bearer header; Gemini PDF via the File API with a real large file.

### 1C · Verify the live data contract ✅
- [x] `data-staging` header row = §5.1 columns **A–R** exactly, in order — confirmed via the Sheets smoke test.
- [x] `master-prospects` header confirmed on **row 2**, 32 cols, `Organization Name` at B, `Category` at C; the live Category dropdown is `ONE_OF_LIST` + `strict: true` with exactly the 16 corrected-enum values in the documented order — the enum is provably live, not just documented in Notion.

### 1D · Lock the architecture-shaping decisions ✅
- [x] **Concurrency / double-write model** — **LOCKED**: read-fresh-Staging + the shared idempotency guard for v1 (no hard lock between n8n and this service), matching the Build Spec's own recommendation. Revisit only if a real double-append is observed in practice.
- [x] **Tier-5 "Grant" enum conflict** — **RESOLVED**: `Grant` is not a valid Category (would be rejected by the strict dropdown). Use a real enum value per source (typically `Gov`) + a plain `"Grant: "` prefix in `Why Them` (no emoji, no em-dash). PRD §8 updated.
- Deferred (affect specific runs, not the architecture — keep open, note in-thread): vision/PDF confidence bar; general-CSV column detection.

### 1E · Dedup/merge engine — pure module, no credentials ✅ — `src/dedup.ts`, `tests/dedup.test.ts` — **21/21 passing**
- [x] Ported §7 verbatim (`orgKey`, `domainOf`, `jaccard`, `sameOrg`, `splitSourceUrls`, `decideDedup`) into TypeScript with full types (`src/types.ts`).
- [x] Unit-tested against the real must-merge pairs from the n8n Phase 6 build (Innovation Island variants, SFU VentureLabs/Venture Labs, BC Accelerator Network (BCAN), Accelerate Okanagan) — all merge correctly.
- [x] Unit-tested against the real must-NOT-merge pairs (`entrepreneurship@UBC` vs `Innovation UBC`, `Foresight Canada` vs `Foresight Cleantech Accelerator`, bare `UBC` vs longer names) — all correctly stay distinct.
- [x] Full `decideDedup` algorithm tested end-to-end: Staging name-match merge, **the exact cross-writer "New Ventures BC" scenario the Build Spec's own verification gate requires**, domain-match merge, idempotent re-run (0 appends/increments on an identical Source URL), Master-only match → `In Master`, fuzzy/prefix match → `Review`, clean distinct org → new row.

**Stage 1 exit gate: PASSED.** All smoke tests green, schema confirmed live, both architecture decisions locked, dedup engine built and fully unit-tested. No credential, access, schema-drift, or open-architecture-decision can block Stage 2 or later.

---

## Stage 2 — Shared spine ✅ (build once, prove with hand-crafted input)

Build the reusable back-end that every front-end feeds, on top of the now-proven credentials + decisions.
- [x] **Time helpers** (`src/time.ts`): Run ID `YYYYMMDD-HHmm-<slug>` + Scraped At ISO, both America/Vancouver with correct PDT/PST offset math. Unit-tested (`tests/time.test.ts`, DST-aware).
- [x] **Sheets layer** (`src/sheets.ts`): `readStagingIndex`/`readMasterIndex` (read-fresh, honors the 1D concurrency decision), `appendStagingRows` (batch), `mergeStagingRows` (batch-updates **only** G/N/P), `stagingSheetLink`.
- [x] **Classification** (`src/classify.ts`): Anthropic → Category/Sector/Why Them; validates the model's Category against `CATEGORY_ENUM` and **throws rather than silently accepting an invalid value**; Tier-5 grant handling per the 1D decision (`"Grant: "` prefix, never a bare `Grant` category).
- [x] **Shared spine** (`src/pipeline.ts` — `processItems`): wires dedup → classify → sheets, including the same-run dedup check (step 1 of the ported algorithm) so multiple items for one org in a single CSV/PDF/image/text run fold together before ever touching the sheet index.
- **Verify — `spine-check.ts` (live sheet, self-cleaning) — PASSED:** (1) a hand-crafted new org runs through classify→dedup→write and creates one correctly-shaped row; (2) the same org from a different synthetic source **merges** into that row (the exact cross-source proof pattern the Build Spec's own gate requires); (3) re-running the identical source is a true no-op (0 added, 0 merged) — idempotency proven live, not just in unit tests; (4) the resulting row was inspected directly off the sheet: Contact blank, Source (col F) unchanged at the first-seen label, Source URL pipe-joined with both sources, Times Seen = 2, Category a real enum value. Test row deleted immediately after; confirmed 0 leftover rows and the sheet's total row count unchanged from before the check.

---

## Stage 3 — Intake front-ends (thin slices, easy → hard)

Each front-end just produces `items[]` (or forwards) onto the proven spine. **Trigger rule: every path requires an explicit `app_mention` — `file_shared` alone is ignored** (locked 2026-07-03, one consistent rule across all 5 paths).
- [x] **3A · Router + Slack framework** ✅ — `src/router.ts` (pure, unit-tested: 13 tests covering file-priority-over-text, all 5 file types, Slack's `<url|label>`/`<url>` link wrapper stripping, and the "ask for help" fallback) + `src/index.ts` (Bolt App, Socket Mode, `app_mention` listener, always replies in `thread_ts`).
  - **Verified LIVE** (2026-07-04): enabled Socket Mode on the Slack app (a separate toggle from generating the App-Level Token — Bolt logged `Socket Mode is not turned on` until this was flipped and the connection restarted); a real mention in `#tej-bots` arrived (`[app_mention] user=U08TKLJH4QL route=none`) and the bot replied with the "mention me with a URL/CSV/PDF/image/text" prompt — confirmed by Tej.
- [x] **3B · URL path** ✅ — `src/paths/url.ts` (`forwardUrlsToN8n`): forwards `{urls, note}` to n8n + immediate "sent to the scraper" ack.
  - **Verified LIVE** (2026-07-04): a real URL mention → routed correctly (`route=url`) → forwarded to n8n with no error → Tej confirmed BOTH (1) the "🔗 Sent to the scraper..." thread reply appeared, AND (2) n8n's own per-source ✅ notice landed in `#tej-bots` shortly after from a real Source Queue run. This is the exact hand-off proof the Build Spec's own gate requires — the service wrote nothing itself; n8n owned the rest.
  - Known gap (non-blocking): the forward note uses the raw Slack user ID (`<@U08...>`) rather than a resolved display name — resolving it needs the `users:read` bot scope, which isn't currently granted. Deferred; add if the raw-ID note proves annoying in practice.
- [x] **3C · Markdown/text path** ✅ — `src/paths/text.ts` (`extractOrgsFromText`, `chunkText`, `postCheckOrgs`), `src/anthropicClient.ts` (shared client, extracted from `classify.ts`). Anthropic extraction, chunked to handle documents of any size, + the D12 substring post-check (this path has real fetched text, unlike vision/PDF); no forced `Review` (treat like CSV).
  - **Verified LIVE** (2026-07-04) against a real document (Western Canada trade/gov-org list) through the full spine to the live sheet: **76 new · 12 merged · 1 already in Master · 7 flagged for review · 3 dropped (failed the D12 post-check)**. Confirmed by Tej via the bot's own Slack reply.
  - **Bugs found + fixed during live testing:** (1) `max_tokens: 2000` truncated mid-JSON on a real document → generic "invalid JSON" error. Fixed properly, not by guessing a bigger number: added `chunkText` (paragraph-aware splitting, unit-tested) so extraction runs per-chunk in parallel and scales to any document size, plus an explicit `stop_reason === "max_tokens"` check per chunk so a genuine truncation fails loudly instead of producing garbled JSON. (2) `extractFromChunk`'s `max_tokens: 4000` per chunk still risked truncation on evidence-heavy chunks — mitigated by instructing the model to keep `evidence` ≤10 words.
  - **UX changes made live, per Tej:** (1) every file-based path now sends an immediate friendly "got it, working on it" ack before the slower processing starts (previously: silence, which read as broken) — golden rule #12. (2) All reply copy rewritten to read like a teammate, not a system log (`Ran into a snag...` instead of `⚠️ Couldn't process...`). (3) Bot now reacts 👀 on every mention immediately, then ✅/❌ on completion (Tej granted `reactions:write`) — golden rule #14.
  - **New feature, not in the original spec:** wastebasket-react-to-delete (Tej, 2026-07-04) — react `:wastebasket:` on any bot message to delete it. Restricted two ways: only `SLACK_ADMIN_USER_ID` (Tej) can trigger it, and it only ever deletes messages the bot itself posted. Required Slack app changes (scopes `reactions:read`/`reactions:write`, `reaction_added` event subscription, reinstall) — all completed live by Tej. Golden rule #13.
  - **Known perf gap, deliberately deferred (Tej, 2026-07-04):** `processItems` classifies new orgs sequentially, one Anthropic call at a time, using `claude-opus-4-8` (slow + priciest) — a 76-new-org run took several minutes. Tej chose to defer optimizing this rather than block the build. Tracked in AGENTS.md "Known performance gap" section: parallelize the classify calls and/or default to a faster model for classification specifically.
  - **Confirmed design (not a gap):** only the URL path creates a Notion Source Queue row (via n8n). CSV/PDF/image/text runs are service-only — no Notion row — the Slack thread is the audit trail. This is locked from the original Build Brief, not something built here.
- [x] **3D · CSV path** (`csv.ts`): Viv-CSV mapping (warm_lead from year cols, upgrade-candidate prefix, Category from enum not cash/VIK); general-CSV column detect / throw-not-guess on ambiguity. *First path to exercise a real spreadsheet-shaped input.* Ran live twice (route=csv) with no errors surfaced.
- [x] **3E · Image path** (`image.ts`): Gemini vision (`getGeminiClient` singleton in `src/geminiClient.ts`) → strict JSON `items[]`; new orgs default `Review` (`forceReviewForNewOrgs: true`); org→domain resolution left out for v1 per AGENTS.md ("start without it"). Built 2026-07-04, wired into `index.ts`'s `case "image"`. Not yet live-tested — awaiting Tej's next real screenshot.
  - **Verify:** real sponsor-wall screenshot → plausible orgs, all new flagged `Review`, no confident hallucinations.
- **New feature, not in original spec (Tej, 2026-07-04):** user-note context — free text typed alongside the @mention (besides the URL/mention itself) is captured (`stripUrls` in `router.ts`) and threaded into the classification prompt (`ClassifyInput.userNote`) and the text-extraction prompt, so a user can say e.g. "this is the CVCA 50 — attribute to CVCA" and have it ground Sector/Why Them/attribution. Forwarded to n8n as a separate field on the URL path (n8n owns its own classification). Not subject to D12 — trusted input, not a source of new org names by itself. Tej explicitly opted out of live-testing this ("I trust it works").
- [x] **3F · PDF path** (`pdf.ts`): Gemini document understanding (not text-only — catches logo-only pages); inline base64 under 15MB, Gemini File API (`ai.files.upload` + poll for `ACTIVE`) above that; model self-reports `truncated` for oversized docs → warned in-thread rather than silently partial; new orgs default `Review`. Built 2026-07-04, wired into `index.ts`'s `case "pdf"`. Not yet live-tested — awaiting Tej's real sponsor-deck PDF.
  - **Verify:** a real sponsor-deck PDF → org names from both text and logo pages; new orgs flagged `Review`; oversized PDF handled gracefully (partial + warning, not a crash).

---

## Stage 4 — Hardening & deploy
- [x] Slack reply formatting polished — superseded/exceeded by the full formatting overhaul (see Execution Log 2026-07-05, `bulletMessage`), not the narrower Build Spec §8 shape originally scoped here.
- [x] Error handling / structured logging — each path's own try/catch + console logging exists throughout (`[app_mention]`, `[promotion agent]`, etc.); no dedicated Run-ID-correlated log aggregation was built beyond what already exists, and nothing beyond that was asked for.
- [x] **Railway deploy readiness fixed, 2026-07-05** (repo-side only — Tej is creating/linking the actual Railway project himself): three real gaps found and fixed before this could run on Railway at all:
  1. `src/promote/agent/sourceTypeCache.ts` resolved its committed JSON data file `__dirname`-relative — correct under `tsx` (dev) but silently wrong once compiled by `tsc`, since `dist/promote/` never gets that `.json` copied into it (`tsc` only compiles `.ts`). Fixed to resolve via the project root regardless of dev/build layout.
  2. `src/env.ts`'s boot-time check hard-required `GOOGLE_APPLICATION_CREDENTIALS` (a local keyFile path) — Railway has no local filesystem to point that at. `src/sheets.ts` now also accepts `GOOGLE_SERVICE_ACCOUNT_JSON` (the whole service-account key pasted as one Railway variable), and the env check now requires *either* one.
  3. Added `PENDING_QUESTIONS_PATH_OVERRIDE`/`SOURCE_TYPE_CACHE_PATH_OVERRIDE` as the intended production mechanism (previously test-only) for pointing both runtime files at a Railway Volume mount, since Railway's default filesystem is wiped on every redeploy/restart. A fresh Volume has no `source-type-cache.json` yet, so `sourceTypeCache.ts` now seeds from the committed default the first time it reads a missing override path — the real learned "Startup TNT Summit" entry survives onto a brand-new Volume instead of silently starting blank.
  - Also added `package.json`'s `start` script (`node dist/index.js` — was missing entirely; Railway/Nixpacks needs it) and an `engines.node` hint.
  - `npm run build` clean, `npm test` 133/133 (+1 for the new seeding-behavior test).
- [x] **Railway project live, 2026-07-05.** Tej created the project (`vsw-future-planning`) and connected it to the GitHub repo via the dashboard, then logged into the Railway CLI himself (`railway login`, real browser OAuth — the CLI session persists locally on his machine, so subsequent CLI calls picked it up with no token workaround needed). From there, driven via `railway` CLI directly: linked this directory to the project/`production` environment/service; added a Volume mounted at `/data` (`railway volume add -m /data`); set all 24 real env vars from local `.env` onto the service (`railway variable set`, `--stdin` for `GOOGLE_SERVICE_ACCOUNT_JSON` specifically to avoid shell-escaping the multi-line key), swapping `GOOGLE_APPLICATION_CREDENTIALS` for the pasted-JSON variable and adding `SLACK_CHANNEL_ID=C0BEUTEDAF4`/`NODE_ENV=production`/the two `*_PATH_OVERRIDE` vars pointed at the new Volume; redeployed (`railway redeploy`) — build succeeded, `railway logs` confirms `⚡️ VSW Slack Intake Service is running (Socket Mode) as U0BF0T8NVN2`, same bot user ID as local dev, no cron/error warnings on boot.
- [x] Stopped the local `npm run dev` process once Railway's instance was confirmed live — leaving both running would double-connect the same bot user over Socket Mode and double-reply to every mention.
- **Verify:** deployed bot responds live in `#tej-bots` — infra confirmed up via logs; **still needs one real `@bot` mention from Tej in Slack** to fully close this gate (first real traffic against the deployed instance, not just a clean boot).

---

## Stage 5 — End-to-end verification gates (PRD §7)
- [ ] URL → n8n queue row + scraper write; service writes nothing.
- [ ] CSV "New Ventures BC" merges (cross-writer dedup vs n8n's earlier output).
- [ ] Image + PDF → plausible orgs, new flagged `Review`, no hallucinations.
- [ ] **Cross-path dedup:** org added via CSV (service) then found via URL scrape (n8n) → ONE row, Times Seen 2, two Source URLs.
- [ ] File download only works with the Bearer header.
- [ ] Concurrent mentions reply in the correct threads.

Only after all pass is the service trusted alongside n8n. **n8n is kept, not decommissioned.**

---

## Stage 6 — Feature: Staging → Master Promotion (PRD §10)

New addition on top of the intake service (Stages 0–5 above are unaffected). Same sequencing principle as Stage 1: front-load the blockers (live Master schema/dropdowns, open decisions with Tej) before writing the promotion job, since this feature does something the rest of the service has never done — **write to `master-prospects`**.

### 6A · Verify the live Master schema + resolve open questions ⛔ HUMAN GATE
- [x] Full 32-col header confirmed (Tej's CSV export, 2026-07-04): `Prospect ID, Organization Name, Category, Subsector, HQ / Geography, Why Them, Potential Mutual Value, Programming Angle, Source Type, Source Link, Warm Lead?, Warm Lead Person, Warm Lead Path, Primary Contact Name, Title, Email, LinkedIn URL, Secondary Contact Name, Secondary Contact LinkedIn, Generic Intake Email, Stage, Last Touch Date, Last Touch Channel, Next Step, Next Follow-up Date, Owner, Funding Type, Estimated Capacity, Target Ask Range, Exclusivity Play? (Y/N/Unknown), Budget Window, Notes` — matches Stage 1C's already-confirmed B=Organization Name/C=Category positions.
- [x] Category dropdown reconfirmed unchanged (matches live `CATEGORY_ENUM` in `src/types.ts` exactly).
- [x] Source Type dropdown: live values `Past VSW sponsor`, `Past VSW event partner`, `Comparable event sponsor`, `BC ecosystem directory` (Tej, 2026-07-04) — see PRD §10.6 Q3 for the resolved by-Source-label (not by-Tier) design.
- [x] `Stage` dropdown: **N/A — resolved (Tej, 2026-07-04).** No dropdown exists; outreach pipeline isn't designed yet. Leave `Stage` blank on promotion.
- [x] Master data rows confirmed real (Tej, 2026-07-04): the blank CSV was a stale template — the live sheet has real data through row 176 (header row 2, so ~174 data rows), consistent with the Build Spec's 2026-07-02 snapshot. Path B can be built/tested against real rows.
- [x] Q1 (Prospect ID: leave blank), Q2 (Stage: leave blank, no dropdown), Q4 (block Path B on `Duplicate?="Review"` until Tej confirms), Q5 (nightly sweep: in-process `node-cron`) — all **RESOLVED**, Tej 2026-07-04.
- **Exit gate: PASSED.** All of PRD §10.6 resolved except the still-partial Q3 (Source Type table covers Tiers 1–3 only; Tiers 4–10 deliberately deferred — not a blocker, just build with a throw-on-unmapped guard per §10.6). 6B (Sheets write extension) can start.

### 6B · Extend `sheets.ts` for Master writes
- [x] Widen `readMasterIndex` (or add a parallel read) to return row numbers + `Why Them`/`Source Link` per row, not just `organization`/`orgKey` — needed for Path B matching and append. *(Added `readMasterPromotionIndex`, parallel read; `readMasterIndex` left untouched for the dedup spine.)*
- [x] New `appendMasterRow` (Path A) — writes only the columns in PRD §10.5, everything else blank.
- [x] New `updateMasterAggregateRow` (Path B) — updates **only** `Why Them` + `Source Link` on an existing row, with the same pipe-split idempotency guard as Staging merges (PRD §10.4 step 5). Never touches any other column. *(Idempotency lives in the pure, unit-tested `appendAggregate` helper — NOT the Staging merge's ordinal-note logic.)*
- [x] Also: `readStagingApprovedRows` (full A:R shape) + `markStagingMergedToMaster` (flips col R only).
- **Verify:** unit/spine-check style proof mirroring Stage 2's `spine-check.ts` — a hand-crafted Approved row round-trips through both paths on a throwaway Master row, then is cleaned up, with a before/after column diff showing only the intended cells changed. *(NOT run — live Master verification is a human step per Tej's instruction; no script writes to the real Master sheet. `appendAggregate` unit-tested instead.)*

### 6C · Column mapper + Source Type classifier — SUPERSEDED 2026-07-04, see Stage 7
- [x] Port PRD §10.5 verbatim into a pure mapping function (Staging row → Master row shape), reusing `CATEGORY_ENUM`/existing types where they already overlap. *(`src/promote/mapper.ts`, unit-tested — stands as-is, still used by the `append_master_row` tool in Stage 7.)*
- [x] ~~Source-label→Source Type keyword table~~ — **built, then dry-run tested against 4 real Approved rows and failed on 2 of them** (`"Startup TNT Summit"`, `"VSW_Future_Planning_-_Past_Sponsors_csv.csv"` — see Execution Log 2026-07-04). Keyword matching on free-text human-authored Source labels doesn't generalize to real data. Abandoned.
- [x] ~~Single batched LLM classifier + JSON cache, no agency~~ — **superseded before being built.** Mid-design, Tej redirected the whole per-row decision (not just Source Type) to a real tool-using agent (PRD §11) rather than a bigger classifier. The persistent JSON cache idea survives as one of the agent's read tools (`lookup_source_type_cache`); the rest of this sub-stage is now built as part of Stage 7.

### 6D · Promotion job — SUPERSEDED 2026-07-04, see Stage 7
- [x] Read all Staging rows where `Review Status == "Approved"`. *(`src/promote/run.ts` — the read function survives as the `read_approved_staging_rows` tool.)*
- [x] ~~Per row: decide Path A vs. B via a hardcoded branch~~ — **superseded.** This fixed for-loop (`if Duplicate?==""... else if =="In Master"...`) is exactly the kind of pre-scripted sequencing Stage 7 replaces with the agent's own judgment. `sameOrg()` from `dedup.ts` is still reused verbatim (PRD §10.3) — just called by the agent's tools now, not by this loop.
- [x] ~~Slack batch summary reply~~ — superseded by the Notion-log-linked summary in PRD §11.6.
- **`src/promote/run.ts`'s current deterministic version stands as reference code / the tools it calls (`appendMasterRow`, `updateMasterAggregateRow`, `markStagingMergedToMaster`) get reused directly as Stage 7's tool implementations — it is not being thrown away, just no longer the orchestrator.**

### 6E · Two triggers
- [x] **On-demand:** extend `router.ts` to recognize a `promote` command on `app_mention` (alongside existing url/file routing) — no new Slack scopes. *(New `promote` route + unit tests; wired into `index.ts` with the 👀→✅/❌ reaction pattern.)*
- [x] **Scheduled sweep:** implement per the 6A/Q5 decision; runs the same 6D job. *(`node-cron`, 02:00 America/Vancouver, posts to `SLACK_CHANNEL_ID` (#tej-bots).)*

### 6F · Verify (PRD §10.9) — carried forward as Stage 7G, same acceptance criteria
- [ ] Approved net-new row → correct new Master row; Staging flips to `Merged-to-Master`.
- [ ] Approved duplicate row (`In Master`) → only `Why Them`/`Source Link` change on the matched Master row; everything else on that row (esp. contact/outreach/funding/Stage columns) byte-for-byte unchanged.
- [ ] Re-running an already-`Merged-to-Master` row is a true no-op.
- [ ] A row that isn't `Approved` is never touched by the sweep.
- [ ] Both triggers (mention + nightly sweep) produce identical summary formatting.

**Note on AGENTS.md:** golden rule #1 carve-out made 2026-07-04 (see PRD §10.7) and widened further the same day for the agentic redesign — current text lives in AGENTS.md golden rule #1.

---

## Stage 7 — Promotion Agent: tool-using architecture (PRD §11, supersedes Stage 6C/6D)

Same day as Stage 6B–6E were first built (2026-07-04), a live dry run against 4 real Approved rows exposed that the hardcoded Source Type table doesn't generalize. Rather than patch the classifier, the whole per-row decision becomes a real tool-using agent loop — see PRD §11 for the full architecture rationale (hands vs. nervous system) and design decisions. This stage is the build breakdown.

### 7A · The "hands" — tool implementations ✅ built 2026-07-04
- [x] `read_master_index` (`readMasterPromotionIndex`, reused verbatim), `match_master_org` (new — added beyond the original §11.4 list; wraps `sameOrg()` over a fresh `readMasterPromotionIndex()` read so the model never eyeballs org-name matching itself, per PRD §10.3's "do not re-derive a new matcher"), `read_source_type_dropdown` (new, live `spreadsheets.get` + `includeGridData` read of the col-I data-validation rule — re-reads fresh every call), `lookup_source_type_cache` (reads `src/promote/source-type-cache.json`, committed to git).
- [x] `firecrawl_search` + `firecrawl_scrape` (`src/promote/agent/firecrawlClient.ts`): direct REST calls, plain `fetch`, no SDK dep — matches the thin-client pattern. Scrape truncates to 8,000 chars to keep the loop's context bounded.
- [x] `append_master_row` (new wrapper, NOT a raw reuse of 6B's function — validates Category against `CATEGORY_ENUM` and Source Type against a **freshly-read live dropdown** before writing anything, per golden rule #15; only on success does it cache the Source→Source Type decision) and `update_master_aggregate_row` (re-reads the target row's current Why Them/Source Link fresh right before writing — added `readMasterRowAggregateFields` to `sheets.ts` for this, since trusting a value the agent read earlier in a multi-row sweep could be stale if two Approved rows aggregate onto the same Master org in one run). `flip_staging_review_status` wraps `markStagingMergedToMaster` for a single row.
- [x] `ask_tej_on_slack` (`src/promote/agent/pendingQuestions.ts` + the tool in `tools.ts`): posts in-thread, persists immediately, polls for an answer up to 5 minutes (poll interval itself overridable for tests). Deliberately does not count its 5-minute wait against the loop's 90s compute budget (see 7B) — waiting on a human isn't runaway computation.
- [x] `append_source_type_to_dropdown` (`sheets.ts`) — resolves the tab's numeric `sheetId` dynamically via `spreadsheets.get({fields:"sheets.properties"})` rather than relying on a hand-copied `MASTER_TAB_GID` env var (which isn't even set today), so this can't silently target the wrong sheet. Applies `setDataValidation` over rows 3-342 col I, then reads back to confirm. **Not exposed in the model-visible tool array in `tools.ts` at all** — only callable from the `approve` command path (7C).

### 7B · The "nervous system" — the agent loop ✅ built 2026-07-04
- [x] `src/promote/agent/loop.ts` — hand-rolled loop against `@anthropic-ai/sdk` via the existing `anthropicClient.ts`. **Design choice made during the build:** one bounded loop invocation per Approved Staging row (not one continuous conversation across a whole sweep) — keeps the 6-call/90s guardrails simple to enforce per item and keeps one row's failure/timeout from ever affecting another, matching the isolation the old deterministic `runPromotion` already had (golden rule #3). Model: `PROMOTION_AGENT_MODEL` (new env var, default `claude-sonnet-5` — distinct from `ANTHROPIC_MODEL`, which stays the intake-classification model).
- [x] System prompt (`systemPrompt.ts`) carries the Category enum, the Source Type live-dropdown rule, the Contact rule, and the JSON-only final-answer format as context, not external branching code.
- [x] Guardrails: max 6 tool calls / 90s wall clock per row (§11.7), tool allowlist = exactly the 10 tools in `tools.ts`. **Refinement made during the build, not in the original spec:** a literal hard stop at 6/90s could leave a row half-done — Master written but Staging never flipped to `Merged-to-Master` — which risks the SAME row being promoted again on the next sweep and duplicating the Master row. So once a write succeeds, the row gets exactly one grace iteration to call `flip_staging_review_status` specifically (nothing else); if that grace call isn't used to flip, the row is reported `failed` with an explicit "check this row manually" detail rather than silently reported as anything resembling success. An absolute 20-iteration safety net exists independent of both budgets.

### 7C · `promote` and `approve` Slack commands ✅ built 2026-07-04
- [x] `router.ts`: `promote` now routes to `runPromotionAgent` (`src/promote/agent/runAgent.ts`) instead of the old deterministic `runPromotion`; new `approve <value>` route (case-insensitive keyword, original casing preserved on the value) calls `appendSourceTypeToDropdown` directly from `index.ts` — never through the reasoning loop.
- [x] New `app.message()` listener in `index.ts` resumes a held row: any plain thread reply is matched against persisted pending questions by `thread_ts`; on a match it resolves that question and re-runs a fresh bounded loop for just that Staging row (re-read fresh, not resumed from a saved transcript — simpler, and the row's own data plus "Tej said X" context is enough for the model to finish quickly).
- **⛔ HUMAN GATE, not yet done:** this listener needs a `message.channels` Event Subscription + `channels:history` bot scope — neither is granted yet (current scopes: `chat:write`, `files:read`, `app_mentions:read`, `reactions:read`, `reactions:write`). Until Tej adds this and reinstalls the app, `ask_tej_on_slack` still posts and waits its 5 minutes, but a late reply after that window won't auto-resume — see AGENTS.md §Setup.

### 7D · Notion run log ✅ built 2026-07-04
- [x] **Database created 2026-07-04:** "Promotion Agent — Run Log" under "VSW Future Planning" (`NOTION_PROMOTION_LOG_DATABASE_ID` in `.env`). Schema: `Run` (title), `Date`, `Trigger` (`on-demand`/`nightly`), `Status` (`success`/`partial`/`failed`), `Added`, `Merged`, `Skipped - Review`, `Skipped - Source Type`, `Failed`, `Tokens spent`, `Firecrawl calls`, `Slack thread` (url). One row = one run, not a flat page list or a single running log (PRD §11.6).
- [x] `src/promote/agent/notionClient.ts` (`createRunLogPage` + `appendRunLogBody`, plain `fetch`, no SDK dep) — one row created automatically at the end of every `runPromotionAgent` sweep, success or failure, via `runAgent.ts`. Row properties carry the queryable summary; the page body gets the full per-row transcript (tool calls + results + final detail), terse and one-line-per-entry.
- [x] Slack summary links both the Master sheet and the Notion log entry ("📋 Open Master Prospects" / "📝 Open Log Entry").
- **Known simplification, logged not silently done:** a *resumed* single row (7C) does not get its own Notion page in v1 — only posts back to the Slack thread. The original run's page body already shows that row as `held`; a future pass could append an update block to that same page instead. Scope-limited deliberately, not an oversight.
- **Known simplification:** the Notion schema's `Skipped - Source Type` number field is used as the closest existing bucket for ALL `held` outcomes (the agent's "held" is more general than that one original reason) — the real reason for each held row is always in the page body.

### 7E · Contact-field handling (AGENTS.md golden rule #2, revised) ✅
- [x] Structurally enforced, not just prompted: no tool in `tools.ts`'s input schema accepts a Contact/Title/Email/LinkedIn field at all (unit-tested — `tests/tools.test.ts` asserts this against every tool's schema). The system prompt also states the rule for the model's own judgment about *mentioning* a name it stumbles on, but the "never written directly" half is a code fact, not a prompt request.

### 7F · Cost + guardrail tracking ✅
- [x] Each row's `tokensUsed`/`firecrawlCalls` are summed across the whole sweep in `runAgent.ts` and written to the Notion row's `Tokens spent`/`Firecrawl calls` number properties.

### 7G · Verify — same acceptance criteria as the old Stage 6F, now against the agent
**First live run done 2026-07-04**, against the 4 real Approved rows sitting in `data-staging` at the time (RBCx, BDC Capital, TELUS Pollinator Fund, BC Tech) — confirmed independently against the live Sheet and Notion, not just the agent's own report.
- [x] The 4 real Approved rows already sitting in `data-staging` (RBCx, BDC Capital, TELUS Pollinator Fund, BC Tech) were the first live test, not a synthetic follow-up.
- [x] Net-new row → correct Master row; duplicate row → only F/J change on the matched row, everything else byte-for-byte unchanged; re-running an already-`Merged-to-Master` row is a true no-op; a non-`Approved` row is never touched. *(Verified on the 3 rows that ran — RBCx, BDC Capital, BC Tech. TELUS was the 4th and hit the next line instead.)*
- [x] `Duplicate?="Review"` (TELUS Pollinator Fund) stayed blocked/untouched in that first run, as designed. **Update 2026-07-05:** Tej manually cleared the `Duplicate?` flag on that row so it can flow through on the next `promote`/sweep — this specific row's net-new-or-duplicate path is still an open re-test, not yet re-run.
- [x] At least one real Source Type gap (e.g. "Startup TNT Summit") was correctly resolved via research rather than failing — confirmed live, see Execution Log 2026-07-04.
- [x] `message.channels` Event Subscription + `channels:history` scope granted + app reinstalled (⛔ human gate, 7C) — **done by Tej** (confirmed 2026-07-05). The resume-after-timeout path itself still hasn't been exercised live — that's the remaining open item here.

---

## Stage 8 — Conversational chat (PRD §12)

Deferred at the end of Stage 7 ("Tej wants a separate, lighter conversational feature later"); built once Stage 7 shipped and live-verified.

- [x] `src/chat/{easterEggs,tools,systemPrompt,answerQuestion}.ts` — small bounded read-only tool loop (max 4 tool calls / 30s), distinct from and much smaller than the Promotion Agent's loop. Two read-only tools only (`read_master_snapshot`, `read_staging_snapshot`), no write tools at all.
- [x] `router.ts`: new `{ kind: "chat"; text }` route — any mention with no file/URL/`promote`/`approve` command but some other text. A bare mention with no text still falls to `none`.
- [x] `index.ts`: new `case "chat"` posting the answer back to the thread, same 👀→✅/❌ reaction pattern as every other route.
- [x] Easter egg: "will you be my friend" answered instantly, no model call — Katty's fun ask during the build.
- [ ] Not yet live-tested against the real Slack workspace/sheets — unit-tested only (`tests/easterEggs.test.ts`, `tests/answerQuestion.test.ts`, updated `tests/router.test.ts`), `npm run build` clean, `npm test` 132/132.

---

## Execution Log

Moved to [EXECUTION-LOG.md](EXECUTION-LOG.md) to keep this file lean. Newest at the bottom; log every decision/deviation there (living doc).
