## Execution Log

Newest at the bottom. Log every decision/deviation here (living doc).

### 2026-07-03
- **Repo bootstrapped.** Old stagehand service moved from this folder to `~/Desktop/vsw-scrape` (keeps its `vsw-stagehand.git` remote + history). This folder re-initialized as a fresh repo pointing at `vsw-future-planning.git` so the local folder name and GitHub repo name match.
- **Decisions locked with Tej:** runtime = **TypeScript/Node**; vision provider = **Google Gemini** (image path); classification stays **Anthropic** (rows match n8n's Category enum/style). URL intake forwarded to n8n's existing webhook — this service does NOT scrape URLs. Planning docs, `.gitignore`, `.env.example` written.
- **PDF added as a 4th intake path (Tej).** Handled by **Gemini document understanding** (native text + embedded-logo reading in one call; large files via the Gemini File API — same key, no new provider). Sibling of the image path; brand-new orgs default to `Review`. PRD §4.4/§4.5, data contract Extractor value `PDF`, AGENTS.md, and README updated.
- **Plan re-sequenced to front-load blockers (Tej's directive).** Restructured from linear phases into: Stage 0 tooling → **Stage 1 Foundation** (acquire ALL credentials + a connectivity smoke test per external system + live data-contract verification + lock the architecture-shaping decisions + build/unit-test the pure dedup engine) → Stage 2 shared spine (proven with hand-crafted input) → Stage 3 front-ends easy→hard (URL→CSV→image→PDF) → Stage 4 deploy → Stage 5 E2E gates. Rationale: credentials/access, schema drift, and the concurrency + Tier-5-Grant decisions are the things that would block late stages, so they move first; the credential-free dedup engine is built early because it's pure and testable offline.
- **Still open (blocking specific runs, not the build):** vision/PDF confidence bar; general-CSV column detection. Architecture-blocking opens (concurrency model, Tier-5 Grant) are pulled into Stage 1D to be decided before the spine.
- **Stage 1 progressed.** 1B smoke tests: all 6 green (Slack auth, Sheets read+write+delete on a throwaway row, Gemini `gemini-2.5-pro` after enabling billing + the Sheets API, Anthropic `claude-opus-4-8`, n8n webhook reachable). 1C schema verification: `data-staging` header confirmed 18 cols A–R matching §5.1 exactly; `master-prospects` confirmed 32 cols, header row 2, `Organization Name` at B, `Category` at C, and the live Category dropdown is `ONE_OF_LIST` + `strict: true` with exactly the 16 corrected-enum values in the documented order — the enum is provably live, not just documented. 1D Tier-5 Grant decision **RESOLVED** (Tej, 2026-07-03): `Grant` stays out of Category (it would be rejected by the strict dropdown); use a real enum value per source (typically `Gov`) + a plain `"Grant: "` prefix in `Why Them` (no emoji, no em-dash). PRD §8 and AGENTS.md updated. Concurrency/double-write model **LOCKED**: read-fresh-Staging + the shared idempotency guard for v1 (no hard lock between n8n and this service) — matches the Build Spec's own recommendation ("first pass is fine without a hard lock... see §7 Q3"); revisit if a real double-append is observed. **Stage 1D complete.**
- **Stage 1 exit gate PASSED — foundation complete, zero open blockers.** TypeScript toolchain added (`tsconfig.json` strict + `types:["node"]`; `tsc`/`vitest`/`tsx` scripts). Built `src/types.ts` (Item, Category enum, StagingRow, index types, DedupOutcome) and `src/dedup.ts` (verbatim §7 port: `orgKey`, `domainOf`, `jaccard`, `sameOrg`, `splitSourceUrls`, `decideDedup`). `tests/dedup.test.ts`: **21/21 passing**, including the exact must-merge/must-NOT-merge real pairs from the n8n Phase 6 build log and the cross-writer "New Ventures BC" scenario the Build Spec's verification gate requires. `npm run build` (tsc) and `npm test` (vitest) both clean. Nothing committed yet — awaiting Tej's go-ahead (bisect + commit deferred to the end of the build per Tej's instruction, then Railway deploy after).
- **Trigger rule + 5th intake path locked (Tej, 2026-07-03).** (1) Every path requires an explicit `app_mention` — Slack's `file_shared`-without-mention behavior is deliberately NOT used, to avoid the bot silently ingesting a file dropped for an unrelated reason. One rule for all paths, simpler to reason about than per-path exceptions. (2) Added a 5th intake type: **Markdown/plain-text files** (`.md`/`.txt`), extracted via **Anthropic** (not Gemini — no visual content, so it's a text task like classification). Because this path has real fetched text (unlike vision/PDF), the D12 anti-hallucination substring check applies and new orgs do NOT get the forced `Review` treatment — it behaves like the CSV path. Extractor enum gains `"Text"`. PRD (§Summary, §Flow, §4.5 new, §4.6 renumbered routing, §5 Extractor col), AGENTS.md (golden rule #11, file layout, new §Markdown/plain-text details), README, and `src/types.ts` all updated.
- **Stage 2 exit gate PASSED — shared spine built and proven live.** Built `src/time.ts` (Run ID + Scraped At, DST-aware, unit-tested), `src/sheets.ts` (read-fresh indexes, batch append, batch merge restricted to G/N/P), `src/classify.ts` (Anthropic classification with hard validation against the live enum — throws rather than guessing on an invalid category), and `src/pipeline.ts` (`processItems` — the shared spine wiring dedup → classify → sheets, including same-run dedup folding). Verified end-to-end against the **live** `data-staging` sheet with `spine-check.ts`: a synthetic org round-tripped through classify→dedup→write, a second synthetic source correctly merged into the same row (proving the exact cross-source pattern the Build Spec's verification gate requires), a third identical re-run was a true no-op, and the live row was inspected column-by-column to confirm Contact blank / Source unchanged / Source URL pipe-joined / Times Seen incremented / Category valid. Test row deleted; sheet's total row count confirmed unchanged before/after. `npm run build` and `npm test` (25 total: 21 dedup + 4 time) both clean. Nothing committed yet (bisect + commit deferred to the end per Tej's instruction). Next: Stage 3 (Slack front-ends) — this is also the natural point to spin up `localhost`/Socket Mode for the first time, since Stage 2 needed no running server (library code, verified via one-off scripts like the smoke tests).

### 2026-07-04
- **Stage 3A + 3B built and verified LIVE against the real Slack workspace and n8n.** Built `src/router.ts` (pure routing logic, 13 unit tests), `src/env.ts` (boot-time required-var check), `src/slack/download.ts` (Bearer-header file download, ready for Stage 3C+), `src/index.ts` (Bolt App boot, Socket Mode, `app_mention` listener), and `src/paths/url.ts` (n8n forward). Ran `npm run dev` locally (Socket Mode — no public URL needed, matching AGENTS.md/PRD's Railway-worker design) and tested with two real Slack mentions from Tej's actual workspace: (1) a plain mention correctly routed to `none` and got the help prompt; (2) a real URL mention correctly routed to `url`, forwarded to n8n with no error, and Tej confirmed both the service's own "sent to the scraper" thread reply AND n8n's own per-source notice landed in `#tej-bots` from a genuine new Source Queue run — the exact cross-system hand-off proof the Build Spec's verification gate calls for. **Gotcha found + fixed:** Bolt logged `Socket Mode is not turned on` on first boot even though the App-Level Token (`xapp-`) already existed — Socket Mode has its own separate toggle in the Slack app's settings (distinct from generating the token), and the running connection had to be restarted after Tej flipped it. Logged here since it's a non-obvious one-time setup step, not a config mistake in this repo.
- Nothing committed yet. Next: Stage 3C (Markdown/text path, second-easiest — text-only, no vision provider).
- **Merge behavior extended: `Why Them` (col I) now gets a sighting note on merge (Tej).** Golden rule #4 widened from "touch only G/N/P" to "touch only G/I/N/P" — on every merge that increments `Times Seen`, col I gets `" (Nth: <source label>)"` appended (e.g. `" (3rd: VIATEC sponsor list)"`), using the new `Times Seen` value and the merging run's col F label; the original grounded text is never rewritten, only appended to. Implemented in `src/dedup.ts` (`ordinal`, `appendWhyThemNote`), threaded through `src/pipeline.ts` (`mergeAcc` now carries `baseWhyThem`/`sourceLabel`) and `src/sheets.ts` (`readStagingIndex` now reads col I; `mergeStagingRows`/`MergeUpdate` write it). `StagingIndexEntry` gained a `whyThem` field. AGENTS.md golden rule #4 + §Dedup, and PRD §5 data contract/hard rules, updated to match. Unit tests added for `ordinal`/`appendWhyThemNote`; full suite (66 tests) and `tsc --noEmit` clean.
- **Promotion feature (PRD §10 / PLAN Stage 6): Stage 6A exit gate PASSED — all open questions resolved except deliberately-deferred parts of Q3.** Q2 (Stage default) resolved as N/A: there's no `Stage` dropdown at all yet since the outreach pipeline hasn't been designed, so promoted rows leave `Stage` blank (revisit once outreach stages exist). The blank `master-prospects` CSV Tej attached earlier was confirmed a stale template — the live sheet has real data through row 176 (~174 data rows, consistent with the Build Spec's 2026-07-02 snapshot), so Path B (aggregate onto an existing Master row) can be built/tested against real data. Stage 6B (extending `sheets.ts` for Master writes) is now unblocked.
- **Promotion feature (PRD §10 / PLAN Stage 6): golden-rule carve-out made + 4 of 6 open questions resolved with Tej.** AGENTS.md golden rule #1 amended from an absolute "never write master-prospects" to a scoped carve-out for the Promotion feature only (per-row, human-`Approved`-gated, column-restricted — full text in AGENTS.md). Resolved: **Q1** Prospect ID stays blank on promotion (no generation scheme). **Q3** Source Type is derived from the Staging row's actual Source (col F) text, not the Tier number — Tej rejected a Tier→label lookup because Tiers 6–10 lump together investors/professional-services/gov/awards/media, too heterogeneous for one table keyed on Tier alone; live dropdown confirmed as `Past VSW sponsor`, `Past VSW event partner`, `Comparable event sponsor`, `BC ecosystem directory` (new, added today) — Tiers 4/5/6-10 deliberately left unmapped for now (fail loudly rather than invent a value) until real Approved rows from those tiers show up. **Q4** `Approved` rows still flagged `Duplicate?="Review"` are blocked from Path B (aggregation) until Tej manually confirms the match — `Approved` alone isn't sufficient signal to write onto an existing Master row. **Q5** nightly safety-net sweep runs via an in-process scheduler (`node-cron`) inside the existing always-on Socket Mode worker — no new infra. **Still open:** Q2 (Master's live `Stage` dropdown values — not yet provided) and a data integrity flag — Tej's `master-prospects` CSV export had zero data rows, which conflicts with the Build Spec's own noted 2026-07-02 snapshot of 119 rows; needs confirmation it was just a blank/stale template before Path B is built against it. PRD §10.5/§10.6/§10.7 and PLAN Stage 6A/6C updated to match.
- **New feature scoped from Notion Feature Brief `6438a38dcd2644f3806d13162c3c2c48`: Staging → Master Promotion.** Automates the manual "copy approved Staging row into master-prospects" step (now a bottleneck at 700+ Staging rows) while keeping the human approval checkpoint (`Review Status = Approved` set by a person) as the sole gate. Two paths: net-new row (Path A) vs. append-only aggregation onto an existing Master row's `Why Them`/`Source Link` when the row is already a known duplicate (Path B) — reuses `sameOrg()` from `dedup.ts` verbatim, no new matcher. Two triggers: on-demand `@bot promote` mention (fits the existing router, no new Slack scopes) and a nightly safety-net sweep (mechanism TBD — PRD §10.6 Q5). Written up as **PRD §10** (full column mapping table, aggregation logic, hard-rule carve-out, success criteria) and **PLAN Stage 6** (6A–6F, front-loading the same kind of blockers Stage 1 did: live Master schema/dropdown verification and open decisions with Tej before any mapper/writer code is built). **Four open questions carried verbatim from the brief, not yet resolved with Tej:** Q1 Prospect ID generation scheme, Q2 Stage column default, Q3 full Tier→Source Type mapping (only Tier 2 confirmed live), Q4 whether `Duplicate?=Review` rows are blocked from Path B. **Flagged, not yet made:** this feature requires an explicit carve-out to AGENTS.md golden rule #1 ("never write master-prospects") — noted in PRD §10.7 and PLAN Stage 6 footer, pending Tej's go-ahead before any write code lands. Nothing built yet — scoping only.
- **Stage 6B–6E built (Promotion feature — code complete, NOT live-verified; 6F verification + live checks are a separate human step).** Implemented the whole Staging → Master promotion path within the existing Slack Intake Service, matching the surrounding codebase's small-pure-functions + throw-don't-guess style.
  - **6B (`src/sheets.ts`):** added `readMasterPromotionIndex` (parallel read returning row number + Org Key (via reused `orgKey()`) + Why Them (F) + Source Link (J) — `readMasterIndex` and its dedup-spine callers left untouched); `readStagingApprovedRows` (full A:R shape); `appendMasterRow` (writes all 32 cols A–AF, populating only B/C/D/F/I/J/K/M/AF, everything else blank — mirrors `appendStagingRows`'s `values.append`); `updateMasterAggregateRow` (batch-updates ONLY F + J on an existing row — mirrors `mergeStagingRows`'s `values.batchUpdate`, never touches another column); `markStagingMergedToMaster` (flips ONLY col R to `Merged-to-Master`); `masterSheetLink`. Idempotency for the aggregate append lives in a new **pure, unit-tested** helper `appendAggregate` (split on `" | "`, trim, membership-check, skip if present) — deliberately NOT the Staging merge's `(Nth: <source label>)` ordinal-note logic, which is a different mechanism for a different column. New types in `src/types.ts`: `MasterPromotionEntry`, `StagingApprovedRow`, `MasterRow`, `SourceType`/`SOURCE_TYPE_ENUM`.
  - **6C (`src/promote/mapper.ts`):** pure `mapStagingToMaster` (PRD §10.5 exactly — Warm Lead? = `Y`/`Unknown` never `N`; Notes traceability line; everything else blank) + `deriveSourceType` keyed on the Staging **Source (col F)** string, not Tier (PRD §10.6 Q3). **⚠️ FIRST-PASS GUESS, needs Tej to confirm/expand:** the real distinct Source strings live in `data-staging` were never enumerated (that enumeration was itself a flagged 6C follow-up, not resolved), so the 4 pattern matches are *inferred* from the confirmed Source Type dropdown values and the most obviously-implied labels (`viv`/`sponsor csv`→Past VSW sponsor; `speaker`/`partner`→Past VSW event partner; `comparable event`→Comparable event sponsor; `BC Tech`/`New Ventures BC`/`Innovate BC`/`ecosystem directory`→BC ecosystem directory). Anything unmatched **throws** (naming the unrecognized Source), same posture as `classify.ts`'s Category validator — a code comment points at PRD §10.6 Q3. This is the one genuinely-open gap in this build; do not run against real Approved rows until the table is confirmed against the actual col-F strings.
  - **6D (`src/promote/run.ts`):** `runPromotion` reads Approved rows, per-row picks Path A (`Duplicate?` blank → map + `appendMasterRow`) / Path B (`Duplicate?="In Master"` → `sameOrg()` match against fresh Master index → `appendAggregate` on F + J) / skip (`Duplicate?="Review"` → blocked per §10.6 Q4, counted separately as needs-review, row untouched) / fail (unrecognized `Duplicate?` or any per-row throw → caught, org+error recorded, row left untouched, sweep continues — one bad row never aborts the batch). On Path A/B success flips Review Status → `Merged-to-Master`. Returns `{added, merged, skippedNeedsReview, failed, failures[]}`; `promotionSummary` formats the teammate-tone Slack reply (Engine: Promotion).
  - **6E (`src/router.ts` + `src/index.ts`):** new `promote` route (mention text trimmed/lowercased equals `promote` or starts with `promote `; files still take priority) with router unit tests. Wired into `index.ts` `case "promote"` with the 👀-on-receipt / ✅/❌-on-completion reaction pattern. Nightly sweep via `node-cron` (added to `package.json` + `@types/node-cron`) at **02:00 America/Vancouver** (`timezone` option, no hand-rolled offset math), posting the same `promotionSummary` to `SLACK_CHANNEL_ID` (added to `.env.example` = `C0BEUTEDAF4` #tej-bots; also added `MASTER_TAB_GID` for the summary's Master sheet link).
  - **Tests:** added `tests/mapper.test.ts` (deriveSourceType 4 values + throw-on-unknown; mapStagingToMaster field mapping / Warm Lead Y-vs-Unknown / Notes line), `tests/appendAggregate.test.ts` (append / empty cell / idempotent no-op / trim / blank-addition / no substring false-match), and 5 new `router.test.ts` cases (bare/whitespace/prefix promote, `promoted` is not the command, file-beats-promote). **`npm run build` (tsc) clean; `npm test` = 88/88 passing** (was 66; +22).
  - **NOT done (out of scope / deliberate):** no script writes to the live `master-prospects` sheet — the Stage 6B "verify" and all of 6F are a human step (Tej reviews code first). Stage 6A checkboxes untouched.
- **Supervisor review of the Stage 6B–6E build found and fixed one real correctness bug before any live testing.** `appendMasterRow` originally copied `appendStagingRows`'s pattern of using Sheets' `values.append` anchored on `range: masterTab()+"!A:A"` to auto-detect the last row and insert after it. That pattern only works because Staging's col A (Organization) is always populated — Master's col A is **Prospect ID, which PRD §10.6 Q1 deliberately leaves blank on every row, past and future**, so Sheets' table-detection heuristic has nothing reliable to anchor on and could place a new row in the wrong spot (worst case, right after the header). **Fixed:** replaced the heuristic append with an explicit, deterministic target row — new `nextMasterRowNumber()` in `src/sheets.ts` computes the next row from the already-read Master index (`max(rowNumber) + 1`, or just after the header if Master is empty), and `appendMasterRow` now does a targeted `values.update` on `B{row}:AF{row}` instead of a heuristic `values.append` on `A:A`. `src/promote/run.ts` now tracks a local `nextRow` cursor, incrementing it after each Path A write within a sweep (so multiple net-new promotions in one run land on distinct consecutive rows, not all fighting over the same "next" row). Re-ran `npm run build` + `npm test` after the fix — still clean, still 88/88 (no test exercised the old signature).
  - **Live dry-run + Source Type redesign (2026-07-04).** Ran a read-only recon script against the real sheets before any live write: `data-staging` has 850 total rows; Tej approved 4 real rows for a first test — row 6 "RBCx" (`In Master`, Path B), row 66 "BDC Capital" (blank, Path A), row 746 "TELUS Pollinator Fund" (`Review` — correctly blocked from processing per Q4, not a bug), row 796 "BC Tech" (blank, Path A). Dry-checked the built `deriveSourceType` against the real Source strings: it threw on both real Path A candidates (`"Startup TNT Summit"`, `"VSW_Future_Planning_-_Past_Sponsors_csv.csv"`) — confirming the hardcoded keyword table doesn't generalize past the 4 examples it was written from. Separately checked `master-prospects`' actual Source Type data-validation rule (same technique as the original Category enum verification): **only 3 values are live** (`Past VSW sponsor`, `Past VSW event partner`, `Comparable event sponsor`) — `BC ecosystem directory`, discussed earlier the same day, was never actually added to the sheet. **Bigger finding: tested whether `strict: true` validation blocks an out-of-dropdown API write (using a disposable cell far below any real data) — it does not.** The write succeeded silently; Sheets only flags invalid values typed manually in the UI. Logged as AGENTS.md golden rule #15 since it applies to every enum-like column this service ever writes, not just this feature. **Redesign, decided with Tej:** replace the keyword table with an LLM classifier (Claude Sonnet 5, dedicated model env var), batched ~12-15 distinct Source strings per call (most of the 850 rows likely share far fewer distinct Source labels — batching + a persistent JSON cache avoids re-classifying repeats and keeps answers consistent across runs), given Tier + Org as context. The model may propose Source Type values beyond the 3 confirmed-live ones, but anything not confirmed-live is held out of the write and surfaced for Tej to approve — necessary specifically because of the golden-rule-#15 finding (the sheet won't catch a bad value for us). PRD §10.5/§10.6 Q3 and PLAN Stage 6C rewritten to match; implementation not yet built.
  - **Flagging one spec ambiguity, not yet resolved — did not change code for this one:** the Notion brief's own §5 (mirrored in PRD §10.4) describes step 2 (Why Them) as "append if not already **a substring**" but step 3 (Source Link) as "append if not already present **in the pipe-split list**" — two different check semantics — then a later "idempotency" bullet describes ONE unified mechanism ("split on ` | `, skip if present") without saying whether it overrides the per-step wording. The built code (`appendAggregate`) applies the stricter pipe-split-exact-match check to both columns uniformly. Practical difference: a plain substring check would also suppress appending a short new Why Them fragment that's already textually contained inside a longer existing segment (not exactly pipe-delimited); the implemented exact-match check would NOT suppress that case, so it would append it as a new pipe segment — a slightly noisier Why Them field, not a hard-rule violation or data-loss risk. Worth Tej confirming which reading is intended before this sees heavy real-world use, but not blocking the live-verification pass below.
- **Major architecture pivot, decided with Tej the same day: the deterministic Source Type classifier (above) is superseded by a real tool-using Promotion Agent (PRD §11, PLAN Stage 7).** Prompted by Tej directly questioning why the classifier gap should be patched with a bigger script rather than judgment + the ability to go find more context — and, more fundamentally, why any of the golden rules should constrain an agent that understands the goal clearly, given where this project is headed (research-backed, insight-driven outreach, not cold contacting). Worked through this as a real design conversation rather than either caving or refusing outright:
  - **Landed principle: the axis that matters is reversibility/audit-trail and confidence, not capability restriction.** "Never drop a duplicate silently" isn't about distrust — it's about not losing information with no trace, true regardless of how capable the agent is. Same logic for enum proliferation (near-duplicate Category/Source Type labels) — the fix is giving the agent full context so it prefers reusing/consolidating, not a hard block. Landed on: keep individual **tools** ("hands") narrowly scoped and structurally incapable of the wrong thing, no matter how much discretion the **agent** ("nervous system") gets over sequencing and judgment. This survived the rest of the conversation as the actual design principle, not "restrict what it's allowed to touch."
  - **Rule-by-rule AGENTS.md review, not a blanket wipe (Tej asked for this specifically).** Most golden rules (#4, #6–#14 as numbered before this edit) turned out to govern the *intake* pipeline or be pure technical/security facts — unrelated to whether a script or an agent makes the promotion decision, so they stand unchanged. Only #1 (Master-write restriction) and #5 (no scraping) were actually artifacts of the old design and got rewritten; #2 (Contact) got a real, separate decision (below), not a blanket removal.
  - **Researched (not guessed) two technical questions before committing to an architecture, both via a `claude-code-guide` subagent:** (1) Claude Agent SDK vs. hand-rolling — the Agent SDK (`@anthropic-ai/claude-agent-sdk`) is filesystem/coding-oriented (Read/Write/Edit/Bash/Grep), a poor fit for domain-specific tools (Sheets/Slack/Notion); hand-rolling a loop against `@anthropic-ai/sdk` (already a dependency via `anthropicClient.ts`) is the right fit, runs inside the existing always-on worker, no new hosting. (2) Anthropic's hosted `web_search`/`web_fetch` tools vs. Firecrawl — Anthropic's version needs zero execution code (server-side, Anthropic runs it) and has a real safety property (`web_fetch` can only open a URL already in the conversation), but Firecrawl is the more capable tool for actually messy/JS-rendered pages (Anthropic's own docs list "no JavaScript-rendered sites" as a `web_search` limitation) and Tej wants the hands-on experience with it regardless. **Decided: build with Firecrawl** (`/search` + `/scrape` via direct REST calls, `FIRECRAWL_API_KEY` already in `.env` — no new dependency, matches the existing thin-client-wrapper pattern).
  - **Rule #1 rewritten:** the Promotion Agent gets real discretion over *when/what* to write to Master — no longer restricted by an external fixed-branch script — but every write tool (`append_master_row`, `update_master_aggregate_row`) is still structurally incapable of touching anything outside its sanctioned columns, regardless of what the agent asks. Discretion is over sequencing/judgment; the tool code is the actual boundary.
  - **Rule #5 narrowed, not removed:** intake paths (CSV/PDF/image/text/URL) still never scrape, unchanged. The Promotion Agent specifically may use Firecrawl for its own research — a scoped exception for one agent's tools, not a general capability walk-back for the service.
  - **Rule #2 (Contact) — resolved as "opportunistic, not a checklist item" (Tej, 2026-07-04):** the agent must not actively research contact names as its own task, but if one surfaces naturally with high confidence during other research, it gets flagged to Tej via Slack — never written directly into either sheet by any tool. Filling Contact isn't required for a row to be "done."
  - **New golden rule #16:** the agent may *suggest* new tools/context/process improvements (logged for a human to act on) but may not build/deploy them itself in v1 — self-modifying code is a distinct, larger risk category, explicitly deferred rather than folded in silently.
  - **New human-in-the-loop design for `ask_tej_on_slack`:** the pending question is persisted (not just held in memory) the moment it's asked; the run waits synchronously up to 5 minutes for a reply so quick answers resolve in the same run, but if that window passes, nothing is lost — a new Slack `message`-event listener matches a later reply (any elapsed time) against the persisted pending record and resumes just that one held item, without Tej re-triggering `@bot promote` or coming back to the codebase.
  - **New audit-trail design:** one Notion page per run (not a running log), written automatically after every run regardless of outcome — full prompt/tool-call/result/error trace, per-row outcomes, research citations, token + Firecrawl cost totals. Linked from the Slack summary alongside the existing Sheet links.
  - **PRD §11 (new) and PLAN Stage 7 (new) capture the full architecture; Stage 6C/6D marked superseded** (6B's Sheets functions and 6E's triggers survive as reused building blocks, not thrown away). AGENTS.md golden rules #1/#2/#5 rewritten, #16 added. **Nothing in Stage 7 built yet — this entry is the design, not the implementation.**
- **Notion run-log design revised from "one page per run" to a database (Tej, 2026-07-04), and the database created live.** A flat pile of sibling pages doesn't give filter/sort as the log grows (e.g. "every run with a failure," "tokens spent last week") and can't be queried by property — a database can, and it's how the rest of this Notion workspace already handles repeating structured entries (e.g. "Projects"). Created "Promotion Agent — Run Log" under "VSW Future Planning" via the Notion connector: `Run` (title), `Date`, `Trigger` (`on-demand`/`nightly`), `Status` (`success`/`partial`/`failed`), `Added`, `Merged`, `Skipped - Review`, `Skipped - Source Type`, `Failed`, `Tokens spent`, `Firecrawl calls`, `Slack thread` (url) — one row per run, full prompt/tool-call/result trace still lives in each row's page body, same as before. `NOTION_API_KEY` (Tej's integration token) and `NOTION_PROMOTION_LOG_DATABASE_ID` added to `.env`/`.env.example` (env var renamed from the earlier `..._PARENT_PAGE_ID` now that the target is a database, not a bare page). PRD §11.6 and PLAN 7D updated to match. Still nothing else in Stage 7 built.
- **Deferred, not forgotten:** Tej wants a separate, lighter conversational feature later — being able to ask the bot questions about the spreadsheet/the build in plain chat, distinct from the tool-equipped Promotion Agent (which only runs for `promote`/`approve`/a pending-question resume, never for a plain mention with no task). Explicitly sequenced *after* Stage 7 ships, not folded in now — no design work done on it yet.
- **Stage 7 built end-to-end (2026-07-04), code complete + unit-tested, deliberately NOT live-verified yet.** `npm run build` clean, `npm test` **124/124 passing** (was 88; +36 across `tests/sourceTypeCache.test.ts`, `tests/pendingQuestions.test.ts`, `tests/tools.test.ts`, `tests/systemPrompt.test.ts`, `tests/loop.test.ts`, and new `approve`-command cases in `tests/router.test.ts`). Full file list: `src/promote/agent/{sourceTypeCache,pendingQuestions,firecrawlClient,notionClient,tools,systemPrompt,loop,runAgent}.ts`; extended `src/sheets.ts` (`readSourceTypeDropdown`, `appendSourceTypeToDropdown`, `readMasterRowAggregateFields`, `getSheetIdByTitle`); extended `router.ts` (`approve` route) and `index.ts` (agent-driven `promote`, new `approve` case, new `app.message()` resume listener, cron sweep updated). See Stage 7A-7G above for the per-item detail. Nothing was run against the live Slack workspace, Google Sheet, or Notion database during this build — every network call in every test is mocked (`vi.mock`), matching the same supervised-live-testing posture used for every other first-write-to-production moment in this project.
  - **Design decisions made while building, not pre-specified in PRD §11 (all logged inline above too, collected here for one-shot scanning):** (1) one bounded agent-loop invocation per Approved row rather than one continuous conversation across the whole sweep — simpler guardrails, matches existing per-row failure isolation. (2) Added `match_master_org` as an 11th-ish tool beyond §11.4's literal list, because PRD §10.3 explicitly requires reusing `sameOrg()` rather than letting the model eyeball org-name matching itself. (3) `append_master_row`/`update_master_aggregate_row` are NOT thin passthroughs to the Stage 6B functions — they add live enum validation (Category + Source Type) and a fresh re-read of current Master values respectively, both defense-in-depth per golden rule #15, beyond what 6B's raw functions did. (4) The 6/90s budget gets exactly one grace iteration, scoped ONLY to calling `flip_staging_review_status`, after a successful write — prevents the dangerous "wrote to Master, never flipped Staging" state that would double-promote a row on the next sweep; if that grace call isn't used correctly, the row is reported `failed` with an explicit manual-check warning rather than anything resembling success. (5) `append_source_type_to_dropdown` resolves the sheet's numeric `sheetId` dynamically instead of trusting the unset `MASTER_TAB_GID` env var. (6) A resumed single row (after a late Slack reply) does not get its own Notion page in v1 — only a Slack reply; scope-limited on purpose. (7) The Notion schema's `Skipped - Source Type` number is used as the catch-all bucket for every `held` outcome, not only literal Source-Type gaps, since the schema pre-dates the more general agent design — the real per-row reason always lives in the page body regardless.
  - **New human dependency surfaced, not yet satisfied:** the resume-on-late-reply path (`app.message()` in `index.ts`) needs a `message.channels` Event Subscription + `channels:history` bot scope, neither of which is granted yet. Until Tej adds this + reinstalls the Slack app, `ask_tej_on_slack` still works for replies within its own 5-minute wait, but a reply arriving after that window won't auto-resume the row. Flagged in PLAN Stage 7C and AGENTS.md §Setup, not a blocker for everything else in Stage 7.
  - **Next:** live-verify (7G) against the 4 real Approved rows, together with Tej, once he's ready — this is the first time an LLM-driven loop (not deterministic code) would write to `master-prospects`.
- **Slack message formatting overhauled repo-wide (2026-07-05), following real research rather than guessing at "what looks nice."** After live-testing the Promotion Agent, Tej flagged the plain-text `Engine: ... · links` footer and the `·`-joined counts as hard to scan, and asked for the underlying formatting/communication principles to be researched properly (via WebSearch/WebFetch against Slack's own developer docs and widely-cited async-communication sources) and written up as reusable docs, not just patched ad hoc.
  - **New:** [docs/slack-formatting-reference.md](docs/slack-formatting-reference.md) (mrkdwn syntax table, Block Kit block types this repo uses — section/context/header/divider/rich_text lists — with exact character/item limits, sourced from `docs.slack.dev`) and [docs/slack-communication-style.md](docs/slack-communication-style.md) (5 distilled principles — one comprehensive message, the 3-line rule, context/clarity/action, asides on their own line, secondary info in `context` blocks — with concrete before/after examples pulled from this bot's own real message strings, sourced from Slack's own etiquette blog + GitLab's async-communication handbook + widely-cited Slack-writing guides). AGENTS.md golden rule #12 now points at both.
  - **Code changes applying the docs, not just describing them:** removed `doneMessage` from `src/slack/reply.ts` (fully superseded) — every "done" summary across CSV/text/image/PDF paths in `src/index.ts` now goes through `bulletMessage` (real bullets for counts, Run ID + Sheet link moved into a `context` block, "flag" notes like the missing-upgrade-candidates warning or a truncated-PDF warning become their own section instead of being string-concatenated onto the summary). The `promote` command's ack and the nightly sweep's starting ping now put their parenthetical asides on their own line/paragraph instead of trailing the sentence. The `approve` command's confirmation now shows the live dropdown as real bullets with the "what to do next" line as context. `ask_tej_on_slack`'s question now explicitly states "no rush, reply whenever" rather than leaving the 5-minute-vs-later-resume distinction implicit.
  - **Deliberately left alone:** the four short "got it, working on it" acks (CSV/text/image/PDF) stay single-line, unstructured text — per the style doc's own principle, a one-fact message doesn't need bullets/blocks just for consistency's sake. `promote/run.ts`'s `promotionSummary` (dead reference code, superseded by the agent) wasn't touched — polishing unused code wasn't the ask.
  - `npm run build` clean, `npm test` still 124/124 (no test asserted on the removed `doneMessage` or the exact old summary strings). Bot restarted with the changes loaded before considering this done.
- **Stage 7G PASSED — first live Promotion Agent run, 2026-07-04/05, supervised end-to-end.** Tej added the `channels:history` scope + `message.channels` Event Subscription and reinstalled the Slack app (unblocking the resume-after-timeout path). Added temporary real-time `console.log`s to `loop.ts` (row start/tool-call/final outcome) for live supervision, then ran `@bot promote` for real against the 4 known Approved rows:
  - **RBCx (row 6, Duplicate="In Master")** → `match_master_org` correctly found the existing Master row (95); `update_master_aggregate_row` appended new sponsorship evidence (StartupTNT/SaaS North/Toronto Tech Week) onto the existing pipe-joined Why Them/Source Link, verified live afterward to be append-only — nothing else on row 95 touched. Outcome: `merged`.
  - **BDC Capital (row 66, Duplicate="", Source="Startup TNT Summit")** — **the exact case that broke the old hardcoded keyword classifier.** `lookup_source_type_cache` correctly missed (never seen before), `firecrawl_search("Startup TNT Summit Canada")` returned real results, and the model correctly classified it as `Comparable event sponsor` (a live dropdown value) without ever needing to propose a new one. `append_master_row` wrote row 177; the decision was cached (`source-type-cache.json` now has `"Startup TNT Summit": "Comparable event sponsor"`) so a future run with the same Source won't need to re-research it. Outcome: `added`.
  - **BC Tech (row 796, Duplicate="", Source="VSW_Future_Planning_-_Past_Sponsors_csv.csv")** — the other known hard case (literally Viv's CSV filename). Correctly reasoned to `Past VSW sponsor` from the filename pattern alone, no Firecrawl needed. `append_master_row` wrote row 178. Outcome: `added`.
  - **TELUS Pollinator Fund (row 746, Duplicate="Review")** — correctly never entered the agent loop at all (the Q4 deterministic pre-filter in `runAgent.ts` caught it); confirmed still `Approved`/untouched afterward.
  - **Verified independently** (not just trusting the agent's own "final" JSON): re-read `data-staging` fresh — rows 6/66/796 flipped to `Merged-to-Master`, row 746 still `Approved`; re-read `master-prospects` fresh — row 95's Why Them/Source Link show the new pipe-joined additions with the prior content intact, rows 177/178 exist with the expected values. Queried the live Notion database directly (`notion-query-data-sources`): one new row, `Status="success"`, `Added=2`, `Merged=1`, `Skipped - Review=1`, `Failed=0`, `Tokens spent=48145`, `Firecrawl calls=1` — matches the run exactly. Fetched the page body: full per-row tool-call trace present and legible, TELUS correctly absent from the trace entirely (never processed).
  - **One real gap found and fixed during this run:** the Notion row's `Slack thread` property came back empty — `runAgent.ts` built the field but never actually passed a value into `createRunLogPage`. Fixed by calling `slackClient.chat.getPermalink({channel, message_ts: threadTs})` for a real Slack permalink rather than hand-constructing the URL format (which would have required hardcoding this workspace's subdomain). Rebuilt (`tsc` clean), retested (124/124 still green), and restarted the bot with the fix before considering Stage 7G closed.
  - **Removed the temporary supervision `console.log`s from `loop.ts`?** No — left them in deliberately (Tej to confirm/revisit): they're low-volume (one line per tool call, one per row), useful for anyone watching the process live during future runs, and cost nothing at rest. Flagging here rather than silently deciding either way.
  - **Stage 7 is now fully shipped:** all of 7A-7G complete, live-verified, nothing left deliberately unbuilt except the already-noted v1 scope limits (contact fields never written, new tool self-building, resumed-item Notion sub-logging).
- **TELUS Pollinator Fund (Staging row 746) unblocked (Tej).** The `Duplicate?="Review"` flag that correctly kept it out of the Stage 7G run was manually cleared, so the next `promote`/nightly sweep will run it through the agent like any other Approved row. This specific row's net-new-vs-duplicate path is still an open re-test (see updated 7G checklist above).
- **Stage 8 built — conversational chat (PRD §12), including a fun easter egg for "will you be my friend" (Katty asked this for fun during the build, so it got a real answer).** A plain `@bot` mention with free text and no file/URL/command previously always fell through to the generic "mention me with a URL/file" `none` reply, even when the text was a genuine question — now it routes to a small read-only chat loop instead. Full detail in Stage 8 above and PRD §12. `npm run build` clean, `npm test` 132/132 (was 124; +8: `tests/easterEggs.test.ts`, `tests/answerQuestion.test.ts`, 4 updated/added `router.test.ts` cases for the new `chat` route). **Not yet live-tested** — same posture as every other first-run feature in this build; next step is trying it against the real Slack workspace once the dev server is back up.
- **Real bug found live, same session, and fixed: a mentioned reply inside a pending-question thread went to the new chat feature instead of resolving the question.** Tej ran `promote`, the agent held TELUS Pollinator Fund on a genuine Source Type gap and asked in-thread; Tej replied `@Future Planning Bot What do you think? Should we make a new one?` — since that reply re-mentions the bot, it fires `app_mention`, and `app_mention` had zero awareness of pending questions (only the separate plain-`message` listener checked `findUnresolvedByThread`). It fell straight into the new chat route and gave a confused, context-free answer ("new what? row, category...?") instead of treating the reply as an answer to its own pending question. **Root cause:** the resume design assumed a "plain reply, no mention" shape (per the original 7C note that `message.channels`/`channels:history` was needed for *unmentioned* replies) but never accounted for the very natural case of replying WITH a mention, which is a different Slack event entirely and skipped that check completely. **Fix:** extracted the pending-question-resolution logic into one shared `tryResumePendingQuestion()` in `src/index.ts`, now called first thing in the `app_mention` handler whenever the mention is a threaded reply (`event.thread_ts` set) — before any `detectRoute` call — so a mention-reply and a plain reply both resolve a pending question identically. The plain-`message` listener now skips any message that itself contains a bot mention (checked via `botUserId`), so if Slack fires both events for the same reply, the question is only resolved once, not twice. `npm run build` clean, `npm test` still 132/132 (no existing test covered this — `index.ts`'s Bolt wiring is verified live, not unit-tested, consistent with how `app_mention`/`app.message` have always been treated in this repo). Dev server restarted with the fix; not yet re-verified live against a fresh pending question.
- **First real production `promote` run on Railway (2026-07-05, 12:46 AM) surfaced a second, more serious resume bug — Tej's actual answer text never reached the resumed model.** Ran `@bot promote` for real against the deployed instance; the agent held Staging row 983 (Float / Float Financial) because `match_master_org`/a full Master index scan found no match despite the row's `Duplicate?="In Master"` flag, and asked Tej how to proceed. Tej replied in-thread: "you can append it. treat it as net-new." The row *was* correctly appended as net-new (Master row 279) and Staging flipped to `Merged-to-Master` — the right outcome — but the agent's own summary said **"Tej gave no clarifying answer"**, which was false; Tej had just answered.
  - **Root cause:** `index.ts`'s `tryResumePendingQuestion` (added in the previous fix, above) fetches `pending` via `findUnresolvedByThread` BEFORE calling `resolvePendingQuestion(pending.id, answerText)` — the persisted store gets the real answer written to it, but the in-memory `pending` object passed into `resumePendingRow(pending, ...)` right after is the stale pre-resolve copy, whose `.answer` field was never set. `resumePendingRow` read `pending.answer || ""`, so the resumed agent's `priorAnswer.answer` was silently `""` — it re-decided on its own with zero knowledge of what Tej actually said, and happened to land on the same call by coincidence. A different Tej answer next time would have been silently dropped with the same false "no answer" framing.
  - **Fix:** `resumePendingRow` (`src/promote/agent/runAgent.ts`) now takes `answer: string` as an explicit parameter instead of reading `pending.answer` at all — the caller already has the just-typed reply text in hand (`answerText`), so there's no stale-object window to fall into. `index.ts`'s call site updated to pass it through directly. `npm run build` clean, `npm test` 133/133 (no test covered this path either, same as the first resume bug — `index.ts`/`runAgent.ts`'s Slack-facing wiring is live-verified, not unit-tested). **No data cleanup needed** — the Float row's actual Master/Staging state is correct (Tej's real instruction and the model's fallback guess happened to agree); this was purely a "the report was lying about what happened" + "next time might not get lucky" bug, not a data-integrity one. Fix shipped and redeployed to the live Railway instance before this entry was written.
- **Third live bug found the same night: `outcome: "held"` was never actually gated on having asked Tej anything.** A separate `promote` sweep on Railway finished with "1 held (I need more info or your OK — I'll follow up in-thread)" — but no question was ever posted in the thread. 24 minutes later Tej asked in-thread "what did you hold?"; since no pending question existed for that thread (nothing was ever asked), `tryResumePendingQuestion` correctly found nothing, and the mention fell through to the new chat feature, which gave a generic, unhelpful non-answer about the size of the Staging queue.
  - **Root cause:** in `loop.ts`, `outcome: "held"` comes straight from the model's own self-reported final JSON (`{"outcome": "held", "detail": "..."}"`) with zero requirement that `ask_tej_on_slack` was ever actually called first. The system prompt only said "held is always safer than a wrong write," which the model could (and did) satisfy by quietly giving up without asking anything — technically safe for the data, but it silently broke the run summary's own promise to follow up, and left no way for Tej to even find out which org was held, since the summary only ever showed a bare count, never names.
  - **Fix, structural rather than just re-wording the prompt (matches this project's stated design principle — narrow, structurally-correct tools/loop behavior over trusting phrasing alone):** `loop.ts` now tracks `askCalled` (true only once `ask_tej_on_slack` actually executes) and adds it to `RowOutcome`. If the model tries to end a row with `outcome: "held"` and `askCalled` is still false, the loop does NOT accept it as terminal — it pushes one corrective message telling the model to either call `ask_tej_on_slack` now or reconsider, and continues (bounded by the existing 6-tool-call/90s/20-iteration budgets, so this can't run away; a model that ignores the nudge twice is allowed to end held on the second attempt rather than looping forever). `runAgent.ts`'s summary now splits held rows into "held — I asked in-thread" vs. "held — no question asked, see below" bullets, and — separately, a real gap regardless of the `askCalled` fix — **now lists every held (and failed) row by organization + detail in the summary body itself**, not just a bare count, so "what did you hold?" is answerable straight from the run summary without needing a follow-up at all. System prompt (`systemPrompt.ts`) also updated to state the rule directly, as defense-in-depth alongside the structural loop guard. `npm run build` clean, `npm test` 137/137 (+4: three new `loop.test.ts` cases for the nudge/no-nudge-twice/already-asked paths, one new `systemPrompt.test.ts` assertion). Fix shipped and redeployed to Railway.

### 2026-07-06
- **Manual one-off dedup cleanup pass over `data-staging`, run by Claude Code directly against the live sheet (not through the deployed service), Tej requested + confirmed each write.** Re-ran the exact ported matchers (`orgKey`/`sameOrg`/`jaccard`/`domainOf` from `src/dedup.ts`, `readStagingApprovedRows`/`readMasterIndex` from `src/sheets.ts`) against every Staging row with `Review Status` = `New` or blank, comparing fresh against both Master and the rest of Staging.
  - **7 rows flagged `Duplicate="In Master"`** that had an exact org-key match in `master-prospects` but were sitting blank (or, in one case — Gumloop, row 1039 — incorrectly showing generic `Review` from the PDF confidence gate when a real Master match existed; upgraded since Master-match outranks the confidence-gate hold per the algorithm's own step ordering).
  - **45 rows flagged `Duplicate="Review"`** on a fresh fuzzy (Jaccard ≥0.8/prefix) match against another Staging row, per golden rule #3 (never drop a duplicate silently). Wrote only columns L/M.
  - **Important false-positive caught before writing:** an early pass also proposed *clearing* the Review flag on 57 rows whose fresh re-check found no name/domain match — but all 57 turned out to be Vision/PDF-extractor rows correctly held by the logo/PDF confidence gate (PRD's "brand-new org from vision/PDF defaults to Review" rule), not dedup matches at all. Excluded before any write; the confidence-gate holds were untouched.
  - **Two ad hoc row-merges, outside the ported algorithm entirely** (the §Dedup engine only handles a *new incoming item* vs. existing rows, not consolidating two already-staged sibling rows — this was a one-off human-directed cleanup, not a repeatable code path): (1) Staging rows 35 "AWS Activate" + 835 "aws" → row 35 survives, renamed "Amazon Web Services (AWS)" (Tej's call), Source URL pipe-joined, Times Seen → 2, Why Them got the standard `(Nth: <source label>)` note, row 835 deleted. (2) Staging rows 715 "CVCA" + 736 "CVCA Intelligence" folded into row 734 "CVCA — Canadian Venture Capital & Private Equity Association" (already the canonical name, already `Merged-to-Master` — Tej confirmed folding both non-canonical siblings into it rather than the reverse), Times Seen → 3, two ordinal notes appended, rows 715/736 deleted.
  - **Staging rows 463 "Vector Institute" and 825 "VEC" deleted outright** (Tej's call — not worth tracking as separate prospect rows; a real research institute and a 2019-past-sponsor CSV abbreviation had been fuzzy-matched to each other, which is exactly the "genuinely-distinct-orgs" pitfall class the matcher is known to be loose on).
  - **Live-sheet concurrency confirmed in the wild:** row 1017 ("Destination Vancouver") was in-scope on an early read (blank/`New`) but had flipped to `Approved` by the time of the final pre-write read minutes later — dropped out of scope correctly on the fresh re-read, exactly per golden rule #7 ("read fresh Staging immediately before computing dedup"). No code change; just confirms the rule matters even for a manual pass.
  - Executed via a temporary local `tsx` script (deleted after the run, never committed) that imported the real `src/dedup.ts`/`src/sheets.ts` functions rather than reimplementing matching logic — same code path the deployed service uses, just driven manually for this cleanup. Verified afterward with a fresh read: 1091 → 1086 rows, AWS/CVCA survivors correct, VEC/Vector Institute both gone. No `master-prospects` writes at any point (out of scope for this pass; golden rule #1 untouched).
- **Three Promotion Agent changes from live-run feedback (2026-07-06, Tej), code-complete + full suite green (141 tests, `tsc` clean) — NOT yet live-verified/redeployed.**
  - **1. Mandatory Firecrawl research to enrich `Why Them`, every promoted row (net-new AND merge).** Bakes in what Tej was doing by hand — dropping `"FOR AGENT: please also launch research on firecrawl to figure out what they do + a 'why them' for VSW"` into the Master Why Them cell — as default agent behavior instead. `systemPrompt.ts` now instructs the agent to `firecrawl_search` (+ `firecrawl_scrape` when snippets are thin) BEFORE writing Why Them, and to write a Why Them that says concretely what the org does AND the VSW sponsorship/partnership fit, grounded in what it found (not a restatement of the Source label); on a merge, the `whyThemAddition` must add genuinely new researched context. `FIRECRAWL_API_KEY` confirmed present locally; this makes it effectively required in prod for good output (still throws clearly if unset, unchanged).
  - **2. `Warm Lead?` (Master col K) now written as a real boolean checkbox (TRUE/FALSE), not `"Y"`/`"Unknown"` text.** Tej has col K as checkboxes, so the old text writes showed as validation-warning cells. `MasterRow.warmLead` is now `boolean` (`types.ts`); `append_master_row`'s schema is `type: "boolean"` with a defensive handler-side coercion (`true`/`"Y"`/`"yes"` → `true`, everything else → `false`) so a stray string from the model still writes a clean checkbox; `systemPrompt.ts` tells the agent it's a checkbox and not to infer a warm lead from mere fame; dead-but-typed `mapper.ts` + its test updated to match. **One-off migration of existing rows done the same session** (human-directed, direct `master-prospects` col-K-only write — within the same columns the promotion path itself writes): read all 350 data rows, found 344 already proper checkboxes (Tej's hand-maintained rows, left untouched) and only 6 agent-written text cells — rows 37/92/112/114/278 (`"Y"`) → TRUE, row 269 (blank) → FALSE. Verified 0 non-boolean col-K cells remain. Migration scripts were temporary (`tsx`, deleted, never committed), same posture as the data-staging cleanup above.
  - **3. Two responsiveness bugs behind the confusing 7:52 PM live run fixed.** (a) **Human think-time counted against the row's wall-clock budget** — the biggest one. `ask_tej_on_slack` blocks up to 5 min waiting on a reply, and that wait counted toward the (then 90s) `WALL_CLOCK_BUDGET_MS`, so a row that asked a question and got an answer ~1 min later tripped "over budget" on the very next iteration and was held as "budget exceeded", *silently discarding the answer Tej just gave* (exactly what happened to Wayve Technologies). Fixed in `loop.ts` by accumulating `askWaitMs` (measured around the `ask_tej_on_slack` handler) and excluding it from the elapsed-budget calc. New `loop.test.ts` case simulates a 5-min reply via a `Date.now` spy and asserts the row still completes `added`, not `held`. (b) **Double-processing race** — a reply arriving while the in-run `ask_tej_on_slack` poll was still waiting got grabbed by BOTH that in-run poll AND index.ts's out-of-thread resume listener, spawning two loops for the same row; the loser (finding the row already flipped to `Merged-to-Master` by the winner) posted the misleading *"that Staging row isn't Approved anymore, so I'm leaving it alone."* Fixed with an in-process `activeAsks` set (`pendingQuestions.ts`, `markAskActive`/`markAskInactive`/`isAskActive`): `ask_tej_on_slack` marks its question active while polling; `tryResumePendingQuestion` (index.ts) still stores the answer always (so the in-run poll picks it up) but, if an ask is still active, lets the in-run loop own the reply instead of starting a second loop. `resumePendingRow` now returns a discriminated `ResumeResult` (`ran` / `already-promoted` / `not-actionable` / `gone`) so index.ts gives an honest message — an already-promoted row now reads *"✅ … was already promoted to Master — you're all set"* instead of the old "leaving it alone." Also raised per-row budgets to fit the new mandatory research pass: `MAX_TOOL_CALLS` 6 → 10, `WALL_CLOCK_BUDGET_MS` 90s → 180s, `max_tokens` 1024 → 2048 (reasoning over scraped markdown); the absolute `MAX_LOOP_ITERATIONS=20` safety net is unchanged. **Next step: redeploy to Railway + a live `promote` run to verify the research quality, the checkbox writes, and a real ask→reply→resume round-trip — none of this is live-verified yet, same first-run posture as every other feature in this build.**
- **Dead code removed (2026-07-06, Tej): the pre-agent deterministic promotion path.** Deleted `src/promote/run.ts` (`runPromotion`/`promotionSummary`/`PromotionResult`) and `src/promote/mapper.ts` (`mapStagingToMaster`/`deriveSourceType`) plus `tests/mapper.test.ts` — all superseded by the tool-using Promotion Agent (Stage 7, `runPromotionAgent` → `runRowAgent` → the model's own `append_master_row`/`update_master_aggregate_row` tool calls). Confirmed nothing live imported them: the only remaining references were two prose comments in `loop.ts`/`runAgent.ts` (kept as historical context) — no runtime callers, `runPromotionAgent` has been the sole `promote` orchestrator since Stage 7. `deriveSourceType` (the old Source→Source-Type keyword table, already documented above as abandoned after it failed the 2026-07-04 dry run) went with it — the agent decides Source Type itself via `read_source_type_dropdown` + research now. `tsc` clean, suite 131/131 (was 141; −10 mapper tests). Orphaned `dist/promote/{run,mapper}.*` removed locally (dist is gitignored).
- **Full retroactive Why Them rewrite across all 400 `master-prospects` rows (2026-07-07, Tej), manual Claude Code pass, col F only.** 191 rows were bare source-label stubs (e.g. "Web Summit partner", "Sponsored 2023."); the other 209 had some content but no consistent structure. Ran every row through Firecrawl search and rewrote col F in 20 batches of 20, verified after each write, tracked via `TaskCreate`/`TaskUpdate` (batches 1–20).
  - **Standard (should inform the Promotion Agent's own Why Them prompt going forward, not just this one-off pass):** one tight paragraph, 2–3 sentences, analyst voice — lead with whatever's actually specific (a dollar figure, a program name, a funding round), let ability-to-pay be *implied* by the fact rather than stated as a generic bolt-on ("has real sponsorship budget"), and be honest/brief when research came back thin rather than padding with reassuring filler.
  - **Real correction mid-run:** the first three batches (rows 3–62, ~62 rows) were written with the old template style before Tej flagged it as "sounds so AI" — every entry mechanically ticked the same three boxes with repeated stock phrases ("has real sponsorship budget", "deep marketing budget"). Tej explicitly said leave those 62 as-is and apply the new standard to everything else — batches 4–20 follow the corrected standard.
  - **Preserved rather than discarded:** existing concrete evidence (real sponsorship dollar figures like CANSEC tiers, "Sponsored 2019/2020/2021", named warm-lead contacts e.g. Absolute Software row 6's "Tej's cousin was a CSM here") was folded into the new prose, never dropped.
  - **Real findings surfaced during research, not just prose polish:** flagged likely name-mismatches (ConAir Group's CANSEC sponsor looks like an unrelated plastics-equipment company; APR Ltd/ITI/Pushr Video/eFund had no clear matching public profile); corrected two rebrands (BlueShore Financial → Beem as of 2025-01-01, First West Credit Union → Tru Cooperative Bank); updated Damon Motors' status from "reportedly distressed" to a more current, mixed picture (real $88M in reservation orders + a pending Nasdaq reverse-merger listing, but still worth verifying given earlier distress reporting) after fresh search results came back more positive; caught that Moment Energy had raised a further $40M Series B beyond what was captured in the earlier curated-50 pass.
  - Verified with a fresh read after the last batch: 400/400 rows non-empty, 0 rows still under 80 characters. Temporary `wt-research.ts`/`wt-apply.ts`/`wt-batch*.json` scripts deleted, never committed (same posture as prior one-off cleanup passes in this log).
- **New feature (2026-07-07, Tej): contact attribution via plain-text Slack mention — a deliberate, narrowly-scoped carve-out to AGENTS.md golden rule #2 ("Contact fields... off-limits to every tool").** Tej can now @mention the bot with just text (no file/URL), e.g. `"Aritzia — Jane Doe, VP Marketing, jane@aritzia.ca"`, to attribute a primary/secondary contact or a generic inbox (e.g. `service@aritzia.ca`) to a company already in `master-prospects`. This is the second sanctioned exception to "never write master-prospects outside the Promotion Agent" (the first being the Promotion Agent itself, PRD §11/golden rule #1) — like that one, the write is structurally restricted in code, not just prompted.
  - **Golden rule #2 carve-out:** a new function, `updateMasterContactFields` (`src/sheets.ts`), is the ONLY way any tool can write Primary Contact Name/Title/Email/LinkedIn (N/O/P/Q), Secondary Contact Name/LinkedIn (R/S), or Generic Intake Email (T) — it's a targeted `batchUpdate` keyed by an explicit column map, structurally incapable of touching any other column regardless of what's passed. It also does append-only writes to Why Them (F, via the existing `appendAggregate` helper) and Notes (AF) when the message explicitly gives a reason to approach the org (F) or other context (AF) — never a full-row rewrite.
  - **New route** (`router.ts`, `{kind:"contact"}`): detected before the existing URL-forward check — an email address anywhere in the text is an unambiguous signal; a LinkedIn profile URL only counts when accompanied by other text, so a bare pasted LinkedIn URL still forwards to n8n exactly as before (unchanged existing behavior).
  - **Org matching** (`src/contact/matchOrg.ts`): deterministic `sameOrg()` pass first (same matcher the dedup engine and the Promotion Agent's `match_master_org` tool already use), falling back to one Anthropic call over the live Master org-name list only when nothing matches deterministically (handles wording variants, e.g. "Pacific Can" typed for a row actually named something else). Ambiguous (0 or 2+ candidates) → asks Tej rather than guessing.
  - **Primary vs. secondary** (`src/contact/contactSlot.ts`, pure + unit-tested): primary if N/O/P/Q are all blank, else secondary if R/S are blank, else ambiguous (asks Tej — overwrite primary, overwrite secondary, or just log in Notes). **Schema gap surfaced by this work:** Secondary only has Name (R) + LinkedIn (S) columns — no secondary Title/Email column exists, so a secondary contact's title/email (if given) is appended to Notes instead, since there's nowhere else for it to go.
  - **Org not found → three-way reply handling** (`src/contact/runContactAgent.ts`'s `resumePendingContact`), per Tej's explicit correction during planning (not just yes/no): (a) confirms it's new → staged via the existing `processItems`/`classifyItem` pipeline (Source: "Manual (Slack contact)", new `Extractor` value "Manual") exactly like any other intake path — never a direct Master write for a net-new org, preserving golden rule #1; Tej is told to re-send the contact info after Approve + `promote`. (b) Corrects the match with a row number ("no, it already exists — row 214") → re-reads that row fresh and writes directly, no second round-trip. (c) Names a different org without a row number → re-runs the same match logic against the correction.
  - **Ambiguity/hold-resume reuses existing infra rather than duplicating it:** `PendingQuestion` (`pendingQuestions.ts`) gained an optional `kind: "promotion" | "contact"` discriminator (defaults to `"promotion"` for every question written before this change) and a `payload` blob; `index.ts`'s `tryResumePendingQuestion` branches on `pendingQuestionKind()` to call `resumePendingContact` instead of the Promotion Agent's `resumePendingRow` for contact-kind questions — same persisted `state/pending-questions.json` + `app.message()` late-reply listener, no parallel hold/resume mechanism built.
  - `tsc` clean, suite 146/146 (+15 new: `router.test.ts` contact-detection cases, `contactSlot.test.ts`, `matchOrg.test.ts` against the same known dedup pitfall pairs already validated in `dedup.test.ts`). AGENTS.md golden rule #2 and PRD §2/§10.5/§10.6 updated with the carve-out; new PRD §13 documents the feature. **Not yet live-verified against the real Slack app/sheet** — same first-run posture as every other feature in this build; needs a real @mention against a live Master row, the org-not-found ask→reply flow, and a primary+secondary two-contact message before calling it done.
- **Schema change (2026-07-08, Tej): added Secondary Contact Title + Secondary Contact Email columns to the live `master-prospects` sheet, closing the gap the contact-attribution feature (above) had just shipped with a Notes-overflow workaround for.** Tej inserted the two new columns directly in the sheet UI, which — as a normal spreadsheet column-insert does — shifted every column from the old Secondary Contact LinkedIn (S) onward two letters right: Secondary LinkedIn S→T, Generic Intake Email T→V, Stage U→W, ... Notes AF→AH. Verified the exact new header row live via a one-off read (`master-prospects!A2:AL2`) before touching any code, rather than trusting the pasted column list's ordering alone — real column count changed from 7 to 9 in the contact block, not just a rename.
  - **Code updated to match, same files as the original feature build:** `types.ts` (`MasterContactFields` gains `secondaryTitle`/`secondaryEmail`, `MasterRow.notes` comment F→AH), `sheets.ts` (`appendMasterRow`'s blank-column list gets two more entries and its write range extends to `B:AH`; `readMasterContactFields`/`updateMasterContactFields` re-mapped to the new N–V range + AH for Notes), `contact/contactSlot.ts` (`decideContactSlot` now checks all four secondary fields for "secondary empty," not just the name, mirroring the existing primary check), `contact/runContactAgent.ts` (secondary contacts now write Title/Email directly through `updateMasterContactFields` instead of the old Notes-overflow path, which is deleted — the schema gap it existed for no longer exists; the `slot_conflict` resume branch's secondary-overwrite case does the same).
  - AGENTS.md's live column reference, and PRD §13's column callouts, updated to the new letters; the "Secondary has no Title/Email column" language removed everywhere since it's no longer true.
  - `tsc` clean, suite 147/147 (+1: a `contactSlot.test.ts` case for a partially-filled secondary, e.g. just a title with the name still blank, staying "ambiguous" — mirrors the existing partially-filled-primary case). **Not yet live-verified** — same posture as the original feature; still needs a real end-to-end @mention run, doubly so now given the live schema just changed under it.
- **Feature extended (2026-07-08, Tej): contact attribution now also handles arbitrary field updates ("make this a warm pathway" dropped silently before this).** First live test of the feature (New Ventures BC, row 232, in `#tej-bots`) attributed the primary contact correctly, but the message's second instruction — "Make this a warm pathway" — was silently ignored, since the parser only understood contact fields. Tej's ask: "it should be familiar with any of the columns and if i ask to make a change in any message to a given row, it should know the columns to change."
  - **Scope decision, asked explicitly rather than assumed (data-safety implication):** offered a narrower default (every column except the Promotion-Agent-owned identity/classification set — Prospect ID/Organization Name/Category/Subsector/Source Type/Source Link) vs. full override. **Tej chose full override — "truly everything, including Category/Source Type/Org Name."** Recorded here because it's a real, deliberate expansion of golden rule #1's boundary, not an oversight: `updateMasterFields` (below) can now touch B/C/D/I/J, which used to be exclusively the Promotion Agent's territory. There is no locking between the two write paths — see the "Accepted risk" note added to PRD §13.
  - **Verified the live sheet's actual data-validation state before designing anything**, rather than assume: `Category` (C) and `Source Type` (I) are `ONE_OF_LIST` (Source Type's live values now include a 4th, `Ecosystem player` — first observed here, not yet reconciled with AGENTS.md's stale "only 3 values" note from 2026-07-04, tracked as a small follow-up); `Warm Lead?` (K) is a real `BOOLEAN` checkbox; every column from `Stage` (W) onward has no validation set at all (Tej hasn't started using outreach-tracking columns yet) — confirmed via a live `includeGridData` read across several rows, not assumed from the header row alone.
  - **New: `src/types.ts`'s `MASTER_FIELD_KEYS`/`MasterFieldKey`/`MasterFieldUpdate`** — 23 keys covering every master-prospects column *outside* the contact block (has its own primary/secondary rules) and Why Them/Notes (stay append-only via the existing `whyThemAddition`/`notesAddition`). `ParsedContactMessage` gains `fieldUpdates: MasterFieldUpdate[]`.
  - **New: `src/sheets.ts`'s `updateMasterFields`** — same defense-in-depth pattern as every other write helper here (explicit `MASTER_FIELD_COLUMNS` key->column map, cannot resolve outside it), plus the enum/boolean handling golden rule #15 requires: throws on an invalid `category` (checked against `CATEGORY_ENUM`) or `sourceType` (checked against a fresh `readSourceTypeDropdown()` read, not a cached list) rather than writing it; coerces `warmLead` via the new exported `coerceBoolean` (`true`/`y`/`yes`/`warm` -> `true`) so "make this a warm pathway" writes a real checkbox value, not the string "warm pathway".
  - **`src/paths/contact.ts`'s prompt extended** to also extract `fieldUpdates`, with `field` constrained to literally the `MASTER_FIELD_KEYS` list (same defensive pattern `classifyItem` uses for Category) so the model can't invent a column name that doesn't map to anything.
  - **`src/contact/runContactAgent.ts`'s `applyContactUpdate`** now applies `fieldUpdates` after contacts/notes/why-them, one at a time via `updateMasterFields` (`applyFieldUpdates`) — each update is independent, so one bad value (e.g. an invalid Category) is reported back in-thread (`bulletMessage`'s new "Couldn't apply" section) without blocking the rest of that message's changes. `handleContactMention`'s early-exit guard relaxed: a message is only rejected as empty if it has no contacts, no field updates, AND no Why Them/Notes addition — previously any message with zero named contacts was rejected outright, which would have wrongly rejected a field-update-only message.
  - **Known remaining limit, called out in PRD §13 rather than silently left:** the "contact" route still only triggers off an email address or a LinkedIn URL-plus-text in the message (`router.ts`). A pure follow-up like "actually make that a warm lead too" with no contact info won't route here on its own yet — out of scope for this pass, flagged for a future round if Tej wants it.
  - `tsc` clean, suite 164/164 (+17: `masterFields.test.ts` for `coerceBoolean` and `MASTER_FIELD_KEYS`'s exclusion of contact/append-only fields). AGENTS.md golden rules #1/#2 and PRD §13 updated with the expanded scope and the accepted-risk note. **Not yet live-verified** — same posture as every prior round of this feature.

### 2026-07-13

- **New feature (Tej): #vsw-future-planning is now live-mirrored into the "Thread with Andrew" Notion page (`38e6b6f2b95b8068b183c49d924e5906`), not just `#tej-bots`/the Promotion Agent.** Every human message and thread reply posted in that channel gets appended to the page in real time, newest entry at the top — the same convention the page's hand-written history already used, now automated instead of manually transcribed.
  - **New module, `src/threadLog/`** (kept separate from `promote/agent/notionClient.ts` on purpose — it writes arbitrary page blocks, not database rows, and has its own persisted state): `notionThreadLog.ts` (marker discovery + block insertion + `state/thread-log.json` ts->anchor map), `slackMrkdwn.ts` (Slack mrkdwn -> Notion rich_text: `*bold*`, `` `code` ``, `<url|label>`, `<@U…>`/`<#C…>` tokens), `authorMap.ts` (Slack user ID -> Notion author: Tej = user mention, Andrew = page mention, Vivian = plain text, matching the page's existing convention; unmapped users fall back to their Slack display name).
  - **Insertion mechanics:** a new top-level message is inserted as `[divider, date-paragraph, callout]` right after the page's `"[Next email here]"` marker paragraph (found by text search, not a hardcoded block ID, so it survives the page being edited around it — e.g. the new agent-instructions callout added above it the same day). A reply is inserted as `[date-paragraph, callout]` directly after its parent's (or latest sibling reply's) callout block, tracked via `state/thread-log.json` keyed by thread root ts; if that state is missing (Railway redeploy without `THREAD_LOG_STATE_PATH_OVERRIDE` pointed at a persistent Volume, or a reply to a message that predates this feature), the reply degrades gracefully to logging as its own top-level entry rather than being dropped.
  - **Wired into `index.ts`** as a new `app.message()` listener, filtered to `VSW_FUTURE_PLANNING_CHANNEL_ID` and independent of the existing promotion/contact pending-question resume listener. Reuses `NOTION_API_KEY` (already granted access to the Promotion Log database) but that integration also had to be confirmed to have access to this specific page — verified live before writing any code (Notion integrations don't inherit access across pages). Reuses the `channels:history` scope + `message.channels` Event Subscription already granted 2026-07-04/05 for the pending-question resume feature — no new Slack app reinstall needed, only inviting the bot into `#vsw-future-planning` if it isn't already a member there.
  - **Live-verified against the real page before considering this done** (not just `tsc`/unit tests): wrote and then deleted several real test entries (top-level + nested reply) directly against the production Notion page to confirm block structure, author resolution, and marker re-discovery all work — including after the agent-instructions callout was inserted above the marker. Caught and fixed two real bugs this way: `dividerBlock()` was missing the required `divider: {}` payload (Notion API rejected it outright), and the Notion MCP markdown tool mis-parsed the agent-instructions callout content on first attempt (degraded into a stray code block) — rewritten with a raw-API block call instead of the enhanced-markdown insert for reliability.
  - New env vars (`.env.example`): `VSW_FUTURE_PLANNING_CHANNEL_ID`, `NOTION_THREAD_LOG_PAGE_ID`, optional `THREAD_LOG_STATE_PATH_OVERRIDE` (same Railway-Volume-survives-redeploy pattern as `PENDING_QUESTIONS_PATH_OVERRIDE`).
  - Also added an "Agent instructions" callout at the very top of the Notion page itself (Tej's request) — explains the page's newest-first layout, entry/reply structure, and this automation to any future agent working the page directly, so it isn't rediscovering the convention from scratch.
  - `tsc` clean, suite still 164/164 (no existing tests touched; this feature has no unit tests yet — it was verified live against the real API instead, since its correctness is really "did the block land in the right place in Notion," not something worth mocking).

### 2026-07-14

- **Bug found and fixed the same day the thread-log feature (above) went live: it silently received zero Slack events for its first ~3 hours in production.** Tej invited the bot into `#vsw-future-planning`, set the two new env vars on Railway, and sent test messages (himself, Vivian, a thread reply) — none showed up on the Notion page, and Railway logs showed no errors, no activity, nothing at all for that listener.
  - **Diagnosis process:** ruled out, in order — stale/wrong deployed commit (Railway's `latestDeployment.meta.commitHash` matched the pushed commit), missing OAuth scope (`auth.test`'s `x-oauth-scopes` response header confirmed `channels:history` was present on the exact token Railway has deployed, verified by comparing token suffixes between `railway variables` and local `.env` — not just assumed equal), a stale pre-reinstall token (same check ruled this out), and a Bolt/code bug (no errors ever surfaced via `app.error`). Added temporary unconditional diagnostic logging to the listener (it had no success-path log at all, so total silence was ambiguous between "never received" and "quietly filtered/succeeded" — a real gap, now fixed permanently by keeping a scoped success log). Redeployed, had Tej send a real message, and Railway logs still showed zero events for that listener specifically — even though a `reaction_added` in a *different* channel logged fine, proving Socket Mode itself was healthy.
  - **Root cause: `#vsw-future-planning` is a private channel, not a public one — confirmed via `slack_search_public_and_private` with `channel_types` restricted to `public_channel` (0 results) vs `private_channel` (5 results) for the same query.** Private channels fire `message.groups`, not `message.channels`, and require the `groups:history` bot scope, not `channels:history` — a completely separate scope/event pair from the one already granted 2026-07-04/05 for the (public, `#tej-bots`) pending-question resume feature. The original build (see 2026-07-13 entry above) wrongly assumed the two features could share the same public-channel scope pair without checking whether the target channel was actually public.
  - **Fix: human-only, no code change needed.** Tej added `groups:history` to Bot Token Scopes and `message.groups` to Subscribe to Bot Events, then reinstalled the app. Confirmed via a fresh `auth.test` call (same token, unchanged suffix — Slack didn't rotate it on this particular reinstall) that `groups:history` was now present, then had Tej send one more real message: it landed in the Railway logs (`[thread-log] recorded ts=... to Notion OK`) and was verified live on the Notion page immediately after, correctly formatted (date, Tej's real Notion user mention, message body).
  - **Code cleanup:** removed the temporary unconditional per-message diagnostic log (it fired for every message in every channel the bot is in, too noisy to keep permanently); kept the scoped `[thread-log] recorded ts=... to Notion OK` success log and the existing error log, so a similar failure in the future is diagnosable from normal logs without needing another round of temporary instrumentation. Updated the listener's comment in `index.ts` and this doc to state the private-channel scope requirement explicitly, so it isn't rediscovered the hard way again.
  - `tsc` clean, suite still 164/164 (no code logic changed, only comments/logging).

### 2026-07-13 (later)
- **Outreach tiering built for the 396-row `master-prospects` list** (from Tej's "VSW Future Planning: Current State" doc, §3A — Tier 1: 20, Tier 2: 50, Tier 3: 50, Tier 4: 100, Tier 5: rest). This is a distinct concept from `data-staging`'s existing `Tier` column (col H, source-tier used for Category/Source-Type classification during intake) — deliberately not reused, to avoid a naming collision. Added a new **`Outreach Tier`** column at `master-prospects!AI` (appended after AH, not inserted mid-sheet, so no existing lettered column reference in AGENTS.md/PRD.md/`src/sheets.ts`/`src/types.ts` shifts). Done via a one-off script (not committed to the repo — ad hoc, run once using the existing service-account credentials, same auth pattern as `src/sheets.ts`), not part of the Slack bot's structural write paths.
  - **Method (deterministic, no LLM judgment call on the ranking):** score each row from existing columns only — Warm Lead? = TRUE (col K) → +1000 (dominates, since a real relationship beats any amount of research); Source Type (col I) → Past VSW sponsor +300, Past VSW event partner +250, Comparable event sponsor +150, Ecosystem player +50, blank +0; `Why Them` (col F) keyword bonuses → $/sponsorship-tier language (Gold/Platinum/Title/Presenting) +20, public-company language (Nasdaq/TSX) +15, Vancouver/BC HQ language +10. Sort all 396 rows by score descending, stable (ties broken by original row order, so reproducible on rerun). Sliced per Tej's tier sizes: rows 1–20 → Tier 1, 21–70 → Tier 2, 71–120 → Tier 3, 121–220 → Tier 4, 221–396 → Tier 5.
  - **Result:** exactly 20/50/50/100/176 rows landed in Tier 1–5 respectively, written to `master-prospects!AI3:AI398` (header `AI2` = "Outreach Tier"). No other column touched.
  - **Known limitation, accepted (per the doc's own §3E "avoid perfectionism on contact research" decision, applied here too):** this is a first-pass heuristic ranking on data already in the sheet — it can't see relationships that aren't yet recorded (e.g. a small org whose CEO has a personal VSW connection nobody's logged). Andrew/Holden/Vivian's warm-lead flagging pass (§5 of the doc, not yet done as of this writing) runs in parallel and can override any row's tier by hand; this ranking is a starting point, not a final call.

### 2026-07-14 (manual master-prospects cleanup, ad hoc, Tej-directed)
- **Merged duplicate "Absolute" / "Absolute Software" rows.** Same company, two rows (weaker `Ecosystem player` evidence vs. richer `Comparable event sponsor` evidence including a real warm-intro mention that was in the prose but never reflected in the `Warm Lead?` checkbox — flagged to Tej, not changed unilaterally). Kept "Absolute Software," folded in Subsector (`Cybersecurity`), unioned Source Links, deleted the "Absolute" row. Also moved a misplaced "General Inbox Form: <url>" string out of Primary Contact Name (it isn't a person) into Generic Intake Email. Sheet went from 396 → 395 rows.
- **Merged duplicate "RBC" / "RBC (Royal Bank of Canada)" rows.** Same entity, two rows describing different evidence (RBC Reach accelerator + Catalyst partnership + Launch Academy sponsorship vs. a Presenting Sponsor track record + side-hustle programming) — combined into one `Why Them` paragraph on the kept "RBC" row, unioned all 4 Source Links, carried over the Firecrawl-research Notes tag, deleted the duplicate row. **Deliberately did NOT touch the separate "RBCx" row** — that's RBC's dedicated early-stage banking arm, a genuinely distinct business unit (own warm contacts Vallen/Jason/Gina via Viv, `Warm Lead?=TRUE`, Tier 2) — merging it into generic "RBC" would have buried real warm-lead evidence under a much weaker row, the same "genuinely-distinct orgs must stay separate" principle as AGENTS.md's documented dedup matcher pitfalls (entrepreneurship@UBC vs Innovation UBC, etc.). Sheet went from 395 → 394 rows.
- Both merges done via one-off scripts (not committed), same service-account auth pattern as the tiering pass above; neither touched the `Outreach Tier` column (both merged rows were already Tier 5, no rescoring needed this round). Per golden rule #3 (never drop a duplicate silently) — evidence from both source rows was folded into the kept row's prose, not discarded.
- **Also did ad hoc contact research this session (Accenture, Adobe, Air Canada — Firecrawl web search + scrape, no code changes)**, surfacing named contacts for Slack-thread review before writing anything to Primary/Secondary Contact columns — none of those writes have been applied yet, pending Tej's go-ahead per row.
- **Also appended Mastercard Changeworks research to the existing Mastercard row's `Why Them`** (row 209) — appended, not overwritten, so the existing `Start Path` evidence stayed intact. Findings: Changeworks is Mastercard Canada's social-impact/CSR program (grants+partnerships, hackathons/datathons, employee volunteering), focused on not-for-profits supporting Indigenous/newcomer entrepreneurs — a different kind of program than `Start Path`, which explains why this row already had a named contact (Rebecca Harrison, Changeworks Grants & Partnerships Committee Chair) that had no prior context in the sheet.
- **Documented the "access the live sheet programmatically" pattern in CLAUDE.md** (new section, right after the intro) — every piece of sheet research/cleanup this session (tiering, the Absolute/RBC merges, the Mastercard append, and the earlier Earnest Ice Cream contact fix) was done via a throwaway `.ts` file run with `npx tsx` from inside the repo, using the same `google.auth.GoogleAuth` + `GOOGLE_APPLICATION_CREDENTIALS` pattern as `src/sheets.ts` — never a browser, never answered from memory. Tej asked for this to be written down so a future Claude Code session defaults to it immediately instead of rediscovering it. Also clarified that CLAUDE.md's "never write `master-prospects`" non-negotiable constrains the *deployed service's* code paths (`src/`), not ad hoc Claude-Code-session writes Tej directly asks for — those just need to be logged here, same as any other change.

### 2026-07-14 (sponsorship/event tracker — new `master-prospects` checkbox block, ad hoc, Tej-directed)
- **Request (relaying Dilts's feedback):** a per-event checkbox view on `master-prospects` — narrow checkbox columns, one per past sponsorship/partnership/research source, so it's visible at a glance which orgs came from which. Tej had already added the first two columns by hand in the live sheet (`I2`="VSW", `J2` blank) before asking for the rest.
- **Built the full org→event matrix from `data-staging` col F ("Source"), not guessed.** Every staging row already names its source there, even ones later relabeled "Image/PDF/Markdown via Slack (...)" — traced each of those back to the actual Slack file/screenshot content (Why Them text + Source URL) to get a real name instead of leaving them opaque. Found and folded in evidence that was previously hiding under generic Slack labels: `Image via Slack 01:38` → Launch Academy's "2026 sponsor deck" screenshot; `Image via Slack 23:34` and the `cansbridgefellowship.com/sponsor` text source → same CanSbridge Fellowship bucket; `Image via Slack 01:45` → BC Tech's "2026 TechMap"; `PDF via Slack 19:12`/`19:13` → "AI/MV Sector Profile 2024" and "BC Naturally AI" brochure respectively; `Markdown/Text via Slack 23:42` → vancouver.ca; `Image via Slack 18:51` (today's date) → Life Sciences BC Gold Sponsor list. One row (Aquilini, a bare logo screenshot with no named source) stayed unattributed — left unchecked everywhere rather than guessed.
- **Confirmed with Tej: include every distinct source, not just "real" conferences** (so sector-report PDFs and ecosystem-directory pages get a column too, not only named events), **and cover staging-only orgs** (not yet promoted to `master-prospects`), not just the ~395 already-promoted rows.
- **28 new checkbox columns inserted into `master-prospects` right after existing J** (`insertDimension`, `inheritFromBefore: false`, landed cleanly on the existing merge boundary between the I:J "Sponsored Events" merge and the old K:O "Source + Warm Lead Routing" merge — verified live before and after, no merge got split). `J2` (previously a blank placeholder) filled in as "Past VSW Event Partner," mirroring Source Type's existing enum value of the same name. Checkbox (`BOOLEAN`, `strict: true`) data validation applied K3:AL500 (buffer past the current row 397 for near-term growth). Populated I (VSW) and all 28 new columns for every existing row (3–397) from the matrix; live aggregate counts read back and diffed against the computed matrix per column — all 28 matched exactly, plus the VSW count (22).
- **Same 30-column set (VSW + Past VSW Event Partner + 28 events) added to `data-staging`** in its existing unused trailing columns (grid grown from 33 to 48 cols via `appendDimension`, no insertion/shift — staging's A–R columns and the Slack service's read ranges into them are untouched), so staging-only orgs (858 of 1,253 total orgs seen) get the same visibility without writing anything into `master-prospects` proper (keeps golden rule #1 intact — this is informational columns on staging, not new Master rows). Row-level (not org-deduped) aggregate counts verified against the matrix (e.g. Toronto Tech Week 226/226, VSW 37/37).
- **This insertion shifted every `master-prospects` column from the old I onward by +28** on top of the +2 shift already live from Tej's manual VSW/placeholder insertion earlier this session (that +2 hadn't been reflected in `src/sheets.ts` yet — caught mid-task, see below) — old Source Type (I) is now `AM`, Source Link (J) is now `AN`, Warm Lead? (K) is now `AO`, and everything through old AG (Budget Window) is now `BK`; old AH (Notes) is now `BL`. Full before/after map verified against a live header read, not assumed from arithmetic alone.
- **Fixed `src/sheets.ts` to match, in the same pass (this was a live, active bug independent of the checkbox request — the deployed Slack bot's field-update paths were about to start silently corrupting cells, e.g. a Warm-Lead write landing on the Source Type dropdown cell, a Stage write landing on Secondary Contact Email):** `MASTER_FIELD_COLUMNS`, `updateMasterContactFields`'s `columnByKey`, `readMasterContactFields`'s ranges, `appendMasterRow`'s full B–BL write array (now leaves I/J/K–AL blank rather than mis-writing sourceType/sourceLink/warmLead into them), `updateMasterAggregateRow`, `readMasterRowAggregateFields` (switched to a `values.batchGet` of two discrete cells rather than a wide F:J range, so it no longer depends on counting the 28-column gap), `readSourceTypeDropdown` + `appendSourceTypeToDropdown` (col index 8→38), and `readMasterPromotionIndex`. Deliberately did **not** expose the new I/J/K–AL checkbox columns through `MASTER_FIELD_COLUMNS` — those stay populated only by the one-off sponsorship-tracker script, not the Slack bot's live field-update path.
- **Verified against the live sheet post-fix** (not just `tsc`): re-ran `readSourceTypeDropdown`, `readMasterContactFields(3)`, `readMasterRowAggregateFields(3)`, and `readMasterPromotionIndex()` live and confirmed each now resolves to the same real values that used to live at the old column letters (e.g. A100's Source Link still reads `https://inventurescanada.com/sponsors`, now correctly from `AN` instead of the stale `J`). `tsc` clean, suite 164/164 (no existing tests touched — all mocked at the function level, so unaffected by the column-letter shift).
- One-off matrix-building/write scripts kept in the gitignored `tmp/` (not committed), same pattern as the tiering/merge scripts above.

### 2026-07-15 (CANSEC column + a found-not-fixed data bug, ad hoc, Tej-directed)
- **Tej caught a gap: CANSEC was missing from the 28-source list above.** Root cause — CANSEC sponsorship evidence (real dollar figures: Silver ~$10,300 up to Platinum ~$80,000 CAD) for 37 orgs (Airbus, AWS, Boeing, CAE, IBM, SAP, Northrop Grumman, University of Toronto, etc.) came from a direct research pass written straight into `master-prospects` (the earlier "curated-50" work), never through `data-staging` — so it was invisible to a Source-column-based build. Added a 29th checkbox column, **`CANSEC`**, appended at `master-prospects!BN` (and mirrored at `data-staging!AW` for schema parity, all-`FALSE` there since no staging row ever carried this evidence) — appended after `Outreach Tier` rather than inserted mid-block, deliberately avoiding a second AM-onward reshift (same reasoning as why `Outreach Tier` itself was appended, not inserted, on 2026-07-13). Populated by scanning cols F and G (see next point for why both) of every row 3–397 for "CANSEC" — 37 matched, verified live (e.g. Airbus row 14 → `TRUE`).
- **Found, while investigating, a pre-existing data-integrity bug — flagged to Tej, deliberately NOT fixed yet (his call, "not now — just flag it"):** those same 37 CANSEC rows have every column from "Why Them" onward shifted one cell right of where it belongs — Why Them sits in G instead of F, and everything after (Source Type, Source Link, Warm Lead?, contact fields, Stage, etc.) is one column further right than it should be for that row specifically (e.g. Airbus's `Warm Lead?` value is currently sitting in the `Warm Lead Person` cell). This predates today's +28 insertion entirely — it's a per-row F-onward misalignment baked into how that batch was originally written, not something today's structural changes caused. **Not fixed. If revisited, the fix is per-row (only these 37), not a sheet-wide shift** — re-verify the exact affected row list before touching anything, since new rows may have been added/reordered since this was last checked.
- One-off scripts again in gitignored `tmp/`, not committed.

### 2026-07-15 (later — correction: the "found bug" above was a live Tej edit, not a pre-existing one; column map fixed again + Why-Them backfill)
- **Correcting the entry above: what looked like a narrow, pre-existing 37-row bug turned out to be Tej moving a column live, mid-session, affecting the entire sheet (370 of 394 rows), not 37.** Tej cut "Warm Lead Person" out of the warm-lead block (it was at old AP) and pasted it right after Organization Name (new col C) — a column *move*, not an insert: everything between C and the column's old slot bubbled +1 (Category D, Subsector E, HQ F, **Why Them now G** (not F), Potential Mutual Value H, Programming Angle I, VSW J, Past VSW Event Partner K, the 28 event columns L-AM, Source Type AN, Source Link AO, Warm Lead? AP), while everything from Warm Lead Path onward snapped back to its pre-2026-07-14 position (AQ onward unchanged). Confirmed by direct live cell reads (not inferred) and by comparing against this session's very first header read, which showed A100 correctly aligned at the old positions before any edits happened.
- **Explicit direction from Tej, going forward: he will keep restructuring `master-prospects` directly whenever he wants, and expects column-letter code to detect it live rather than assume stability.** `MASTER_FIELD_COLUMNS`'s doc comment in `src/sheets.ts` now says this outright and points at this log; every affected function's comment was pared down to stop repeating a shift history that will keep going stale, and instead says "re-verify against a live header read."
- **Re-fixed all the same functions touched in the earlier 2026-07-14 pass** (`MASTER_FIELD_COLUMNS`, `updateMasterContactFields`'s `columnByKey`, `readMasterContactFields`, `updateMasterAggregateRow`, `readMasterRowAggregateFields`, `readSourceTypeDropdown` + `appendSourceTypeToDropdown` (col index 39, col AN), `readMasterPromotionIndex`, `appendMasterRow`'s full B-BL write array) to the fresh layout — verified live via the same `readSourceTypeDropdown`/`readMasterContactFields(3)`/`readMasterRowAggregateFields(3)`/`readMasterPromotionIndex()` smoke checks as before; all resolve correctly (e.g. A100's Source Link still `https://inventurescanada.com/sponsors`, now correctly from AO). `tsc` clean, suite 164/164.
- **Closed the actual gap Tej asked about (why AMD, Andersen in Canada, and others showed zero events checked):** their sponsorship evidence (AMD/Andersen both say "already partners with Web Summit") lives only in Why Them prose from the same direct-research pass as the CANSEC rows — never through `data-staging`, so invisible to the source-column-based matrix. **Backfilled by keyword-scanning Why Them text** (fresh column, driven off a live header read rather than a hardcoded letter) for the ~21 known event names, restricted to orgs with zero checkboxes already ticked (so nothing already-correct got touched or double-counted). **30 orgs newly checked**, 31 cell writes (National Bank of Canada matched two: BC Tech Technology Impact Awards + SAAS North) — verified live (AMD/Andersen → Web Summit Vancouver `TRUE`). List of all 30 + matched event(s) printed in the run log, not reproduced here; re-derivable from `tmp/backfill_whythem.ts` if needed (script itself not committed, per the established gitignored-`tmp/` pattern).
- **Known remaining limitation, not attempted:** the keyword scan only covers orgs with *zero* checkboxes ticked; an org with at least one checkbox already correct (from `data-staging`) but *also* unrecorded prose evidence for a second event wouldn't get backfilled by this pass. Not in scope unless Tej asks — flagging so it isn't assumed fully exhaustive.
- **Tej caught a second missing source: Inventures (Inventures 2025, Alberta Innovates) — same pattern as CANSEC.** 21 orgs (A100, Air Canada, Aon, ATB Financial, ATCO, Deloitte, Rogers, TC Energy, University of Alberta, etc.) name it directly in Why Them / carry `inventurescanada.com/sponsors` as their Source Link, all from the same direct-research pass, never through `data-staging`. Added a 31st checkbox column, **`Inventures`**, appended at `master-prospects!BO` (mirrored at `data-staging`, schema parity, all-`FALSE`) — driven off a fresh live header read for "Why Them"/"Source Link" positions rather than a hardcoded letter, per the pattern this whole day established. 21 matched, verified live (A100 row 3 → `TRUE`). No `src/sheets.ts` change needed this time (pure append, no structural shift). `tsc` clean, suite 164/164.

### 2026-07-15 (later still — third live restructure mid-session, + first duplicate merge of the day)
- **Tej moved CANSEC and Inventures out of their appended tail position (BN/BO) into the main "Sponsored Events" block, right after the other 28 event columns** — sensible (keeps all 30 event checkboxes visually contiguous instead of two dangling at the very end), but it shifted Source Type/Source Link/Warm Lead?/Warm Lead Path/all contact fields/Stage-through-Budget-Window/Notes/Outreach Tier each +2 for the third time this session. Caught immediately by re-reading the live header before trusting anything (now the default habit, not an afterthought) rather than by a confusing "is this corrupted" detour like earlier today.
- **Re-fixed the same set of `src/sheets.ts` functions a third time** (`MASTER_FIELD_COLUMNS`, `updateMasterContactFields`'s `columnByKey`, `readMasterContactFields`, `updateMasterAggregateRow`, `readMasterRowAggregateFields`, `readSourceTypeDropdown` + `appendSourceTypeToDropdown` (col index 41, col AP), `readMasterPromotionIndex`, `appendMasterRow`'s full B-BN write array, now 30 blank event-checkbox slots instead of 28). Verified this time by **organization name, not row number** — Tej had also re-sorted the sheet's row order (A100 is now row 206, not row 3), so a row-number spot check alone would've been meaningless; `readMasterPromotionIndex` + `readMasterContactFields`/`readMasterRowAggregateFields` all cross-checked against A100 wherever it actually sits, and matched. `tsc` clean, suite 164/164.
- **Merged the CVCA duplicate Tej flagged: "Canadian Venture Capital & Private Equity Association" (row 54) and "CVCA — Canadian Venture Capital & Private Equity Association" (row 70), same org.** Row 54 had the stronger evidence (`Comparable event sponsor`, Elevate Festival Toronto Community Partner, Tier 4); row 70 had only generic `Ecosystem player` evidence from "The 50" 2026 Western Canada list. Kept row 54, renamed it to the CVCA-prefixed name (more recognizable), folded row 70's general "national voice for Canada's VC/PE industry" description into Why Them, unioned both Source Links, checked both event boxes (Elevate Festival Toronto *and* "The 50" list), kept the stronger `Comparable event sponsor` Source Type and Tier 4, appended a note documenting the merge, then deleted row 70. All column positions for the write driven off a fresh live header read (not hardcoded letters) — same discipline as everything else today. Sheet went from however-many rows to one fewer; verified live post-merge (single row, both checkboxes true, both links present).
- One-off scripts again in gitignored `tmp/`, not committed.

### 2026-07-15 (thread-log: toggle-based reply threading + full page migration)

- **Bug reported by Tej: the "Thread with Andrew" page was not chronological with most recent at top, and threads weren't organized well.** Diagnosis: top-level entries were already correctly newest-first on their own (each anchored right after the marker at insert time), but replies were nested inline directly under their original parent's position ("↳ reply from X"). A long-running Slack thread that kept getting replies over many hours had its later replies stuck at that same old anchor point — so once newer unrelated top-level messages arrived, those later replies ended up visually buried below content that's actually older than them. Confirmed live on the page: a thread started 2026-07-15 09:07 kept receiving replies through 14:29, while unrelated top-level messages at 08:50–10:59 landed above the whole thread block, several of which are chronologically *older* than some of the thread's own later replies.
  - **Design options considered with Tej:** (a) bump the whole thread to the top on every new reply — true recency at the top, but requires deleting/recreating blocks each time a thread gets a reply, since the Notion API has no "move block" endpoint; (b) fully flat chronological ordering, splitting threads apart — simpler, but scatters a conversation across the page with just back-references. **Tej's pick: a collapsed toggle per thread.** Top-level entries stay exactly where they already correctly sorted themselves (by their own send time); all of a thread's replies live inside a "🧵 N replies" toggle directly under the parent's callout, appended to as new replies arrive. The toggle's position never has to move, so nothing needs deleting/recreating on new activity, and the main page flow reads strictly chronologically at a glance while conversations stay grouped and readable when expanded.
  - **Code (`src/threadLog/notionThreadLog.ts`):** `ThreadLogState` now stores `{ calloutBlockId, toggleBlockId, replyCount }` per thread root ts, not a single anchor id. First reply to a thread creates the toggle (as a sibling block right after the parent's callout) and puts the reply's date-paragraph + callout inside it as children; every later reply just appends more children to that same toggle (Notion's default append-to-end ordering keeps them chronological) and renames the toggle's label with the new count via a block-level `PATCH`. Live-tested against the real page before considering it done: created a parent + 2 replies, then an unrelated newer top-level message, then a 3rd reply to the original thread — confirmed the unrelated message correctly sorted above the parent, and the 3rd reply landed inside the toggle without moving it, exactly the target behavior. Cleaned up all test blocks afterward.
  - **Full page migration, since Tej asked to clean up the existing page to match, not just fix it going forward.** Scanned the entire page (327 blocks, all pagination) for divider-bounded groups matching `[date-para "from X", callout, (date-para "↳ reply from Y", callout)*]`; found 14 threads with inline replies spanning the whole history, from the original 2026-06-21 hand-written entries through today. Wrote a one-off migration script (not committed — same throwaway-`.ts`-via-service-account pattern as the sheet cleanup entries elsewhere in this log) that, per thread: builds a toggle with the captured replies as children (reusing the exact original `rich_text` content, sanitized — raw fetched mentions carry extra resolved fields like a user's name/avatar/email that the write API rejects, so mentions get reduced back down to just `{type, id}`; `icon: null` also has to be omitted entirely rather than passed through, another write-vs-read asymmetry), verifies the toggle's children count before touching anything else, then deletes the old inline blocks. Hit two format bugs live before it worked (toggle's nested-children-at-creation field belongs inside `toggle: {}`, not as a sibling `children` key; a `callout.icon: null` from a callout that never had one set is rejected on write, has to be omitted) — both fixed and re-run for just the affected groups once diagnosed, nothing destructive happened before each fix since verification-before-delete caught it.
  - **Found and fixed one genuine historical gap while verifying the migration:** a 5-reply run from 2026-07-14 (~08:00-09:44) had no top-level parent at all — its true Slack parent message was apparently never captured (predates a fix earlier in this same day's log), so all 5 replies had been recorded as consecutive orphaned "↳ reply from" top-level entries with nothing to nest under. Promoted the first of the 5 to stand in as the visible parent (relabeled its paragraph from "↳ reply from Vivian Lago" to "from Vivian Lago"), migrated the remaining 4 into a toggle underneath it — same reasoning as the live code's own "thread predates automation, log as new top-level" fallback, applied retroactively.
  - **Verified clean afterward:** re-scanned the full page — zero remaining inline "↳ reply" paragraphs, 15 toggles total (14 migrated + the 1 promoted-orphan case), 82 top-level entries confirmed strictly non-increasing by their own timestamp (genuinely chronological, newest first, no violations).
  - Updated the page's own "Agent instructions" block (top of page, a code block per Tej's earlier preference) to describe the toggle convention instead of inline nesting, so a future agent reading the page doesn't have to reverse-engineer the format from the migrated history. Also recovered from a mid-session mistake: an over-broad cleanup delete loop briefly took out the instructions title/content block along with the intended test blocks — caught immediately via a fresh block-level fetch (not assumed fixed), restored via the Notion API directly rather than the markdown insert tool (which had already shown itself unreliable for multi-paragraph callout content earlier the same day, silently dropping all but the first paragraph on retry) — full original text recovered from this same conversation's own prior tool output, not reconstructed from memory.
  - `tsc` clean, suite still 164/164 (only `notionThreadLog.ts` changed; no existing tests touched — this feature is still verified live against the real page/API rather than mocked, consistent with how it's been treated since it was first built).

### 2026-07-15 (batch-1 outreach copy: contact-data fixes + the fixes deliberately NOT made)

Context: starting the outreach-copy workstream for Viv's highlighted batch 1 (32 yellow-highlighted rows in `master-prospects`, down from 33 after Tej pulled Scotiabank Roynat Capital mid-session). Andrew's 4 templates (Email A/B, LinkedIn A/B — in the "Thread with Andrew" Notion page, 2026-07-09 10:42/10:48) carry 5 placeholders: `[First name]`, `[Company]`, `[specific initiative/campaign]`, `[goal]`, `[two time options]`.

- **Two genuine data bugs found and fixed (7 cells, rows 82 + 258), both verified live post-write:**
  - **PwC (row 258): `Secondary Contact LinkedIn` (AZ) and `Secondary Contact Email` (BA) held each other's values** — `meaghan.turpin@pwc.com` was in the LinkedIn column, `https://www.linkedin.com/in/turpinmeaghan/` in the Email column. Introduced by Tej's own same-session fix moving Meaghan off the Scotiabank row (where her `@pwc.com` address had been attached to a Scotiabank contact — the original bug that prompted the move). Straight swap, nothing invented.
  - **City of Vancouver (row 82): contact name shifted one column** — `Primary Contact Name` held a `[TN note: ...]` while `Title` held `"Celeste Dempster | Director, Intergovernmental Relations & Strategic Partnerships"` (name and title merged in one cell). De-merged into AT/AU. Separately, `Secondary Contact Email` (BA) held **prose containing two addresses plus routing reasoning**, not an address: lifted `pbbusinessservices@vancouver.ca | ced@vancouver.ca` into `Generic Intake Email/Form` (BB) — where the TN note said they'd been put, but weren't — and **appended the full original prose verbatim into Notes rather than dropping it** (CLAUDE.md: never silently overwrite existing evidence in a cell). Both the TN note and the prose survive in Notes; nothing lost.
- **A dry-run caught two bugs in the fix script itself before anything was written — worth recording, since both would have destroyed data:**
  - `appendNote` re-read the Notes cell from the *original* fetched array on every call, so a row needing multiple appends (row 82 needed three) would have had each append computed from the same stale base and silently clobber the previous one — only the last would survive. Fixed by accumulating pending writes in a `Map` keyed `row|col` and reading through it (`cur()`), so repeated edits to one cell compose.
  - The targeted row-82 fix set `Primary Contact Name` → `"Celeste Dempster"`, and then a *generic* loop matched the same cell's original `[TN note...]` value and queued a second op setting it to `""`. Two conflicting writes to one cell; the clear would have won and deleted the recovered name.
- **Deliberately NOT fixed — the generic loop was scrapped entirely (~56 of the dry run's 63 proposed cell changes):** it wanted to move every `[AD note: ...]` / `[TN note: ...]` string out of `Primary Contact Name` into Notes across ~20 rows *outside batch 1* (Bennett Jones, Blakes, Lawson Lundell, McCarthy Tétrault, Navio Law, Norton Rose Fulbright, Richards Buell Sutton, UBC, U of A, U of C, U of T, McKinsey, Andersen in Canada, BCAN, Black Innovation Zone, Donnelly, ATCO, KPMG, Province of BC, A100...). **Those notes are Andrew's and Tej's working instructions, parked in the contact column on purpose** — an empty contact cell reading "[AD note: look for their business development or marketing person, in Vancouver]" is a visible worklist marker. Burying them in Notes (col BN, far off-screen right) would destroy that affordance purely to satisfy a mail-merge that doesn't exist yet. **Correct fix is defensive formulas, not data mutation:** the planned `Outreach Route` / `Ready?` columns treat a value starting with `[` as "no name" and an Email cell without `@` as "no email". Non-destructive; markers stay where their authors put them. (Also out of scope: `Anthropic` row 22 has the literal string `"Anthropic"` in its Email cell — flagged, untouched.)
- **Live-restructure discipline (per the three entries above this one):** every column position resolved from a fresh header read, never a hardcoded letter. Row numbers *were* hardcoded (82/258), which is a residual risk given Tej has re-sorted row order before — mitigated by guarding each write behind a content pattern check (`li.includes("@") && em.includes("linkedin.com")`; `Title.includes(" | ")`) that prints "skipping" and writes nothing if the row no longer matches, rather than blindly writing to a moved row. Future scripts should key by Organization Name.
- **Batch-1 routing as it actually stands** (computed across *all* contact columns, not just `Email` — an earlier pass that read only `Email` undercounted reachability by missing `Generic Intake Email/Form`): 8 personal email · 7 generic inbox · 12 LinkedIn-only · 5 blocked (Coast Capital Venture Connection, KPMG, Province of BC, The Forum, Vancouver Economic Commission). **15 email-reachable against Andrew's ask of 20.**
- **Blocking on human action, not code:** the Google **Docs** API is now enabled on project `279666056961` but the **Drive** API is not — `documents.create` writes through Drive, so it fails `The caller does not have permission`. Doc-generation delivery (Tej's pick over Notion) can't run until Drive is enabled too.
- Throwaway scripts run via `npx tsx` and deleted, per CLAUDE.md's live-sheet pattern; nothing committed.

### 2026-07-15 (batch-1 outreach copy: tracker columns, doc pipeline, reusable playbook)

Continuation of the batch-1 outreach entry above. Built the repeatable pipeline that turns a highlighted prospect into a personalized draft in a Tej-owned Google Doc, and captured it as a runbook so future sessions can act on just "company names + a person."

- **Verified all 32 highlighted rows via Firecrawl before writing any copy — Why Them is not trustworthy as personalization.** Two-arm search per org (own-domain-scoped for their own words + open-web-minus-VSW/socials for a recent named initiative), REST v2 direct. **Two method bugs found and fixed mid-pass:** (1) Firecrawl 400s ("Invalid request body") if `includeDomains` and `excludeDomains` are sent together — the domain-scoped arm was failing on every call, silently, because the error was collapsed into an empty result list; now sends exactly one and prints API errors loudly. (2) The namesake trap the sheet's own Why Them had warned about is real and recurring: unscoped "City of Vancouver" → `cityofvancouver.us` (Washington), global firms' own domains → `en_us` not `en_ca`, and KPMG's Why-Them "Startup Innovation Lab" is in **Cyprus**. Every clause is now written from a named source and verified Canada-relevant; the source URL is stored alongside it.
- **Added 6 columns to `master-prospects`** (appended after `Outreach Tier`; grid had to be widened first — it was exactly 67 cols wide, so writing to BP failed "exceeds grid limits" until an `appendDimension` COLUMNS request ran). By header name (letters will drift): `Their Initiative (→[initiative])`, `Their Goal (→[goal])`, `Personalization Source`, `Outreach Route`, `Ready?`, `Named Contact?`. The last three are **formulas**, filled for all data rows 3–394.
  - **`Outreach Route` classifies by inspecting the address itself, not which column holds it** — a first pass keyed off the column and mislabeled 5 shared inboxes (`info@thea100.org`, `hello@graphitevc.com`, `sponsorship@boardoftrade.com`, two `info@`) as "personal." Rewrote to `REGEXMATCH` the local-part against a shared-inbox prefix list. Final batch-1 tally: 7 personal · 1 personal (secondary) · 7 shared inbox · 12 LinkedIn · 5 blocked (Coast Capital VC, KPMG, Province of BC, The Forum, Vancouver Economic Commission). Both email-detecting branches ignore `[`-prefixed worklist notes (`LEFT(cell,1)<>"["`).
  - **`Ready?`** = Route not Blocked AND both clauses filled → the delivery doc renders only `Ready?=TRUE` rows, so filling a row's clauses is the single action that makes it appear. Confirmed live: writing the 3 sample clauses flipped exactly those 3 to TRUE with zero formula errors across the sheet.
- **Delivery doc pipeline proven end-to-end.** The service account **cannot own a Google-native file** (Drive storage quota literally 0 — this is why `documents.create` failed through three different error messages as APIs got enabled; it's structural, not config). Resolved by Tej creating the doc (`1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk`, "Future Planning - Outreach Drafts", owned by `tej.nathoo@vanstartupweek.ca`) and sharing it Editor to the SA — verified with a read+write+cleanup probe. Renderer reads the sheet, composes from Andrew's verbatim templates + the clauses, deletes the doc body and re-inserts in one pass styling by computed offsets; read back afterward to confirm.
- **3-sample render (National Bank / Email A / chair@, GVBOT / Email B / community@, AWS / LinkedIn A) surfaced two more issues, both left for Tej:** AWS row's contact name (Tara Wallace) doesn't match its LinkedIn URL (Olga Kuzina) — flagged, not guessed, same class as the Scotiabank/PwC address bug; and Andrew's `[Company]'s work on [initiative]` stutters when the initiative carries the org name ("AWS's work on AWS Activate") — fix is "your work on …" for those, to apply in the full render.
- **Locked messaging decisions (Tej) recorded in the playbook, not re-litigated:** attendee figure `86 events / more than 5,000 people` (still flagged to Andrew — third value after 3,000/10,000); "expanded VSW" kept verbatim but flagged as unapproved; senders `chair@`+`community@` both Viv, A/B = 2 templates × 2 inboxes; LinkedIn = ≤300-char connection note (no Premium/InMail); personal email > shared inbox > LinkedIn; concrete next-week times, flagged for Viv's calendar.
- **Wrote the reusable runbook: [docs/outreach-copy-playbook.md](docs/outreach-copy-playbook.md), pointer added at the top of CLAUDE.md.** Covers the trigger ("company names + person → act"), the fixed artifacts (sheet/doc IDs, the SA-can't-own-Docs constraint), the Firecrawl method + both gotchas, the columns this workflow owns, the locked decisions, and the data-hygiene flag-don't-guess checks. Purpose: next session springs into action from just the list.
- Throwaway `.ts` scripts run via `npx tsx` and deleted; the two committed project files (`smoke-test.ts`, `spine-check.ts`) left untouched. Only doc/formula/clause writes to the live sheet + doc; all logged here.

### 2026-07-15 (batch-1 outreach: full 29-draft render + contact sourcing)

Completed the batch — all reachable highlighted rows now have verified clauses in the tracker and composed drafts in the delivery doc.

- **Scope: 29 of 32 highlighted.** Skipped 3: Province of BC (Tej — too broad), Vancouver Economic Commission + Coast Capital Venture Connection (both `Archived` in col A; Tej's VEC rule applied to Coast Capital by the same logic, flagged not silently dropped).
- **Contact sourcing (Firecrawl), 3 rows unblocked/corrected:**
  - **AWS** — the row's `LinkedIn URL` had pointed at *Olga Kuzina* while the name said *Tara Wallace* (the name↔profile mismatch flagged earlier; the Olga URL had since been cleared, leaving the row Blocked). Set Tara's verified profile (`ca.linkedin.com/in/wallacetara` — she posts about AWS startup events in Vancouver). Route → LinkedIn.
  - **KPMG** — was Blocked (contact cell held a `[TN note]`). Sourced **Chelsea Philip, Marketing Director KPMG Canada (Vancouver)** as the best partnership door (Kallner = Vice Chair, too senior; Ankie Wong = coordinator, too junior); no public email → LinkedIn route. Preserved the original TN note in Notes. Used **The Entrepreneurs** (KPMG Canada, features Vancouver's STEMCELL/Helijet) as the hook — explicitly *not* the Why-Them "Startup Innovation Lab", which Tej flagged is in Cyprus.
  - **The Forum** — warm lead via Andrew, contact "Lisa N", no cold address. Added a **warm-lead fallback branch to the `Outreach Route` formula** (`… ,AND(Warm Lead?=TRUE, Warm Lead Person present),"Warm — via "&Warm Lead Person, …`) placed after LinkedIn and before Blocked, so warm-only leads get a route and render. Only The Forum hits it in batch 1 (other warm rows have cold routes that match earlier). Rendered as a draft addressed to Lisa with a ⚠ that Andrew supplies the address/intro.
- **29 clauses written to the tracker** (`Their Initiative`/`Their Goal`/`Personalization Source`), each hand-written from a verified source, no dollar figures. `Ready?` auto-flipped to TRUE for exactly 29. Namesake/accuracy corrections baked in: Kensington sourced from the Canadian `kcpl.ca` not the US-automotive `kensingtoncapital.com`; PwC used verified "Value in Motion" not the unverifiable "PwC Raise"; EY/Google Cloud/Sequoia/TELUS etc. got "your work on X" phrasing where the initiative already carries the org name (stutter guard).
- **Two render bugs caught by reading the output back, both fixed before finishing:**
  - **11 LinkedIn notes rendered over the 300-char cap** because the full initiative/goal clauses don't fit a connection request. Added tuned short hooks per LinkedIn org; re-rendered; then one straggler (Vancity, 308) shortened via a surgical `replaceAllText`. All 13 now ≤300 (243–296), verified by re-reading every "Connection note (n/300)" line.
  - **`Email — personal (secondary)` opener addressed the wrong person** — PwC's draft greeted "Alaina," (primary) while the address was Meaghan's (secondary). Fixed the renderer to derive the recipient name from the secondary-contact field for that route. Verified live: PwC now opens "Meaghan," to `meaghan.turpin@pwc.com`.
- **Flagged in the doc's front matter for Andrew, not silently shipped:** the attendee figure (now 5,000, its third value); "expanded VSW" as still-unapproved language; and that **Voyager Capital + Google Cloud are past VSW sponsors** — cold "we've been following you" copy reads wrong to a prior sponsor, so both carry a per-draft note to use a re-engagement opener. Voyager also carries Viv's note that Meredith Powell moved to Strategic Advisor (personal Gmail on file).
- Delivery doc `1Op9-…8QTk` now holds 29 composed drafts (488 paragraphs) rendered entirely from the tracker's Ready rows. Playbook (`docs/outreach-copy-playbook.md`) is the reusable runbook; updated with the warm-route branch + the LinkedIn-hook and recipient-name lessons. Throwaway scripts deleted.

### 2026-07-15 (batch-1 outreach: quality re-do — deep per-site research + grammar fix)

Tej reviewed the first drafts and rejected the copy quality on two counts: (a) a grammatical run-on where a compound `[initiative]` collided with the template's "…and your focus on…" ("…Valhalla Angels, Western Canada's largest angel network, and your corporate finance work **and** your focus on…"), and (b) the personalization read like it came from skimming a landing page ("supporting early-stage entrepreneurs across their whole business lifecycle" — boilerplate). Both valid. Full re-do of all 29, Tej's call.

- **Why the first pass went generic (documented because it's a trap, not just laziness):** searching the open web for a "specific recent" fact is a namesake minefield. "Valhalla" alone surfaces four unrelated investment firms (Mark O'Hare's Valhalla Ventures, an LA Valhalla Ventures, Valhalla Capital…). Grabbing the wrong one puts a confidently-false fact in a cold email — worse than generic. The fix is to scrape the org's OWN domain (namesakes can't leak in) and JSON-extract a signatureProgram / localHighlight / recentMilestone / distinctiveLine.
- **Deep-scraped all 29 own-sites** (Firecrawl `/v2/scrape` with a JSON-extraction prompt, namesake-corrected domains — e.g. Kensington via `kcpl.ca` not the US-automotive `kensingtoncapital.com`). Yielded genuinely specific, verifiable hooks: A100→AccelerateAB, City of Vancouver→Trulioo (on their Innovation Economy Map), Graphite→ENVGO (portfolio), EY→"130+ finalists" (Jun 2026), Sequoia→AI Ascent, Top Down→Founders Fund I (closed Apr 2026), Version One→Fund V (Jun 2026), Yaletown→Innovation Growth Fund III, Google→Google for Startups Cloud Program.
- **Two more namesake/accuracy traps the deep scrape caught and I steered around:** (1) `rhinoventures.com` resolved to an unrelated *healthcare-leadership* org ("Healthcare Leadership Academy") — NOT the Western Canada VC; Rhino's clause kept modest + flagged NEEDS-VERIFY. (2) The extractor claimed Version One's portfolio co "Ada" is "Vancouver, BC" — Ada is Toronto; dropped the locality claim. Reinforces: never trust an extractor's "based in X" — only assert locality independently verified (Trulioo ✓, ENVGO ✓).
- **Grammar rule enforced in code:** `[initiative]` must be one noun phrase with **no internal "and"** (that's what caused the run-on; a single "and" as a noun-list inside `[goal]` like "growth and innovation" is fine). A self-check builds the full sentence and rejects any init containing " and " / "focus on" / a double-"your". Standardized rendering to **"your work on X"** (dropping Andrew's "[Company]'s work on X" possessive), which also eliminates the awkward "Graphite Ventures's" and the org-name stutter in one move.
- **Full re-render** (Tej approved overwriting his in-progress manual edits to PwC/National Bank — they come back as correct full drafts). Verified live after: 29 drafts, 16 email + 13 LinkedIn, **0 body run-ons** (checked for the `…and your … and your focus` pattern), **0 LinkedIn notes over 300** (Vancity's straggler shortened via surgical `replaceAllText`, twice now — the LI-hook goal for Vancity should be stored short to stop it recurring), openers matched to actual recipients (PwC→Meaghan), past-VSW-sponsor + Rhino-namesake + Northleaf-weak-fit flags carried per-draft.
- Playbook (`docs/outreach-copy-playbook.md`) updated with the clause-construction rules (noun-phrase initiative, no internal "and", scrape-own-site-not-open-web, don't trust extractor locality, "your work on" phrasing). Deep-scrape material cached in scratchpad (not committed). Throwaway scripts deleted.

### 2026-07-15 (playbook hardened so the quality defects can't recur)

Tej asked to bake this run's lessons into the project instructions so a future run auto-avoids the weird clauses/grammar and researches as deeply. Changes to `docs/outreach-copy-playbook.md` + the CLAUDE.md pointer:
- **Research section rewritten: deep own-site JSON-scrape is now the REQUIRED method, not "two-arm search."** The old text led with `/v2/search` (summaries) — exactly the shallow pass that produced the landing-page-generic copy Tej rejected. Now: `/v2/scrape` each org's own domain with the signatureProgram/localHighlight/recentMilestone/distinctiveLine JSON prompt; `/v2/search` is demoted to "finding a domain/contact only, never a personalization fact." Namesake rules made explicit (own-domain-only; hand-fix known-wrong domains like Kensington→kcpl.ca; never trust the extractor's locality claim — the Ada-is-Toronto and rhinoventures.com-is-a-healthcare-org traps are written in).
- **Clause section turned into hard invariants + a runnable gate.** Standardized rendering to "your work on X" (kills the possessive + stutter). Invariant #1: `[initiative]` has no internal " and " (the run-on cause). Added the actual gate code (reject init containing " and "/"focus on"/double-your, build+print the full sentence) to run before writing.
- **Added a "Definition of done" checklist** (read the doc back; assert draft count, zero body run-ons, all LinkedIn ≤300, every email has a Subject, opener matches recipient, all flags present) — because every worst bug this workflow hit was invisible until a read-back.
- **CLAUDE.md pointer upgraded from "follow it" to "mandatory, not reference,"** naming the three teeth (deep-scrape / grammar gate / read-back DoD) so a future agent can't treat it as optional.
No sheet/doc data changed in this step — docs only.

### 2026-07-15 (merge duplicate: "Amazon Web Services" → "AWS")

Tej flagged two rows for the same company. Merged per golden rule #3 (fold, never drop).
- **Kept row 34 "AWS"** (highlighted batch-1, Tier 1, has the better contact Tara Wallace — "Early Startups Western Canada" — plus the outreach clause + doc draft). **Deleted row 18 "Amazon Web Services"** (Tier 3, not highlighted) after folding its content in.
- Folded: **Source Type** "Ecosystem player" (not a valid enum value — golden rule #6/#15) → **"Comparable event sponsor"** (row 18's value, valid + accurate); **Source Link** union of all 5 (deduped); **Why Them** both rows' text combined with a merge marker; **event checkboxes** unioned (Launch Academy + BC Naturally AI Brochure) and **Web Summit Vancouver + CANSEC added** (row 18's source links are AWS-specific Web Summit-appearance + CANSEC pages — direct evidence; AWS was also in the CANSEC-37 backfill). Row 18's contact **Haig Ehramdjian** (AWS Canada Partnerships/GTM) preserved in Notes as a third option; Tara primary, Heather Knowles secondary unchanged.
- Verified live: exactly 1 AWS/Amazon row remains, Route=LinkedIn, Ready=TRUE, Tier 1, Source Type valid. Deletion of row 18 shifted the per-row formulas fine (Route/Ready intact).
- **Doc side-effect (cosmetic):** the delete shifted every tracker row below 18 up by one, so the "Tracker row N" labels in the delivery doc are now off-by-one for those drafts (AWS 34→33, etc.). The draft *content* is unchanged and correct; labels self-correct on the next full render. Not fixed now to avoid clobbering Tej's live doc edits.
- Throwaway merge script deleted; delete used `deleteDimension` on gid 689473104.

### 2026-07-17 (Tier 2 shortlist: scoring method + `Outreach Tier` write)

Context: Tier 1 (Vivian's 32-org highlighted batch) done — drafts sent to Andrew/Vivian for review. Tej asked for the next 50 orgs (Tier 2), with an explainable scoring method built from the tracker's own data, excluding Tier 1/duplicates/weak rows, balanced across category and not dominated by any one signal.

- **Confirmed `master-prospects`' `Outreach Tier` column (now at BO, header row re-read fresh — Tej had reshuffled again since the last log entry; col A is now `Status`, `Organization Name` at B) is the live, authoritative record of Tier 1**: exactly 32 rows marked `"Tier 1"`, matching the 32 highlighted (29 drafted + the 3 deliberately parked: Province of BC, Vancouver Economic Commission, Coast Capital Venture Connection — the latter two also `Status=Archived`). Used this column directly as the Tier 1 exclusion set rather than re-deriving from row-color highlighting.
- **Excluded 2 zero-evidence rows** (Apple Pay, Vanguard — blank Why Them, blank Source Type, no warm lead, no event checkbox true on any axis). **Checked the remaining 357 rows for duplicates via the same `orgKey` normalizer `dedup.ts` uses** (strip legal suffixes, sort tokens) — zero duplicate groups found.
- **Scored the remaining pool with a deterministic, explainable point formula** (no LLM judgment call, fully reproducible), built only from existing tracker columns: warm pathway (Warm Lead?/Warm Lead Person/Warm Lead Path, up to 20 — see cap below), comparable-event/sponsorship evidence (Source Type + up to 3 named-event checkboxes, up to 46), Why Them length/specificity + $ figure/sponsorship-tier language (up to 30), Vancouver/BC signal from HQ or Why Them text (up to 15), budget/decision-maker fit from sponsorship-language keywords + a dept-relevant title (up to 24), contactability (named contact/email/LinkedIn, penalized −12 if no route at all, up to 28), and a light category-fit bonus (up to 5).
- **First pass over-indexed on warm leads** (46/50 top-scored rows were Warm Lead?=TRUE, against only 58 warm rows in the whole 357-row pool) — read as relying on one signal despite Tej's "without relying entirely on one" instruction. Rebalanced: cut the warm-pathway weight from +35/+20/+10 to +20/+12/+6, and added an explicit **cap: max 25/50 slots can be Warm Lead?=TRUE** (same mechanism as the category cap, max 20/50 per category). Final list: 27/50 warm or warm-via, 23/50 cold-but-strong-evidence; category mix Tech 16, Accelerator 7, Crown corp 4, Gov 4, Law firm 3, University 3, VC 3, Bank 2, Consumer brand 2, Media 2, Real estate 1, BIA 1, Defense & aerospace 1 (Tech under the 20 cap on its own merit, no forced trim needed).
- **Delivered as a published Artifact** (ranked-50 table with per-org strongest signal / recommended dept / contact status / warm-cold-uncertain relationship / concern flag, a reserve-10 list, and a callout naming rows needing Andrew/Vivian's judgment: Musqueam Indian Band — First Nation government body, protocol-based relationship not a cold email; Global Affairs Canada + PacifiCan — federal bodies, may be a grant conversation not a sponsorship ask; 14 large multinationals with real evidence but no confirmed local BC owner, e.g. Amazon/SAP/Dell/Airbus/AMD/Accenture) rather than pasted into chat, given the volume (50+10 rows × 8 fields).
- **Tej approved the 50 as-is.** Wrote `"Tier 2"` to the `Outreach Tier` column for all 50, **keyed by Organization Name against a fresh live re-read** (never the row numbers captured during the scoring pass, and never a hardcoded column letter) — per-name lookup, ambiguous/not-found/already-Tier-1 guards before any write. One row (Northeastern University) had already been independently set to `"Tier 2"` live between the scoring pass and the write (idempotent no-op, left untouched, not overwritten). Batch-wrote the other 49 cells (`values.batchUpdate`, `USER_ENTERED`), then **read every written cell back and confirmed all 49 verified as `"Tier 2"`**. No other column touched; no tier labels changed on any row outside the approved 50.
- Throwaway `.ts` scripts (`check_header.ts`, `check_status_values.ts`, `tier2_score.ts`, `write_tier2.ts`) run via `npx tsx` and deleted; intermediate JSON/report scratch files kept only in the session scratchpad, not committed.

### 2026-07-17 (Dell + SAP contact research; Dell contacts written — one email-format lesson)

Follow-on to the Tier 2 write above: Tej asked who's actually the right contact for two of the 4 no-route Tier 2 rows.

- **SAP**: the only lead the row itself surfaced (a LinkedIn URL Tej had) turned out to be **Nemo Lövgren, a Sales Development Executive at SAP based in France** (confirmed via a RocketReach scrape — SDR since 2025, prior roles all French sales/hospitality titles, no partnerships/marketing history) — not a fit, flagged and not written anywhere. Re-researched from the row's own Why Them (SAP already partners with BC Tech's Technology Impact Awards/Association and sponsors CANSEC, runs "SAP for Startups") and found two current, Vancouver-based, senior SAP marketing people — **Kevin Liu** (Global Director of Marketing, Content Strategy & Planning, Vancouver, since Jan 2025) and **Katryn Cheng** (VP Product Marketing, profile language explicitly mentions "strategic partnerships" and "business accelerators"). Presented as candidates only — **nothing written to the sheet for SAP**, Tej hasn't picked one yet.
- **Dell**: same pattern — the row's Why Them names "Dell for Startups." Found the actual person who ran the Canada version of that program, **YJ Lin** (Toronto, Feb 2024–Aug 2025) — but confirmed via his current LinkedIn headline ("Community Experience Design... MBA Candidate @ CMU Tepper," no Dell mention) that **he's left Dell**; no successor found. Landed on two current, real alternates instead: **Olivia Miles** (Enterprise Account Director, Dell Technologies Canada — and separately Women in Tech BC Chapter Head of Partnerships, the one genuine local BC tie found) and **Juan Pablo Ortiz** (Senior Marketing Manager, Global Industries, Dell, Toronto, 12+ years tenured).
- **Wrote both to the Dell row (row 98)** — Tej explicitly asked for this pair to be added, with an email if findable, else a best-guess by format. Primary = Olivia Miles (Title/Email/LinkedIn), Secondary = Juan Pablo Ortiz (Title/LinkedIn/Email). Guarded the write behind a check that all 8 target contact cells were still blank before touching anything (they were) — same discipline as every other live write this session.
- **Neither email is verified — both are pattern-based guesses, clearly labeled as such in the cells themselves (`[UNVERIFIED — pattern guess]` suffix) and explained in a new Notes entry.** Determined Dell's real email format from one genuine, unmasked, officially-published example found on `infohub.delltechnologies.com` (an "Author: Vincent Shen (Vincent.shen@dell.com)" byline) — `firstname.lastname@dell.com` — corroborated (not contradicted) by ZoomInfo's masked `[first-initial]***@dell.com` pattern across several unrelated Dell employees (Juan Ortiz, Glen Robson, Edgar Bucaro, Sivaji Nunna all matched the shape). Applied verbatim: `olivia.miles@dell.com`, and for Juan Pablo Ortiz used his primary given name only (`juan.ortiz@dell.com`, not `juanpablo.ortiz@dell.com`) per common enterprise convention — flagged as the one point of real uncertainty in an otherwise well-evidenced pattern.
- Verified live: all 9 written cells (Primary Contact Name/Title/Email/LinkedIn, Secondary Contact Name/Title/LinkedIn/Email, Notes) read back exactly as written. No other row or column touched.
- Throwaway `.ts` scripts (`check_dell_row.ts`, `write_dell_contacts.ts`) run via `npx tsx` and deleted.

---

### 2026-07-20 — Organizational-goals enrichment model: schema, lifecycle Status, and tooling

Implements [docs/org-goals-enrichment-model.md](docs/org-goals-enrichment-model.md), written and
revised with Tej this session. Answers Andrew's 2026-07-09 11:00 ask ("use some A.I. to prepare
those goals and add them to the spreadsheet, in a way that can be easily added to the messaging").

**Design decisions (Tej, this session, overriding the first draft):**
- **No confidence/verification column.** Accuracy is the baseline, not a tracked state. Rows that
  fall short are flagged in a **run report** that is recomputed from the data every run and never
  stored — so a flag cannot be missed once and lost. Tej fixes flagged rows by hand.
- **No personalization-date column.** Accepted consequence: the sheet cannot answer "how old is
  this research," so freshness degrades to a per-run check on clauses containing dates. Fine at
  Tier 1–2 speed; revisit if drafts start sitting for months.
- **`VSW Alignment` added** as the anti-hallucination field — stored, human-approved framing so a
  drafting agent doesn't invent its own reason-for-reaching-out. Never quoted into a message; it
  sets theme and tone, and every entry ends with an explicit tone directive.
- **No separate alignment column in the message** — Andrew's templates already carry a fixed
  alignment sentence, so a column feeding no template slot would be write-only data.
- **Draft body text is NOT stored** — only `Draft Link` + `Draft Variant`. Stored copy goes stale
  the moment a clause is corrected and breaks the property that fixing one clause fixes every draft.
- **One `Status` lifecycle, 16 values**, replacing two half-used columns.

**Sheet writes (all verified by read-back):**
1. **Deleted `Stage` (was col BC).** It held one value across 393 rows, and that value
   (`"Emailed July 15 to be scheduled out next week post-Fifa"`) was a note, not a stage —
   preserved verbatim into DVBIA/Downtown Van's `Notes` with a `[moved from Stage column,
   2026-07-20]` provenance marker before deleting. Confirmed first that **no other tab references
   `master-prospects`** (checked all 5 tabs for cross-sheet formulas: 0 references), so the column
   shift was safe.
2. **Added 4 columns:** `VSW Alignment` (BR) and `LI Short Hook` (BS) inserted after
   `Personalization Source`; `Draft Link` (BW) and `Draft Variant` (BX) appended after
   `Named Contact?`. Grid had to be extended 74→76 columns first (`appendDimension`) — the sheet
   was exactly as wide as its last column and the first write 400'd on grid limits.
3. **`Status` (col A) dropdown applied** to A3:A500, 16 values, `strict` + input message. Per
   golden rule #15 the strict rule does *not* block API writes, so `scripts/tracker.ts`
   validates in code before any status write.
4. **Repaired 3 broken formula rows** (`Outreach Route`/`Ready?`/`Named Contact?` blank or `#REF!`):
   AngelList, Osler, Planet Food. All three now resolve `Email — personal`; **zero broken/blank
   routes remain across all 393 rows.**
5. **Backfilled `VSW Alignment` on all 29 enriched rows** and `LI Short Hook` on the 12
   LinkedIn-routed ones. Grammar gate run in code over all 29 before any write.
6. **Corrected the Rhino Ventures row.** Its clauses had been researched against
   **`rhinoventures.com` — an unrelated healthcare-leadership org**. Tej supplied the real domain,
   `rhinovc.com`. The old clauses (`your early-stage Western Canada funds` / `backing founders
   building in Western Canada`) were not merely unsourced but *wrong* — generic-VC framing that
   misses the firm's actual thesis. Deep-scraped per the playbook and replaced with
   `your Producer Businesses thesis` / `being a long-term partner rather than an exit manufacturer`
   (their own capitalized term and their own stated differentiator). **Previous values preserved
   verbatim in `Notes`** rather than discarded.
   - Surfaced but **not written**: **Candace Hobin**, Operations — runs "portfolio-wide initiatives
     including founder events, resources, and partnerships," i.e. exactly the sponsorship contact
     for a row that has no named contact. Left for Tej to confirm; recorded in `Notes`.
   - Also noted: **Aspect Biosystems is in Rhino's portfolio and is itself a Tier 2 target.**
7. **Populated `Status` on all 393 rows** via `scripts/advance-status.ts --write`:
   254 `Sourced` · 9 `Contact identified` · 98 `Route identified` · 29 `Enriched` · 3 `Archived`
   (the 3 pre-existing Archived rows were held, not overwritten).

**Process failure worth recording:** the first repair pass wrote to rows **135/244/371** by number,
taken from a read minutes earlier. Tej re-sorted the sheet in between, so those row numbers had
become Float / Northleaf / VanHack. No damage (formula-equivalents written into formula columns),
but it is a live demonstration of the playbook's "key rows by Organization Name, never a row
number" rule, which this pass had violated. Re-done keyed by name; that habit is now encoded in
`scripts/tracker.ts` so it can't recur.

**New durable tooling (committed, not throwaway):**
- `scripts/tracker.ts` — shared helpers. Resolves columns by header name and rows by org name;
  owns the `STATUS_VALUES` enum and `assertValidStatus`.
- `scripts/run-report.ts` — the 11 accuracy checks (§2). `npx tsx scripts/run-report.ts "Tier 2"`.
- `scripts/advance-status.ts` — derives Status values 1–5 from `Named Contact?` / `Outreach Route` /
  `Ready?` / `Draft Link`. **Forward-only, and never touches a row at index 6+**, so human
  decisions downstream are never overwritten by a re-run. Dry-run by default; `--write` to apply.

**Run report tuned against real data** — the first pass produced 19 flags on Tier 1 of which 11
were false positives: the domain check couldn't handle acronym orgs (`aws.amazon.com` for "AWS",
`td.com` for "TD"), `"market"` matched as the month `Mar`, and locality flags fired on orgs whose
own name contains the locality (City of Vancouver). Fixed with an acronym/initialism branch, a
hand-confirmed-domain allowlist (Kensington = `kcpl.ca`, per the playbook), whole-word month
matching, and a self-reference skip. **Tier 1 now: 8 flags across 7 rows, 25 clean** — all 8 genuine,
including a real finding that **Yaletown Partners' only source is `bctechnology.com`**, third-party
coverage rather than their own domain.

**Current state:** Tier 1 is 29/32 enriched (Province of BC blocked on the broad-org split; Coast
Capital and Vancouver Economic Commission already `Archived`). **Tier 2 is 52/53 unenriched** — the
research batch (doc Step 4) is the next body of work and has not been started.

### 2026-07-20 (later) — `overview-stats` pipeline metrics tab + sticky milestone flags

Tej's spec, refined over two rounds. Full design in
[docs/org-goals-enrichment-model.md](docs/org-goals-enrichment-model.md) §9.

**Model resolved with Tej:** 5 macro stages are the forward path (Sourcing 1-4 · Writing 5-6 ·
Initial outreach 7-9 · In conversation 10-11 · Initial meeting 12); the 4 terminal outcomes
(Won/Declined/Ghosted/Archived, 13-16) are exits from that path rather than stages on it. Bounced
sits in Initial outreach, not In conversation. Phases (Sent & waiting, Response received,
Conversation active) are overlapping cuts and live in their own table so they cannot corrupt the
partition.

**Sheet writes:**
1. **4 sticky checkbox columns** added to `master-prospects` (BY–CB): `Sent?`, `Bounced?`,
   `Replied?`, `Meeting Booked?`. Grid extended 76→80. Seeded `FALSE` on rows 3-395, BOOLEAN
   validation applied. These exist because `Status` is a current state and loses history — a row
   that books a meeting then wins sits at `Won` and the meeting vanishes from the count.
   Tej's own idea; extended from 1 column to 4 because block ②'s deliverability maths needs
   `Sent?`/`Bounced?`/`Replied?` as well.
2. **`overview-stats` tab built** — 46 rows, 4 blocks, all live formulas. Verified reconciling:
   Tier 1 = 32 · Tier 2 = 53 · Tier 5 = 3 · Untiered = 305 · **TOTAL = 393**.

**New tooling:**
- `scripts/build-overview-stats.ts` — regenerates the tab's layout.
- `scripts/apps-script-sticky-milestones.gs` — installable onEdit trigger that ticks the sticky
  flags on Status change, plus `backfillFlags()`. **Requires Tej to paste it into Extensions →
  Apps Script**; a service account cannot install Apps Script. Resolves columns by header name.
  Deliberately does NOT infer `Meeting Booked?` from `Won` — that would invent meetings.

**Bug caught by read-back, worth remembering:** the first build used
`SUM(COUNTIFS(status,{"a";"b"},tier,x))`. Sheets does **not** broadcast an array criterion across
a multi-criteria COUNTIFS — it silently returned only the count for `"a"`, undercounting the grid
by 136 rows (TOTAL read 257 instead of 393) while looking entirely plausible. Fixed by emitting
one explicit COUNTIFS per status joined with `+`. The standing reconciliation check is that
block ① TOTAL equals the org count.

### 2026-07-20 (later still) — `overview-stats` rebuilt: vertical stage/phase view + cohort outcomes

Tej liked the first version but wanted the phases legible *within* the stages they belong to, laid
out vertically, plus outcome attribution: "of the deals that reached an initial meeting, how many
did we win / fall back to conversation / terminate?"

**Key insight:** that question is unanswerable from `Status` alone (a meeting that later declined
reads only as `Declined`) — but the **sticky checkboxes already encode furthest-stage-reached**:
`Sent?` = reached Initial outreach, `Replied?` = reached In conversation, `Meeting Booked?` =
reached Initial meeting. Crossing each cohort against current status gives full attribution. The
4 flag columns added earlier turned out to carry more weight than their original brief.

**Rebuilt into 6 blocks** (was 4): ① vertical PIPELINE (stage rows with indented phase sub-rows,
tiers across) · ② COHORT OUTCOMES · ③ SUMMARY BY TIER (reconciliation) · ④ PHASE CUTS ·
⑤ CUMULATIVE · ⑥ DRILL-DOWN. The old standalone "status detail" grid was dropped — block ①
supersedes it. Each cohort's buckets partition that cohort, so they sum to its total.

**⑥ DRILL-DOWN** answers Tej's "or the deals themselves": two dropdowns (status + tier) and a
spilling `FILTER` lists the matching organizations. Verified live — `Enriched` / `All tiers`
returns the correct 29 names.

**Verified:** block ① TOTAL = 393, tier columns sum to 393 (Tier 1 = 32 · Tier 2 = 53 · Tier 5 = 3 ·
Untiered = 305).

**Second formatting bug caught by read-back:** `spreadsheets.values.clear` wipes values but leaves
cell **formats**. The rebuild's new layout inherited the old layout's percent-formatted column and
rendered Untiered's `305` as `30500.0%`. Fixed by resetting `userEnteredFormat` and data validation
across the sheet before applying new formatting. Both bugs this tab has hit were invisible to
inspection and only caught by reading the computed values back.

### 2026-07-20 (wrap-up) — Yaletown clause corrected, re-engagement template, Rhino contact confirmed

- **Candace Hobin confirmed** as Rhino Ventures' primary contact — Tej added her directly
  (title "Community Manager", from LinkedIn, which beats the site's section label "Operations").
  No write needed from this session.
- **Yaletown Partners clause corrected.** The goal read `driving transformative growth in emerging
  BC technology companies`. Deep-scraped `yaletown.com`: their own objective line is *"drive
  transformative growth in innovative technology companies"* — **"BC" was invented**, exactly the
  fabricated-specificity failure the playbook warns about, and the source was `bctechnology.com`
  (third-party) rather than their own domain. Goal reworded to their own words and source moved to
  `https://www.yaletown.com/`. Previous values preserved verbatim in `Notes`. This cleared both of
  Yaletown's run-report flags at once; **Tier 1 went from 8 flags / 25 clean to 6 flags / 26 clean.**
- **Triaged the remaining locality claims.** A100 (`Western Canada's top tech leaders`), Vancity
  (`underrepresented founders across BC`) and Vanedge (`deep tech in BC`) all source to the
  organization's own domain and all three are genuinely regional bodies, so the claims are theirs,
  not ours. Left as-is. The check stays noisy by design — it is cheaper to confirm three true
  positives than to miss one invented "BC".
- **Re-engagement template written** into
  [docs/outreach-copy-playbook.md](docs/outreach-copy-playbook.md). Changes one paragraph of
  Andrew's Email A/B and reuses the existing `[initiative]`/`[goal]`/`LI Short Hook` columns, so no
  schema change. **Needs Andrew's sign-off — it is new external copy.**
- **Known gap logged:** the tracker records *that* an org sponsored (`VSW` checkbox) but not *when*,
  so `[year]` must be read out of `Why Them` by hand. Acceptable at two rows; wants a
  `VSW Sponsor Year(s)` column if re-engagement volume grows.
- **Data-hygiene flag raised, not acted on:** Voyager Capital's contact Meredith Powell has a
  personal Gmail (`meredithjpowell@gmail.com`) and her Title cell carries an embedded worklist note,
  `"Strategic Advisor (might need to find someone else)"`. Flagged to Tej rather than drafting to it.

### 2026-07-20 (wrap-up cont.) — Drafted rows marked, and linked back to their drafts

Read the **actual delivery doc** (`1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk`) via the Docs API
rather than assuming it matched today's `Ready?=TRUE` set — it was rendered 2026-07-17, before this
session's changes, so the two could easily have diverged.

- Parsed all **28** `HEADING_1` draft sections. Each is `"<Org> — <Template> / <sender>"`, split on
  the **last** `" — "` because org names contain em dashes themselves (`CVCA — Canadian Venture
  Capital & Private Equity Association`). All 28 matched a sheet row by Organization Name; zero
  unmatched.
- Set **`Status` = `Drafted — awaiting approval`** on those 28, and populated **`Draft Variant`**
  (e.g. `Email A · chair@`, `LinkedIn B · Viv's profile`) and **`Draft Link`** — a real Docs deep
  link built from each section's `headingId`, so a row now jumps straight to its own draft.
  **28/28 have a link.** This is the write-back the render script was specced to do; done
  retroactively for the existing doc.
- **The doc's subtitle claims 29 drafts but contains 28.** The absentee is **The Forum**, whose
  route is `Warm — via Andrew` — correctly excluded from cold copy per the playbook, and it
  remains at `Enriched`. The subtitle was counting `Ready?=TRUE` rows rather than rendered sections.
- `advance-status.ts` re-run afterwards: **0 to advance, 390 already correct, 3 held** — confirming
  the forward-only rule holds and nothing regressed the new `Drafted` rows back to `Enriched`.

**Status distribution now:** 254 Sourced · 98 Route identified · 28 Drafted — awaiting approval ·
9 Contact identified · 3 Archived · 1 Enriched (The Forum).

**⚠️ Three of those 28 drafts are known-stale and should not be approved as they stand:**
`Rhino Ventures` (doc holds the wrong-domain copy; corrected clauses are in the sheet but the doc
has not been re-rendered), `Google Cloud` and `Voyager Capital` (cold copy; both are past VSW
sponsors and need the new re-engagement template). Re-rendering the doc from the current sheet
fixes all three at once.

### 2026-07-20 (Tier 2 batch 1) — First 5 Tier 2 rows enriched, one parallel agent per org

Kicked off Step 4 (docs/org-goals-enrichment-model.md §7) with a parallelized run: 5 independent
agents, one per organization, each doing its own deep-scrape research per the playbook's method
(own-domain JSON-extract, never open-web search as the fact source) and returning proposed clauses
without touching the sheet. Results were validated centrally (grammar gate + the §2 flag checks)
before any write — deliberately not letting 5 concurrent agents write to the live sheet at once.

- **Absolute Software** — Initiative: "the Absolute Secure Endpoint 10 release" (their July 2025
  product-release blog post, not the Syxsense-acquisition press release, which centers on wallet-
  sizing and a Seattle dateline). Goal: "simplifying workflows, strengthening compliance, and
  tackling endpoint complexity." Source: `absolute.com/blog/...` + `absolute.com/company/about-
  absolute-security` — the latter independently confirms "global headquarters in Vancouver"
  verbatim, so the tracker's Vancouver-HQ claim is now sourced to their own site, not just the old
  `Why Them` note. Route = Email, no LI hook needed. Clean — zero run-report flags.
- **Accelerate Fund** — flagged in the enrichment-model doc as a namesake risk; the agent verified
  `acceleratefund.ca` is correct (Arden Tse's own team-page bio matches the tracker's named
  contact) before writing anything. **Correction surfaced:** this fund is Alberta-based (Edmonton),
  not BC/Vancouver — the old `Why Them` note had left geography unconfirmed. VSW Alignment text
  explicitly avoids implying local presence. Initiative: "Accelerate Fund IV." Route = Email
  (shared inbox), no LI hook needed. Clean — zero run-report flags.
- **Accenture** — applied the large-org tiebreak (pick the priority closest to founders/startups/
  Vancouver, per the contact being Accenture Vancouver's MD) and found real, on-domain evidence:
  Accenture Ventures has actually invested in two Vancouver startups (SkyHive 2020, Sanctuary AI
  2024) through its named "Project Spotlight" program, sourced to `newsroom.accenture.com` press
  releases, not third-party coverage. Initiative: "your Project Spotlight investment in
  Vancouver-based Sanctuary AI." LI Short Hook (route=LinkedIn): "Project Spotlight backing
  Vancouver's Sanctuary AI" (50/50 chars, variant A — named program). **Two expected run-report
  flags, both resolved, not defects:** (1) LOCALITY CLAIM — trips because "Accenture" the org name
  doesn't itself contain Vancouver/BC, but the Vancouver tie is independently sourced to Accenture's
  own press release, not an extractor guess. (2) DATED CLAIM — trips on "2000" inside "Global 2000
  clients," which is Accenture's own term for the Fortune Global 2000 client list, not a year. Left
  the regex alone rather than loosen it, since narrowing 4-digit-year detection risks missing a
  real stale date elsewhere.
- **Ada CX** — deep-scraped `ada.cx` fresh rather than reusing the illustrative (never-researched)
  placeholder example in docs/org-goals-enrichment-model.md §6. Initiative: "Playbooks" (their
  named SOP-automation product, with its own `playbooks.ada.cx` microsite). Goal: a direct
  paraphrase of CEO Mike Murchison's own quote on `ada.cx/why-ada` about teams owning their AI
  agents rather than outsourcing them. Deliberately did NOT use the $130M Series C / $1.2B
  valuation (dollar figure) or assert any Vancouver/BC tie (Ada is Toronto-based; their own site
  claims only "Made in Canada" nationally). Route = Email, no LI hook needed. Clean — zero
  run-report flags.
- **AI Network of BC (AInBC)** — none of the three candidate domain guesses (`ainbc.ca`,
  `ainbc.org`, `ainetworkbc.ca`) were correct; the real domain is **`ainbc.ai`**, resolved via
  search then confirmed by scraping. Also confirmed a near-identical-sounding but unrelated org
  exists (`bc-ai.ca`, "BC + AI Ecosystem Association," launched Aug 2025) — not used, just worth
  knowing if it surfaces elsewhere. Initiative: "Elevate AI: Road to Web Summit Vancouver" (their
  own named founder-readiness event ahead of Web Summit Vancouver) — the cited page is the 2025
  instance since the 2026 edition doesn't have its own page on their site yet. LI Short Hook (route=
  LinkedIn): "Your Elevate AI: Road to Web Summit work" (40 chars, variant A). Clean — zero
  run-report flags (the LOCALITY CLAIM check is correctly skipped since "BC" is in the org's own
  name, per the check's own exemption rule).

**Write:** all 5 rows updated in `master-prospects` (`Their Initiative`, `Their Goal`,
`VSW Alignment`, `Personalization Source`, plus `LI Short Hook` on Accenture + AInBC) via a
dry-run-then-`--write` throwaway script, keyed by Organization Name, guarded to refuse overwriting
any cell that already had content (none did). 22 cells written. Re-ran `scripts/run-report.ts
"Tier 2"` afterward to confirm: **4 of 5 rows fully clean, Accenture's 2 flags both expected and
already resolved** (see above); the other 47 Tier 2 rows remain correctly flagged as not yet
researched.

**Bug fixed in `scripts/run-report.ts` (and mirrored in the throwaway write script's own gate
check):** the dollar-figure regex `\d+\s?(million|billion|M\b|B\b|K\b)` false-positived on plain
business jargon like "B2B" (digit+letter "2B" matched `\d+\s?B\b`). Fixed by requiring a word
boundary immediately before the digit run (`\b\d+\s?(...)`), which still matches real cases like
"$700M+" or "130M" but no longer matches "B2B". This is a real fix to the shared script, not a
one-off workaround — it would have false-flagged every future row whose goal/initiative mentions
"B2B."

Next: remaining 48 unenriched Tier 2 rows (batch 2+).

### 2026-07-20 (Tier 2 batch 2) — Next 5 Tier 2 rows enriched, same parallel-agent process

Same method as batch 1: 5 independent agents, one per org, each deep-scraping its own domain and
returning proposed clauses; validated centrally against the grammar gate + §2 flags before any
write.

- **Air Canada** — Initiative: "Aeroplan's partnership with DINR" (a named, dated partnership with
  a female-founder-led dining startup, sourced to an aircanada.com press-release URL). **Weaker
  sourcing than the rest of this batch, flagged in the row's `Notes`:** Firecrawl explicitly
  declined to scrape `aircanada.com/media/*` and WebFetch timed out on the same path (bot-blocked),
  so the agent confirmed the release's URL/title exist on aircanada.com via search, then got the
  full text (incl. a named VP quote) via an aviation trade wire that cites "Source: Air Canada."
  The Personalization Source column still points at the aircanada.com URL (not the mirror), but
  this was never directly rendered this session — worth a direct re-check before sending. The
  agent correctly passed over Air Canada Foundation (real, on-domain, but child-health-focused, not
  founder-relevant) and used none of the tracker's third-party hooks (Inventures, EY, FTE Innovate
  Awards). Route = Email, no LI hook needed.
- **Airbus** — confirmed "Airbus Central Innovation" is real, current, and one of 7 live tiles on
  Airbus's own innovation-ecosystem index (not "Airbus Scale," which only appears in a superseded
  2021 press release). Found a very recent Airbus Tech Hub in Canada (Mirabel, Quebec, not BC) —
  deliberately not used, to avoid implying a Vancouver tie. Initiative: "Airbus Central Innovation."
  LI Short Hook (route=LinkedIn): "Airbus Central Innovation" (25/50 chars, variant A). Clean —
  zero run-report flags.
- **Alacrity** — **past VSW sponsor (2023, warm lead via Viv)**, so `VSW Alignment`'s tone
  directive explicitly frames this as reconnecting with a returning partner, not a cold pitch (the
  actual send will use the re-engagement template at render time — no new columns needed for that).
  No single branded "accelerator model" name exists on their current site, so the agent used
  **APEX** instead — their named export-readiness program, doubly anchored since it's tied to the
  CEO contact herself via Alacrity's own "Inside APEX with Golriz Fattahi" feature. Correctly
  claimed only "BC," not "Vancouver" (their own site refers to them as "Vancouver Island's Alacrity
  Canada"). **3 run-report flags, 2 expected/resolved, 1 a real pre-existing data gap:** (1)
  LOCALITY CLAIM — expected, resolved (BC tie independently confirmed on their own site). (2) PAST
  VSW SPONSOR — expected, by design; needs the re-engagement template, not a defect. (3) NAME↔EMAIL
  MISMATCH — `Primary Contact Name` is just "Golriz" (no last name) against
  `gfattahi@alacritycanada.com`; not an actual identity conflict (the agent independently confirmed
  via Alacrity's own team page + LinkedIn that she's Golriz Fattahi, CEO), just an incomplete
  tracker field predating this session. **Not fixed** — contact/routing fields were out of scope
  for this enrichment pass; flagged for Tej to decide whether to complete the name.
- **Amazon** — collision-checked against the Tier 1 "AWS" row (which already uses "AWS Activate"
  as its initiative) and found a genuinely distinct alternative: **AWS Global Startup Program**
  (an invite-only GTM/enterprise-readiness program for funded startups, sourced to
  `aws.amazon.com/partners/programs/global-startup/`), explicitly different in kind from Activate's
  credits/tooling angle. Runner-up candidate ("AI for Startups" — passed over as conceptually
  closer to Activate) logged to `Notes` per the enrichment-model doc's instruction for the Amazon
  archetype. LI Short Hook (route=LinkedIn): "AWS Global Startup Program" (26/50 chars, variant A).
  Clean — zero run-report flags.
- **AMD** — passed over the bare "AMD Ventures" umbrella name as boilerplate (agent's own note: it
  would equally describe Nvidia's NVentures or Intel Capital) in favor of a specific, dated,
  sourced detail — their March 2026 investment in World Labs (Fei-Fei Li's spatial-intelligence
  startup). Initiative: "AMD Ventures' investment in World Labs." LI Short Hook (route=LinkedIn):
  "AMD Ventures' investment in World Labs" (38/50 chars, variant A). Clean — zero run-report flags.

**Write:** all 5 rows updated in `master-prospects` (`Their Initiative`, `Their Goal`,
`VSW Alignment`, `Personalization Source`, plus `LI Short Hook` on Airbus/Amazon/AMD, plus a
`Notes` append on Air Canada and Amazon), same dry-run-then-`--write` pattern, keyed by
Organization Name, guarded against overwriting existing content. 25 cells written. Re-ran
`scripts/run-report.ts "Tier 2"` afterward: **9 of 53 Tier 2 rows now clean** (8 from these two
batches + 1 pre-existing), Accenture's + Alacrity's flags all expected/resolved as documented
above and in the previous entry; 42 rows remain correctly flagged as not yet researched.

Next: remaining 43 unenriched Tier 2 rows (batch 3+).

### 2026-07-20 (Air Canada correction) — Sponsorship-pattern evidence accepted as a sourcing exception

Tej pushed back on the batch-2 Air Canada clause after reviewing it: he pointed at two facts I'd
deliberately excluded — Air Canada for Business sponsoring Startup Canada's "Startup Day"
(`startupcan.ca`) and Air Canada's logo on Inventures' sponsor page (`inventurescanada.com`) — and
argued the *pattern* of backing founder-ecosystem events is itself exactly the kind of "what are
they backing and why" signal the outreach strategy is built on.

Checked both before changing anything: Inventures' own sponsor page shows Air Canada as a bare
logo with no program name (too generic on its own — fails the substitutability test regardless of
domain). The Startup Canada page is more specific (a named event, a real partnership) but has zero
links to or mentions on aircanada.com, and a `site:aircanada.com` search turned up nothing;
Firecrawl also still flatly refuses to scrape aircanada.com ("we do not support this site"), same
block hit in batch 2.

**Landed distinction, agreed with Tej:** third-party confirmation of an actual sponsorship
*relationship* (the receiving org's own site confirming Air Canada funded/backed their event) is
different from third-party *commentary describing what Air Canada does* — the latter is the
shallow-search failure mode the playbook's own-domain rule exists to prevent; the former is a
receiving org making a first-party claim about its own sponsors, which is no less reliable than a
company's own homepage making a first-party claim about itself. **This is a scoped exception, not
a rule change** — it applies to sponsorship-relationship evidence specifically, not to general
open-web "recent news" sourcing, which the playbook's namesake-minefield warning still fully
governs.

**Row updated** (`Air Canada`, row 13): Initiative → `your sponsorship of Startup Canada's Startup
Day`; Goal → `supporting Canada's entrepreneurial ecosystem`; VSW Alignment rewritten around the
backing-pattern argument; Personalization Source → `startupcan.ca` + `inventurescanada.com/sponsors`.
The superseded DINR clause (Initiative/Goal/Source/Alignment) was **not deleted** — folded verbatim
into `Notes` for traceability, per the standing rule to never silently drop existing evidence from
a cell. 5 cells written, dry-run-then-`--write`, same pattern as every other write this session.

**Known blind spot, disclosed rather than exploited:** `scripts/run-report.ts`'s ENTITY MISMATCH
check does not flag this row, because its acronym-matching heuristic happens to match "ac" inside
"inventurescanada**c**om" — a false-negative quirk of the heuristic, not evidence the source is
actually on Air Canada's own domain. Documented directly in the row's `Notes` rather than relying
on the checker to catch what it can't see.

### 2026-07-20 (Tier 2 batch 3) — 10 rows enriched, 1 agent per org, one mid-batch redo

Same parallelized process as batches 1–2 (one independent agent per org, deep-scrape method,
central validation before any write), scaled to 10 agents at once per Tej's request. Writes were
made incrementally as each agent cleared, rather than held for the end of the batch, per Tej's
direction partway through this batch — a process change that carries forward into every later batch.

- **Angel Forum** — confirmed `angelforum.ca` is correct (Irene Dorsman, CEO, matches the tracker's
  contact) before writing anything. Initiative: "the Greg Smith Award," their own signature award
  celebrating founder-investor partnerships. **Flag, not fixed:** their current site only lists a
  shared `hello@angelforum.ca` inbox; an older cached page showed `irene@angelforum.org` (different
  domain) — worth a deliverability sanity-check before sending.
- **AngelList — redone once, per Tej.** First pass proposed "the Ark acquisition" (very recent M&A
  news) or "Rolling Funds" (fund-infrastructure product); Tej rejected both as not relevant to
  VSW's actual founder audience. Redo confirmed AngelList's homepage/product nav has drifted almost
  entirely to GP/fund-infrastructure tooling (their own "Our evolution" page states the 2020 pivot
  explicitly) but found one surviving founder-facing surface: **Roll Up Vehicles (RUVs)**, from
  their own blog post "Introducing Rollups | Built for Founders" — solves a real founder problem
  (a crowded cap table from angels/friends/family), not GP tooling. This row's Category/Why Them
  remain blank — a pre-existing tracker gap, not addressed here.
- **Apple TV — first pass, left blank.** Deep-scraped tv.apple.com, Apple's Canadian newsroom, and
  the Apple TV Press page; found nothing founder/startup/Vancouver-relevant, matching the tracker's
  own "brand-reach, not founder-specific" framing. Left Initiative/Goal/Alignment/Source blank per
  the enrichment model's documented "no hook exists" rule, reason recorded in `Notes`. **This was
  later redone and filled — see the batch 4 entry below.**
- **Aspect Biosystems** — Initiative: "your partnership with Novo Nordisk," sourced to a January
  2026 press release. Excluded the older "Lab-on-a-Printer™" branding (confirmed stale — no longer
  used on their current site) and the tracker's $280M figure. Locality independently confirmed via
  the release's own Vancouver, BC dateline.
- **BC Tech** — Initiative: "the Technology Impact Awards." Confirmed `wearebctech.com` is current
  (no rebrand) and that `bctech.org` is an unrelated namesake (a different IT/networking firm) —
  did not use it. Discarded a JSON-extraction artifact ("Arrow Lakes School District" as a false
  locality highlight) rather than trust the extractor, per the standing rule. Past VSW sponsor
  (2023) — re-engagement tone.
- **BDC** — Initiative: "Thrive Venture Fund," BDC Capital's active fund for women-led tech
  companies — chosen over the closed Women in Technology Venture Fund and closed Deep Tech Venture
  Fund specifically because it's still accepting applications. A founder-relevant angle distinct
  from BDC's public-mandate/institutional side that shows up in its third-party sponsorships.
- **Boast** — Initiative: "your QuickFund program," their startup-specific non-dilutive
  advance-funding product (chosen over AuditShield, their audit-defense product, since QuickFund is
  the one explicitly framed for startups). Route is Warm via Viv — enrichment still filled as
  background material for her outreach.
- **CBRE High Technology Facilities Group** — Initiative: "Techspace Quarterly," their own
  newsletter, with the Goal clause sourced directly from the actual named contact's (Alain Rivère)
  own bio page — not just the team generically. The tracker's Startup TNT/Vancouver Tech Journal
  mentions never surfaced on CBRE's own domain and were correctly excluded.
- **Cloudflare** — Initiative: "Cloudflare for Startups," confirmed as the current program name.
  **Flag:** the tracker's dollar-tier figures are stale — Cloudflare's own FAQ shows tiers were
  raised since that note was written (moot for the clauses, which exclude dollar figures regardless).
- **Dell** — Initiative: "Dell for Startups," verified still live and current (a real, forward-dated
  2026 city tour schedule) rather than assumed from the tracker note. Deliberately passed over the
  tracker's "Entrepreneur Challenge... built with YourStory" claim since that lives on a third-party,
  India-market-specific domain (`entrepreneurhub.yourstory.com`), not dell.com.

**Write:** all 10 rows (Apple TV left intentionally blank) updated in `master-prospects` via the
same dry-run-then-`--write` pattern, keyed by Organization Name, guarded against overwriting
existing content. Re-ran `scripts/run-report.ts "Tier 2"` after: 9 of 53 clean at that point (8
from this batch + 1 pre-existing); Accenture's 2 flags remained the only expected/resolved
exceptions.

### 2026-07-20 — Air Canada run-on discovered via run-report: a live-sheet edit, not a script

Running the routine post-batch `run-report.ts` check (unrelated to batch 3's own orgs) surfaced a
new RUN-ON flag on **Air Canada** — `Their Initiative` now read *"your involvement with Startup
Canada's Startup Day and Invetures Canada"* (note the typo, "Invetures"), containing a literal
" and " joining two separate facts, which collides with the sentence template's own "and your focus
on..." to create exactly the compound-run-on failure the grammar gate exists to catch.

This text does **not** match what the Air Canada correction entry (above) wrote — that write set
Initiative to `your sponsorship of Startup Canada's Startup Day` (one named thing). The `Notes` and
`VSW Alignment` cells were unchanged from that write; only `Their Initiative` had changed. That
pattern — one cell changed, everything else untouched — is consistent with a direct manual edit to
the live sheet rather than any script run this session (no write in this project's history produces
that exact string). Per the standing habit that Tej edits `master-prospects` columns live, this was
flagged to him directly rather than silently reverted or "corrected" — **as of this entry, still
open, awaiting his answer** on whether to split it back to one named thing (keeping Inventures as
supporting context in `VSW Alignment` only, as it already was) or rephrase some other way.

Every subsequent agent prompt in batch 4 (below) was updated to explicitly warn against recreating
this exact failure mode: if multiple relevant facts are found, the Initiative clause must stay ONE
named thing, no matter how tempting it is to combine them with "and."

### 2026-07-20 (Tier 2 batch 4) — 10 rows enriched, one Apple TV redo, one Ink LLP revision

Same parallel-agent process as batch 3, plus the new Initiative-must-stay-ONE-thing guardrail
above. This batch was unusually past-sponsor-heavy: DVBIA (3x), Earnest Ice Cream, ENTAX (2x),
Funded in Vancouver (active 2026), Futurpreneur (5x, the most consistent on the list), and Ink LLP
all needed re-engagement framing rather than a cold opener.

- **DVBIA/Downtown Van** — Initiative: "your annual State of Downtown report." The tracker's
  "$50,000 Launchpad competition" claim could not be verified anywhere on dtvan.ca despite a
  thorough check (full site map, full 28-program `/projects` listing, targeted searches) — treated
  as stale, substituted the verified, current State of Downtown 2026 report instead. **Important
  standing flag, not an enrichment issue:** this row's `Notes` already say "Emailed July 15 to be
  scheduled out next week post-Fifa" with no `Status` set — it may already be mid-conversation, not
  a fresh cold-outreach target. Check current thread state before using this enrichment to send
  anything.
- **Earnest Ice Cream** — Initiative: "Zero Waste Journey" (a literal on-site heading: refillable
  glass-jar packaging, 254,977 jar returns last year). Goal: "strengthening local food systems"
  (verbatim from their own commitments list). Past sponsor (2019, via VIK).
- **ENTAX** — **reverses this project's own documented example.** docs/org-goals-enrichment-model.md
  §6 names ENTAX as the canonical "no verifiable goal" case. A fresh deep-scrape of the *correct*
  domain (`entax.ca` — distinct from an unrelated US namesake, `en-tax.com`) found a real, specific
  hook: **SREDmax**, ENTAX's own named SR&ED methodology, positioned explicitly against automated
  competitors. Best guess: the original pass hit the namesake or used open-web search instead of an
  own-domain scrape. Route stays Warm via Viv/Ryan Pernia — this is supporting colour for a warm
  renewal ask (2x past sponsor), not license for cold templated copy. **The doc's §6 worked example
  should be updated to reflect this** — flagged, not yet done.
- **Fasken** — Initiative: "the Emerging Technology & Venture Capital practice," independently
  verified via two Vancouver-based practice partners (Jon Conlin, Shahrooz Nabavi) and a real
  Vancouver office (550 Burrard St) — not just the tracker's third-party NVBC/BC Tech note. Minor
  note: the tracker's named contact (Mike Stephens) isn't on the practice page's own primary-contact
  list — well-targeted (Vancouver IT-law partner) but not that group's literal lead.
- **Funded in Vancouver** — Initiative: "Beaver's Den," their own pitch event, which literally
  opened VSW 2026 at Science World this year. **Category flag:** their own site says "a
  Vancouver-based media company" (podcast), not the tracker's "Accelerator" — recommend Tej/Andrew
  confirm the correction. **Tone flag:** since this is a currently-active 2026 sponsor, neither the
  cold template nor the past-sponsor re-engagement template quite fits — recommend a warm
  active-partner check-in instead of either.
- **Futurpreneur** — Initiative: "Core Startup Program" (confirmed current, cross-linked from 10+
  program-variant pages). Goal: "driving inclusive Canadian prosperity" (a verbatim lift from their
  About page, appearing twice). **Timing flag:** their sponsorship list includes 2026 (this year) —
  worth confirming whether this reads as "renewing" rather than "reconnecting."
- **Ink LLP — revised after Tej's direct feedback.** First pass anchored on their "Royalty Unit
  Note (RUN)" financing product; Tej redirected to their practice-area positioning instead, since
  VSW is expanding to become Vancouver's central point for exactly that VC/M&A/startups ecosystem.
  Re-sourced from `inkllp.com/expertise`: their three core practices are Venture Capital & Growth
  Financing, Mergers & Acquisitions, and Startups & Emerging Companies. New Initiative: "your
  Startups & Emerging Companies practice" (one named practice bridging investability and exit
  themes, avoiding a three-way "and" run-on). New Goal: "ensuring startups are built to be both
  investable and exitable." VSW Alignment now explicitly ties Ink LLP's three practices to VSW's
  stated expansion. Old RUN-based clause preserved in `Notes`, not deleted.
- **Global Affairs Canada** — Initiative: "the Innovation Partnership Program," confirmed as the
  current name (the tracker's implied older name, "Canadian International Innovation Program
  (CIIP)," is confirmed retired — GAC's own page states IPP is its successor). **Data flag, not
  resolved:** this row's `VSW` checkbox reads FALSE, but its own `Notes` cite sched.com evidence of
  a 2016 VSW sponsorship — a real inconsistency Tej should adjudicate before this row is drafted, in
  case it needs the re-engagement template instead. Also flagged: CanExport Innovation is real and
  current but its own page's "opens June 2026" intake language reads as calendar-stale now — re-verify
  before citing it as open. **Run-report false positive found and fixed:** `tradecommissioner.gc.ca`
  doesn't share letters with "Global Affairs Canada," so the ENTITY MISMATCH heuristic flagged it —
  added to `CONFIRMED_DOMAINS` in `scripts/run-report.ts` (same pattern as Kensington/Trade and
  Invest BC) since the page itself repeatedly self-identifies as "of Global Affairs Canada."
- **Innovate BC** — Initiative: "the Integrated Marketplace." The tracker's "$2.5M / up to $500,000"
  figures belong to a specific sub-program (Early-Stage Demonstration Call) confirmed **closed**
  (deadline Dec 21, 2025) — substituted the parent program, confirmed live-and-open today against
  five sibling programs explicitly tagged closed on the same page. Also excluded a quote from
  Innovate BC's own About page that was actually attributed to NVBC's Executive Director, not
  Innovate BC's own words.
- **Apple TV — redo, fills the batch 3 blank.** Pushed for a sharper angle (Vancouver is a major
  film/TV production hub) and found a genuine hook: an actual episode of "The Reluctant Traveler
  With Eugene Levy" — "Going Wild for a Weekend in Vancouver" — confirmed independently across five
  of Apple's own domain variants (US/CA/UK press pages, a dedicated press release, the consumer
  watch page), featuring Vancouver-born Michael Bublé. **Why the first pass missed it:** the
  scripted dramas third parties confirm as BC-shot (`See`, `Pachinko`, `Stick`) are exactly the ones
  where Apple's own site stays silent on filming location (Vancouver doubles as somewhere else
  on-screen) — this unscripted travel show is the one place Apple's own site names Vancouver by
  design. Old "no hook found" note preserved in `Notes`, marked superseded, not deleted.
- **Grammarly — not completed.** Tej stopped the research agent mid-run; row left as-is, not
  re-launched.

**Process incident, mid-batch: a run of 7 agents was cut off by a session usage limit** (API error,
resets 4:30pm America/Vancouver) partway through. After Tej upgraded his plan, the 7 affected agents
(Apple TV redo, Funded in Vancouver, Futurpreneur, Grammarly, Ink LLP, Global Affairs Canada,
Innovate BC) were relaunched with identical prompts; the other 4 in the same batch (DVBIA, Earnest
Ice Cream, ENTAX, Fasken) had already completed before the limit hit and were not duplicated.

**Write:** all rows in this batch used the same dry-run-then-`--write` pattern, keyed by
Organization Name, guarded against overwriting existing content (except the two deliberate
supersessions — Ink LLP here, and Air Canada in the entry above — where the old clause was folded
into `Notes`, never deleted). Re-ran `scripts/run-report.ts "Tier 2"` after every write in this
batch: **20 of 53 Tier 2 rows now clean**; all remaining flags are either by-design (7 past-VSW-
sponsor re-engagement flags), already-resolved-via-research (3 locality claims, 1 known "Global
2000" dated-claim false positive deliberately left alone), or explicitly still open for Tej (the
Air Canada run-on, and Alacrity's pre-existing NAME↔EMAIL gap — "Golriz" vs. a full email — neither
fixed here, both surfaced).

Next: remaining ~32 unenriched Tier 2 rows (Grammarly plus batch 5+), and Tej's answer on the Air
Canada run-on.

### 2026-07-20 (Grammarly, filled without a research agent) — business-development framing, per Tej

Tej gave explicit strategic direction rather than asking for fresh research: Grammarly is a 2x past
VSW sponsor (2019, 2021), and the pitch should be that VSW gets Grammarly in front of startup
founders and their operations teams — i.e., frame the conversation as a business-development
opportunity for Grammarly, not just a courtesy renewal. Tej explicitly said not to relaunch the
stopped research agent; filled the columns directly instead, with one quick single-page check
(not a full agent) to source the Initiative/Goal rather than invent them from memory.

Initiative: "Grammarly Business" (their team/enterprise product — current on-page branding is
"Grammarly for Teams & Businesses" / "Grammarly Enterprise"; used the simpler, more recognizable
label). Goal: "helping teams and companies of all sizes achieve results with AI," paraphrased from
grammarly.com/business's own stated value proposition. Excluded their cited "17x ROI" metric
(wallet-sizing-adjacent). VSW Alignment carries the actual strategic ask: VSW's founder/ops-team
audience is framed explicitly as Grammarly Business's target buyer, so the conversation should
pivot from thanking a past sponsor to pitching VSW as a pipeline worth continued investment.

Wrote via the same dry-run-then-`--write` pattern, keyed by Organization Name. This closes out
batch 4's one incomplete row.

### 2026-07-20 (Tier 2 batch 5) — 10 agents, 2 orgs each, 18 of 20 written so far

Tej: "can you do the same with the next 20. launch 10 agents and assign 2 orgs to each agent." Took
the next 20 unenriched Tier 2 rows in live sheet order (re-read fresh, not from memory), paired them
into 10 two-org research briefs, ran all 10 in parallel as background agents (research-and-report
only, no direct writes), then validated + wrote centrally as each pair returned, per the standing
"write as they finish" rule. Each brief carried the full grammar gate, the sourcing rules including
the Air Canada-style sponsorship-relationship exception, and the org's existing sheet data (Why
Them/Notes/VSW flag) so agents verified and extended it rather than starting cold.

Written (18 of 20; RBCx + SAP still in flight as of this entry):

- **Innovation UBC** — Initiative: "Venture Founder" (their founder-formation program, 51st cohort).
  Existing "$190M+ / 80% of BC's sponsored research funding" figure is real but a dollar figure —
  excluded, named program used instead.
- **Invest Vancouver** — Initiative: "Invest Talent" (Future Skills Centre-funded regional talent
  accelerator). Caution logged: "BC Business House" (FIFA-period context) is a larger multi-org
  brand, not Invest Vancouver's own — don't present it as their program.
- **Mosaic Accelerator** — Initiative: "the Mosaic Mentorship" (AI + human hybrid). **Domain
  correction:** mosaicaccelerator.com, not .ca. Caution: their own program page still shows a stale
  "Fall 2025 applications" banner as of this check — verify the program is actively accepting
  before sending.
- **New Ventures BC** — Initiative: "the IP Summit," co-presented with Innovate BC and confirmed on
  NVBC's own site as part of the official 2026 VSW partner calendar. **Flagged for Tej:** VSW
  checkbox is FALSE but an active event-partnership already exists (distinct from cash sponsorship)
  — recommend a warm/continuing-partnership tone, consistent with the pre-existing sheet note
  "make this a warm pathway."
- **Osler** — Initiative: "the Osler Series Seed Financing Templates," a free founder/investor
  resource launched within the last ~6 months, confirmed on osler.com itself. Flagged, not
  resolved: existing claim of past direct VSW sponsorship dollars has no on-domain corroboration
  either way; BC Tech/Foresight 50/SaaS North claims are third-party-flavored and weren't used as
  Source.
- **PacifiCan** — Initiative: "the Regional Artificial Intelligence Initiative," confirmed current
  and just expanded nationally. **Run-report false positive found and fixed:** pacifican.gc.ca
  redirects to a generic splash page — real content lives under canada.ca, so `canada.ca` was added
  to `CONFIRMED_DOMAINS` in `scripts/run-report.ts` (same pattern as Global Affairs Canada). Flagged:
  existing "Innovate BC Business grant intake" claim couldn't be located under that name — the
  verified joint program is the "Integrated Marketplace," which may or may not be the same thing.
- **Sparkbridge** (past VSW sponsor, 2025 — re-engagement framing) — Initiative: "the Start-Up Visa
  program." **Important contact flag:** the on-file email (support@sparkbridge.com) resolves to an
  unrelated parked/for-sale domain — their real site is sparkbridge.ca. Recommend verifying that
  inbox is actually monitored, or finding a sparkbridge.ca contact, before sending anything.
  Namesake-domain trap, same family as the Rhino/Kensington failures the playbook warns about.
- **TECHTO** — Initiative: "Together Toronto event series." **Qualification flag:** the existing
  "real Vancouver presence" claim doesn't hold up — the only Vancouver-related thing on techto.org
  is a speculative "Coming soon" city signup, not a scheduled event, and their own /sponsors page
  recruits sponsors for itself (reverse direction of the ask VSW would make). Recommend treating as
  a cross-promotion/media prospect, not a cash-sponsorship ask. Confidence: medium.
- **Northeastern University** (past VSW sponsor, 2023/2024 — re-engagement framing) — Initiative:
  "the Venture Support Program," matching spinout founders to stage-appropriate resources. Verified
  independently: Northeastern runs a real downtown Vancouver campus (1400 – 140 West Georgia St.)
  and the 2023 VSW partnership, both on their own Vancouver-campus subdomain.
- **NorthX** — Initiative: "the Women in Climate Tech Call for Innovation" (five women-led climate
  ventures backed alongside Scotiabank/Roynat). Namesake caution: "NorthX" alone is ambiguous
  (NorthX Biologics is an unrelated Swedish biotech) — always qualify as NorthX Climate Tech /
  northx.ca. Category ("Accelerator") is an imperfect fit — they function as a funder, flagged not
  fixed.
- **Lovable** — Initiative: "your AI Native Startup Playbook" (their accelerator/VC partner
  program). The existing "20 hours" origin story traces only to the CEO's X post, never found on
  lovable.dev itself — correctly excluded as third-party-sourced (its dollar figures would have
  failed the gate anyway).
- **Microsoft for Startups** — Initiative: "your Founders Hub program." Flagged: existing "current
  Launch Academy sponsor" claim only checks out as a March 2024 one-off meetup thanking "Microsoft
  Vancouver," not "Microsoft for Startups" by name — now ~2 years stale, recommend confirming a live
  2026 relationship before that specific claim ships.
- **Science World** — Initiative: the geodesic dome's transformation into "The Beautiful Dome" for
  FIFA World Cup 2026. **Correction, not just a caution:** the existing "Science Inc. Accelerator"
  and "SciBiz Regional" claims do not check out anywhere on scienceworld.ca — open web ties those
  names to unrelated organizations entirely. Looks like a hallucinated/conflated claim in the prior
  tracker data; recommend removing it. Also flagged: VSW's own 2026 promotion shows Science World
  hosted that year's Opening Reception/Startup Alley/Beaver's Den, which the FALSE past-sponsor flag
  may not capture — may warrant re-engagement tone, Tej's call.
- **SFU VentureLabs** — Initiative: alumni company Moment Energy's "Megafactory 1" (the world's
  largest EV battery repurposing facility, Surrey BC) — chosen over an equally-verified alternative
  (A&K Robotics' Series A) for recency and a stronger superlative; the A&K angle is preserved in
  Notes as a backup.
- **Planet Food** — Initiative: "your feature on Global News." **Qualification flag:** this is a
  pre-seed-stage startup (incorporated 2025), not a typical corporate sponsor — confirm with
  Tej/Andrew whether the ask here is cash sponsorship or a peer/cross-promotion play, since the size
  mismatch is unusual for this tracker. Confidence: medium.
- **RBC** — Initiative: "your FinSec Incubator" (with Rogers Cybersecure Catalyst). **Correction:**
  the existing "RBC Reach" claim is stale/wrong — that accelerator hasn't run a cohort since
  ~2020, and RBC's site now uses the identical name for an unrelated internal disability ERG.
  Substituted FinSec Incubator, which also correctly grounds the existing "partners with Catalyst"
  thread. Equally strong alternate (RBC Women in Cleantech Accelerator with MaRS) preserved in Notes.
- **TransLink** (past VSW sponsor, 2019 — long-gap re-engagement framing) — Initiative: "your Open
  Call for Innovation," TransLink's own recurring solicit-outside-solutions program. Note: contains
  "Transport 2050" (their real 30-year strategy name), which will trip the automated DATED CLAIM
  check as a false positive — the name, not stale info.
- **Vancouver Tech Journal** — Initiative: "VTJTalks," their own in-person founder event series.
  Domain corrected in reasoning only (vantechjournal.com; the on-file contact email's
  overstorymedia.com domain is their parent company's, confirmed directly on VTJ's own site, not a
  mismatch).

**Write:** same dry-run-then-`--write` pattern, keyed by Organization Name, `Ready?` set TRUE on
each row written (Status left untouched — sampling showed it isn't consistently advanced by past
batches either). Every superseding/correcting finding above folded into `Notes` rather than
overwriting silently.

**RBCx + SAP agent — stopped by Tej mid-run**, no output returned. Tej then said RBCx doesn't
matter (relationship already exists via RBC) and asked specifically for SAP's `VSW Alignment` +
`LI Short Hook` — Their Initiative/Goal for both SAP and VANTEC Angel Network turned out to
already be filled in directly on the live sheet (not by any script this session), so only those
two fields were requested rather than a full redo.

- **SAP** — Alignment built on the existing `Why Them`'s real, specific facts (BC Tech Association
  membership, Vancouver office at 910 Mainland St., the "SAP for Startups" program's 200-startup
  diversity track record) rather than the actual `Their Initiative`/`Their Goal` in the sheet
  ("autonomizing functions across enterprises" / "expanding the SAP partner ecosystem"), which read
  as generic global enterprise-software boilerplate sourced from a SAP Learning course page, not
  anything Vancouver- or founder-specific. Flagged in Notes, not changed — Tej only asked for
  Alignment + LI Hook. sap.com itself 403'd (bot-blocked) during this pass; BC Tech's own member
  directory (wearebctech.com) confirmed the membership and address instead. LI Hook: "SAP for
  Startups' work with founders."
- **VANTEC Angel Network** — Verified directly on vantec.ca (which also fixed a previously-blank
  `Personalization Source`): founded 1999, monthly pitch nights, and a specific named program,
  WUTIF Capital, dedicated to founders raising angel/seed-round funding — a stronger, more
  distinctive Initiative than the sheet's existing generic "pitch events for founders to get in
  front of investors," flagged as a possible swap rather than changed unprompted. Did not cite a
  dollar figure in Alignment: the existing Why Them says "$8M+/year," a web search turned up
  "$5M in 2024" — different, unreconciled figures, neither confirmed on vantec.ca itself, so left
  out. LI Hook: "VANTEC's monthly founder pitch events."

### 2026-07-21 (Tier 1 warm-lead audit) — 7 warm companies pulled out of Tier 1, one stale Status fixed, doc removal manifest handed to Tej

Andrew's spec: Tier 1/Tier 2 must be cold-only. Some Tier 1 rows were flagged `Warm Lead?` or
`VSW` (past sponsor) — warm/relationship companies had leaked into the cold batch, and 6 of them
already had generic cold-tone drafts sitting in the shared drafts doc
(`1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk`) for Andrew's sign-off — wrong, since warm
companies need a re-engagement/warm-intro approach, not cold copy.

**Built `scripts/tier1-warm-audit.ts`** (committed, permanent — same conventions as the other
three: header-name/org-name resolution, dry-run-by-default, `--write` flag, before/after print).

**Re-derived fresh, not from any prior recon:** of 32 Tier 1 rows, 7 are warm — EY, Google Cloud,
Greater Vancouver Board of Trade, The Forum, Vancity, Version One Ventures, Voyager Capital.
Google Cloud and Voyager Capital are the only two with `VSW=TRUE`, and both were already
`Warm Lead?=TRUE` too, so no row is warm via the VSW flag alone.

**Written for real (`--write`):**
1. **`Outreach Tier`: "Tier 1" → "Warm" on all 7 rows above.** Every other column on each row left
   untouched. Verified after write: Tier 1 is now exactly 25 rows, 0 of which are warm-flagged.
2. **`Status` correction: City of Vancouver, `Enriched` → `Drafted — awaiting approval`.** Its
   `Draft Link` cell has always held a real URL into the drafts doc, but `Status` never advanced —
   a stale-metadata bug, not a warmth issue. Checked all other 24 non-warm Tier 1 rows against both
   their `Draft Link` cell and the actual doc content (a real `# Org — Channel/sender` heading
   confirmed present for each); City of Vancouver was the only mismatch. The other 22 drafted rows
   already read `Drafted — awaiting approval` correctly; the remaining 2 (Coast Capital Venture
   Connection, Vancouver Economic Commission) are `Archived` — already terminal/human-owned
   (index 6+), correctly held, not touched.

**Not written — left for Tej, per his explicit instruction not to auto-decide Status on relabeled
rows** — one recommendation per row, grounded in that row's own Warm Lead Person/Path, VSW flag,
and `Why Them` (full text in the script's `WARM_STATUS_RECOMMENDATIONS`, not repeated here). Short
version: revert all 7 to `Enriched` once their cold draft is gone, EXCEPT The Forum (leave at
`Enriched` — already correct, no cold draft ever existed for it) — Voyager Capital gets an extra
flag because the doc's second copy of its draft has *already* been hand-rewritten into a
warm-renewal tone referencing the 2020/2021 sponsorship, unlike its first-section copy which is
still generic cold copy.

**Doc-side removal manifest (I do not have write access to this Google Doc — no tool here edits
Docs body content):** the drafts doc has an unusual structure — most orgs' drafts appear **twice**
(a "main batch" section without navigation anchors, plus a second alphabetized section with a
one-word bookmark heading immediately before the real content heading; LinkedIn-routed orgs also
get a third copy in a "Batch 1 LinkedIn Msgs" quick-copy appendix). Handed to Tej as the actual
deliverable (not restated in full here — see chat): exact heading text + the next heading that
must be preserved, for each of 11 total cold-copy sections across the 6 orgs that need pulling
(EY, Google Cloud, Greater Vancouver Board of Trade, Vancity, Version One Ventures both copies;
Voyager Capital's first/main-section copy only — its second copy is flagged for review, not
listed as a clean delete, since it's already partially rewritten warm). The Forum's doc entry is
untouched — its "Warm intro / via Andrew" note was already correct.

**Also re-verified:** no doc-drafted org is untagged for Tier 1 — all 29 drafted orgs match a
Tier 1 organization name exactly (the script checks this every run and would print any mismatch).

**Known limitation, recorded in the script's own header comment:** `DOC_DRAFTED_ORGS` (the list
the Status-correction pass cross-references against) is a hand-verified snapshot from reading the
doc via the Drive/Docs MCP tool in this session, 2026-07-21 — there's no Docs API scope/credential
wired up for a tsx script to re-read it live, the way `tracker.ts` does for the Sheet. Re-verify
this list against the doc before trusting it on a future run, same caveat as `run-report.ts`'s
`CONFIRMED_DOMAINS`.

### 2026-07-21 (Tier 2 warm rows removed, 24 non-warm replacements proposed)

Tej: Tier 2 is the cold-outreach drafting queue, so any row that's actually warm doesn't belong in
it — warm relationships get a handwritten ask from the relationship-holder (Viv/Andrew/Holden), not
a drafted cold email. Asked to (1) find and pull warm rows out of Tier 2, resetting them to
`Route identified`, then (2) identify non-warm replacements from the rest of the tracker so Tier 2
comes back to 50.

- **Re-read the live header fresh** (per the standing habit — Tej reshuffles columns) rather than
  trusting AGENTS.md's last-synced (2026-07-15) column map, which had drifted: `master-prospects` is
  now 80 columns, `Status` at A, `Outreach Tier` at BN, `Warm Lead?` at AR. Live Tier 2 was 52 rows
  (not the 50 from the 2026-07-17 shortlist — Tej had independently added AInBC, AngelList, and
  Planet Food since, and dropped Musqueam Indian Band).
- **"Warm" = the `Warm Lead?` checkbox specifically**, not a named `Warm Lead Person`/`Warm Lead
  Path` alone. 4 Tier 2 rows (Angel Forum, PacifiCan, Planet Food, TECHTO) have a person noted but
  the checkbox reads FALSE — treated as uncertain/unconfirmed, left in the cold pool rather than
  removed.
- **26 of 52 Tier 2 rows had `Warm Lead?=TRUE`.** Wrote live, keyed by Organization Name against a
  fresh re-read, each write guarded by re-checking `Warm Lead?=TRUE` and `Outreach Tier="Tier 2"`
  immediately before touching the row (idempotency/race guard, same pattern as the 2026-07-17
  write): cleared `Outreach Tier` and reset `Status` to `"Route identified"` on all 26 (AI Network
  of BC, Alacrity, BC Tech, BDC, Boast, CBRE High Technology Facilities Group, Cloudflare, DVBIA/
  Downtown Van, Earnest Ice Cream, ENTAX, Fasken, Funded in Vancouver, Futurpreneur, Grammarly, Ink
  LLP, Innovate BC, Innovation UBC, Invest Vancouver, New Ventures BC, Northeastern University,
  Osler, RBCx, Science World, Sparkbridge, TransLink, WorkSafe BC). **Did not delete their
  enrichment** (`Their Initiative`/`Their Goal`/`VSW Alignment` etc. left intact) — only `Status`
  and `Outreach Tier` changed, since a relationship-holder doing their own warm outreach can still
  use that research as background. Batch-wrote 52 cells (`values.batchUpdate`, `USER_ENTERED`),
  read every cell back: **26/26 verified.** Live Tier 2 count confirmed at 26 after the write.
- **Scored replacement candidates using the same formula as the 2026-07-17 shortlist** (Source Type
  + event checkboxes, Why Them quality, BC/Vancouver signal, budget/decision-maker fit,
  contactability, category-fit — see that entry or the artifact footer for exact weights), run
  against every currently-untiered row with `Warm Lead?≠TRUE` (275 candidates, 2 zero-evidence
  excluded). **Deliberately excluded 3 First Nations government rows that otherwise scored well**
  (Musqueam Indian Band, Squamish Nation, Tsleil-Waututh Nation — all via the same signal, co-Host
  City Supporter for FIFA World Cup 2026) — same reasoning as the original Tier 1 pass: that
  relationship runs through protocol/relationship channels, not a cold email, so flagged for
  Vivian's direct judgment instead of folded into the ranked list.
- **Top 24 by score (cut lands cleanly at 52 pts) proposed as replacements — not written to the
  sheet.** Category mix stays well under the 20-per-category cap the original shortlist used (Tech
  17 combined, next-highest Finance 5). Flagged data-quality issues found along the way rather than
  silently using bad data: Anthropic's `Email` cell literally contains the string `"Anthropic"`,
  not an address; Microsoft's contact name has a trailing `/` (data-entry artifact); Mastercard's
  only sourced program (Changeworks) is a CSR/grants program, not startup sponsorship — flagged as
  needing a reframed ask, not a straight sponsorship pitch; the proposed "Microsoft" row is flagged
  against the already-kept "Microsoft for Startups" row (same parent, avoid duplicate outreach).
- **Delivered as an update to the existing 2026-07-17 Tier 2 Artifact** (same URL, redeployed —
  https://claude.ai/code/artifact/d5991353-2b95-4cb2-baa8-023ed09d55fa), not a new one: shows the 26
  removed (with warm signal + old/new status), the 26 kept non-warm rows (signal/dept/contact/
  relationship/flag, same schema as the original), the 24 proposed additions ranked with scores, a
  5-row reserve list, and a callout naming the First Nations exclusions, the Mastercard/Microsoft
  flags, and the 10 candidates with no contact route yet needing a sourcing pass before drafting.
- Throwaway `.ts` scripts (`check_headers.ts`, `check_tier2.ts`, `check_tiers.ts`,
  `score_candidates.ts`, `gather_details.ts`, `remove_warm_tier2.ts`) run via `npx tsx` and deleted,
  along with an unrelated leftover throwaway (`check_tier1_tmp.ts`) found sitting uncommitted from
  an earlier session.

**Awaiting Tej's approval on the 24 before any `Outreach Tier` write** — once approved, will
batch-write the same way the original 50 went in (keyed by Organization Name, fresh live re-read,
read-back verification).

### 2026-07-21 (Tier 2 finalized at 50 — 24 approved additions written)

Tej approved the 24-org list above as final (no re-derivation). Mechanical write only.

**Built `tier2_add24.ts`** (throwaway, `npx tsx`, deleted after run — dry-run-by-default, `--write`
flag, before/after print, read-back verification, same conventions as the other scripts in this
effort). Fresh live re-read via `readTracker`, resolved `Outreach Tier`=BN, `Status`=A, `Email`=AV
by header name (unchanged from the prior entry's map, but re-checked, not assumed).

- **Wrote `Outreach Tier = "Tier 2"` on all 24 rows**, keyed by Organization Name against a fresh
  read. All 24 matched by exact name (no misses, no ambiguous duplicates). No other row touched —
  the 26 already-confirmed Tier 2 rows were not re-read/rewritten, only referenced for the final
  count check.
- **Conditional `Status` advance, gated on the `Email` column holding a real address** (regex-shaped
  email check, plus manual eyeballing of every non-match reason before trusting it): only **2 of 24**
  qualified —
  - **ATB Financial** — `tlockyer@atb.com`
  - **Aritzia** — `service@aritzia.com` (generic/shared inbox, counts per Tej's stated rule)

  Both were already sitting at `Status="Route identified"` before this write (unrelated prior work),
  so the write was a no-op in effect but applied anyway per spec — verified unchanged/correct after
  write.
- **22 of 24 had no usable email — flagged for manual research, `Status` left untouched on each:**
  The Cansbridge Fellowship, Alumni Ventures, Anthropic, Notion, Mastercard, Metro Vancouver, Aon,
  Centre for Digital Media, lululemon, Trulioo, Foresight Canada, ATCO, Hiive, LinkedIn, Thinkific,
  University of Toronto, Wealthsimple, FrontFundr, Google for Startups, Microsoft, Smythe LLP, CFIN.
  Two judgment calls on non-email junk, both consistent with the prior entry's data-quality flags:
  **Anthropic**'s `Email` cell literally contains the string `"Anthropic"` (already flagged
  2026-07-21 above, confirmed still present); **ATCO**'s cell holds a text note, not an address —
  `"[TN note: could not find an email. Added form to General Inquiry column]"`. Both correctly
  treated as not-usable, not as a false-positive email.
- **Batch-wrote 26 cells** (`values.batchUpdate`, `USER_ENTERED`: 24 Tier writes + 2 Status writes),
  **read every written cell back: 24/24 verified** (Tier="Tier 2" on all; Status matches expected —
  "Route identified" for the 2, existing/unchanged value for the other 22).
- **Live Tier 2 count confirmed at exactly 50** after the write (26 previously-confirmed + these 24),
  full name list re-pulled fresh and checked.
- Throwaway scripts `tier2_add24.ts` and `tier2_count.ts` run via `npx tsx`, deleted, not committed.

**Handed back to Tej — the 22 orgs needing manual email research:** The Cansbridge Fellowship,
Alumni Ventures, Anthropic, Notion, Mastercard, Metro Vancouver, Aon, Centre for Digital Media,
lululemon, Trulioo, Foresight Canada, ATCO, Hiive, LinkedIn, Thinkific, University of Toronto,
Wealthsimple, FrontFundr, Google for Startups, Microsoft, Smythe LLP, CFIN.

### 2026-07-21 (Tier 1 warm-lead review resolution) — Tej's per-org calls executed, one row held on a live-edit discrepancy

Follow-up to the same day's earlier "Tier 1 warm-lead audit" entry above (unrelated to the
adjacent "Tier 2 warm rows removed"/"Tier 2 finalized at 50" entries — those are untouched).
That audit had relabeled 7 Tier 1 rows to `Outreach Tier="Warm"` and printed a per-row Status
recommendation for Tej to act on himself. Tej has now personally reviewed all 7 and made his
calls; this pass executes them exactly, keyed by Organization Name against a fresh live read
(not the audit's earlier snapshot).

**Built `scripts/tier1-warm-review-resolution.ts`** (committed, permanent — same conventions as
`tier1-warm-audit.ts`/`tracker.ts`: header-name/org-name resolution, dry-run-by-default,
`--write` flag, before/after print, verify-after-write).

**Discrepancy caught by re-verifying before writing, per the standing habit — do not assume a
described live edit landed:** Tej's resolution stated he'd already unchecked `Warm Lead?` live
on four rows (EY, Google Cloud, Greater Vancouver Board of Trade, Vancity). A fresh read found
three of the four true (EY, Google Cloud, Vancity all `Warm Lead?=FALSE`), but **Greater
Vancouver Board of Trade still read `Warm Lead?=TRUE`**, contradicting the premise. **Held
entirely — no write to that row's `Outreach Tier`, `Status`, or `Warm Lead?` this pass.**
Flagging it and writing `Outreach Tier: Tier 1` while `Warm Lead?` still reads TRUE would have
recreated exactly the problem the original audit existed to fix. Confirmed to still be TRUE
after this run.

**Written for real (`--write`), verified by fresh read after:**
- **EY** — `Outreach Tier: Warm → Tier 1`. `Status` already `Drafted — awaiting approval`
  (matches target — no write needed). `Warm Lead?=FALSE`/`VSW=FALSE` confirmed, doc untouched.
- **Google Cloud** — `Outreach Tier: Warm → Tier 1`. `VSW` left untouched at `TRUE` (real 2025
  sponsor; Tej is sourcing a new contact there — "building a new relationship," his words).
  `Status: Drafted — awaiting approval → Enriched` (a deliberate backward move in the lifecycle,
  not the auto-advance script — held because the doc's existing cold LinkedIn draft is now
  factually wrong and unfit for Andrew until revised). Appended one `Notes` entry (existing
  three-paragraph contact-sourcing history preserved verbatim, nothing overwritten):
  `[2026-07-21] Past sponsor (2025), new contact being sourced per Tej — existing LinkedIn draft
  needs revision to acknowledge history while framing a new relationship; not yet revised in doc.`
  **Drafted replacement LinkedIn connection note** (284/300 chars, handed to Tej to paste in
  himself — this script has no Docs write access and did not touch the doc), built only from
  facts already on the row (VSW=TRUE, the Notes contact-sourcing history, and the existing
  `Their Initiative`/`LI Short Hook` cell "the Google for Startups Cloud Program") and
  deliberately avoiding "we've been following you" framing per the row's own `VSW Alignment`
  cell ("This is a RENEWAL, not a cold approach"):
  > Hi [First name], I'm Vivian, co-chair of Vancouver Startup Week. Google Cloud sponsored us
  > in 2025, and I'm keen to build a direct relationship with you as we plan our next edition.
  > The Google for Startups Cloud Program lines up well with our founder community — open to a
  > quick chat?
- **Vancity** — `Outreach Tier: Warm → Tier 1`. `Status` already `Drafted — awaiting approval`
  (no write needed). Both doc copies (main-batch + LinkedIn appendix) left untouched — Tej
  confirmed directly nothing needs deleting here.
- **Version One Ventures** — `Warm Lead?: TRUE → FALSE` (Tej had not said he'd already unchecked
  this one, unlike the other three; per his confirmed practical resolution — proceed cold/Tier 1
  regardless of the checkbox — this script unchecked it as part of the write). `Outreach Tier:
  Warm → Tier 1`. `Status` already `Drafted — awaiting approval` (no write needed). Cold draft
  (both copies) left untouched; no Notes entry written, per Tej's explicit instruction that he'll
  add his own note about the Sanket/Boris angle.
- **Voyager Capital** — confirmed warm, stays as-is: `Outreach Tier` NOT flipped (remains `Warm`),
  `Warm Lead?`/`VSW` NOT touched. `Status: Drafted — awaiting approval → Enriched` (backward,
  deliberate) — the drafts doc still has the bad main-batch generic-cold copy sitting alongside
  the already-rewritten good alphabetized copy, so `Status` shouldn't read `Drafted` yet.
  **Doc-deletion instruction for Tej (this script cannot edit the Doc):** delete ONLY the
  main-batch generic-cold copy — heading `# Voyager Capital — Email B / chair@` (the FIRST
  occurrence of that heading in doc order), through but NOT including the next heading
  `# A100 — Email A / chair@`. Do NOT touch the alphabetized/bookmarked copy under
  `# *Voyager Capital` (through `# Yaletown Partners`) — already hand-rewritten into a warm
  re-engagement tone referencing the 2020/2021 sponsorship; that's the one to use. Once deleted,
  `Status` can reasonably move to `Drafted — awaiting approval` by hand.
- **The Forum** — verify-only, no changes requested or made: `Outreach Tier` confirmed still
  `Warm`, `Status` confirmed still `Enriched`.

**Verified after write, fresh read:** all 8 planned cell writes landed correctly (2 `Outreach
Tier`, 2 `Status`, 1 `Warm Lead?`, 1 `Notes` append, plus EY/Vancity/Version One's `Outreach
Tier` flips — 3 of the 5 action rows needed no `Status` write since it already matched target).
**Live Tier 1 count: 29** (25 already-true-cold + 4 flipped back this pass: EY, Google Cloud,
Vancity, Version One Ventures — one short of the 30 originally expected, because Greater
Vancouver Board of Trade is held pending Tej resolving the `Warm Lead?` discrepancy above).
**Live Warm count: 3** (Greater Vancouver Board of Trade, The Forum, Voyager Capital) — expected
2 once GVBOT is resolved and flips back to Tier 1.

Throwaway recon scripts (`check_warm7_tmp.ts`, `check_gc_tmp.ts`, `check_verify_tmp.ts`) run via
`npx tsx` and deleted, not committed.

**GVBOT resolved, 2026-07-21 (same day) — deliberately left exactly as-is, no write needed.**
Tej: leave `Outreach Tier="Warm"`, leave `Warm Lead?=TRUE`, leave the existing outreach fields
(`Status="Drafted — awaiting approval"`, Draft Link, contact) filled in and untouched. He will
reach out to Andrew manually to ask whether Andrew knows a contact there; only if Andrew does will
this get actioned further. **Until then, treat it operationally as cold** (the existing cold draft
in the shared doc is fine to proceed with as-is) **while the sheet keeps recording it as warm** —
a deliberate, temporary mismatch between the tracked state (`Warm`, for bookkeeping/audit
correctness) and the practical action (proceed cold, pending Andrew's answer), not an error to
reconcile. Verified live: this row already matched every part of that description with zero
writes required. **Live Tier 1 count stays 29, Warm count stays 3** — both final for this thread;
do not re-flag GVBOT in a future warm-lead pass without checking this entry first.

### 2026-07-21 (Tier 1 → Tier 2 rebalance) — Tier 1 cut to 20, 3 dead/blocked rows cleared entirely, 6 moved to Tier 2

Andrew's target: Tier 1 = 20 cold leads, Tier 2 = 50 cold leads, both tiers only real cold leads.
Tier 1 sat at 29 (post warm-review-resolution above). Full reasoning + the per-row standing table
live in `docs/tier1-to-tier2-handoff.md` — this entry just logs what got executed.

**Built `scripts/tier1-tier2-rebalance.ts`** (committed, same conventions: header-name/org-name
resolution, dry-run-by-default, `--write` flag, before/after print, verify-after-write; also
guards each write by re-checking the row is still `Outreach Tier="Tier 1"` immediately before
touching it, so it can't clobber an unexpected live edit).

**Tej's decision, two parts:**
1. **3 rows cleared out of the tier rotation entirely** — `Outreach Tier` set to blank, not moved
   to Tier 2, not held anywhere: `Coast Capital Venture Connection` (Archived, program died 2024),
   `Vancouver Economic Commission` (Archived, "does not exist anymore"), `Province of British
   Columbia` (Blocked, too broad — stays available for the separate department-breakdown work in
   `docs/broad-org-breakdown-candidates.md`). None of these are real cold leads; they don't belong
   in either tier's count.
2. **6 rows moved `Tier 1 → Tier 2`**: `A100`, `Graphite Ventures`, `Northleaf Capital Partners`,
   `The Syndicate`, `Vanedge Capital`, `Yaletown Partners` — the weakest/most redundant of an
   original 9-candidate list (Tier 1 was 54% VC firms), after holding back 3 stronger candidates
   in Tier 1 instead (`Valhalla Private Capital` — Grant Lawrence is a Co-Founder-level contact;
   `Kensington Capital Partners` — Director-level, $2.3B+ AUM documented; `Top Down Ventures` — a
   literal "Head of...Strategic Partnerships" title, externally referenced in CVCA Intelligence
   Q1 2026) to make up for the 3 slots the dead/blocked rows above vacated, landing Tier 1 at
   exactly 20 without needing 9 real leads to move.

**Written (`--write`), verified by fresh read after:** all 9 planned cells landed. **Live counts:
Tier 1 = 20 (zero dead/blocked rows left in it — all 20 are genuinely active, `Ready?=TRUE`,
`Status=Drafted — awaiting approval` or better), Tier 2 = 56** (50 + 6, awaiting its own separate
6-for-6 swap into a tentative Tier 3 hold to land back at net 50 — not done in this pass; depends
on Tier 2's own current composition/priorities). `Warm` (3) and `Tier 5` (3) unaffected.

**Handoff finalized:** `docs/tier1-to-tier2-handoff.md` updated to reflect the executed state (was
previously a proposal) — ready for Tej to send to whichever process manages Tier 2 next.

### 2026-07-21 (Tier 2 → Tier 3 rebalance) — Tier 2 cut back to 50, 6 rows parked in a new tentative Tier 3

Closes the open item from the handoff doc above: "The Tier 2 side still needs to independently
select 6 of its own existing Tier 2 rows to drop into a tentative Tier 3 hold, landing Tier 2
back at net 50." Tier 2 sat at 56 (its prior 50 + the 6 adopted from Tier 1 in the entry above)
post-rebalance. This pass only touches Tier 2's own pre-existing rows — none of the 6 rows
adopted from Tier 1 were candidates.

**Fresh live read first** (per the standing habit — don't trust an earlier session's notes):
confirmed Tier 2 at exactly 56 live before making any selection, and pulled `Why Them`, `Notes`,
`Primary/Secondary Contact Name/Title`, `Outreach Route`, `Named Contact?`, `Status`, `Ready?` for
every row to re-verify (not assume) which flagged issues from an earlier session's context still
held.

**Selected 6 to demote to `Outreach Tier="Tier 3"` (a tentative hold — this repo has no
established Tier 3 methodology yet, so this is parking only, not a curated shortlist):**

- **CFIN** — zero contact of any kind (`Named Contact?=FALSE`, `Outreach Route=Blocked — no
  route`, `Ready?=FALSE`), and it was already the lowest-scored of the 24 approved additions (51
  pts, the replacement after Tej cut "VEF"). Weakest contactability in the tier, no countervailing
  strength.
- **Microsoft** (distinct row from "Microsoft for Startups", which stays in Tier 2) — `Primary
  Contact Name` reads `"John Westworth/"`, a trailing-slash data-entry artifact, not a usable
  name; `Outreach Route=Blocked — no route`; and it duplicates the same parent company as the
  stronger, already-`Ready?=TRUE` "Microsoft for Startups" row — a clean redundancy argument on
  top of the broken contact data.
- **Anthropic** — `Email` cell still literally contains the string `"Anthropic"`, not a real
  address (confirmed bad data, previously flagged twice in this same file's 2026-07-21 entries
  above and still present on fresh read). `Ready?=FALSE`; both named contacts have only one-word
  titles ("Partnerships", "Startups") with no seniority signal. Has a LinkedIn route in principle,
  but the underlying data quality is the problem, not just contactability.
- **AngelList** — `Why Them` is completely blank (not a stub — empty), `Category` blank, `Source
  Type` blank. Despite a genuinely good named contact (Matt Bilotti, Product & Partnerships Lead,
  real personal email), there is zero personalization material to draft outreach copy from —
  the single thinnest evidence row in the tier.
- **Planet Food** — `Why Them` is a one-line stub ("Homegrown company"). Distinct from a pure
  data-thinness problem: Planet Food Technologies was incorporated in Vancouver in early 2025
  (pre-seed stage per its own enrichment note), a genuine size/stage mismatch against the rest of
  the sponsor pool, not just a contactability gap (it has a strong contact — Chief Strategy &
  Operations Officer, real personal email).
- **University of Toronto** — on fresh individual inspection (not called out by name in the prior
  session's context, only bundled into a generic "10 blocked-route rows" list) this turned out to
  be one of the weakest on close look: `Primary Contact Name` holds a stray internal note,
  `"[AD note: see notes at UBC.]"`, not a person's name — functionally zero contact (matches
  `Named Contact?=FALSE`) *and* the field is contaminated with a cross-reference to an unrelated
  institution's row, worse than a clean blank. Combined with `Outreach Route=Blocked — no route`
  and weaker Vancouver/BC relevance than the rest of the tier (evidence is a generic CANSEC
  sponsorship line, not VSW/local-specific), no countervailing strength (not a past sponsor, no
  local tie) tips it into the demote list.

**Flagged rows from the prior session's context that were re-examined and deliberately kept in
Tier 2 instead, because a fresh look found a stronger case than expected:**
- **Mastercard** — the sourced program (Changeworks) is CSR/grants, not a startup-sponsorship
  line, and the primary contact (Changeworks Grants & Partnerships Committee Chair) has no email
  on file. But it has a *second* named contact, Sarah Ely ("Strategic Growth"), a plausible path
  to a differently-framed ask — a fixable copywriting/framing problem, not a fundamentally broken
  lead. Left in Tier 2.
- **Apple TV** — its own `Why Them` still self-flags as "a lower-priority, brand-reach fit... 
  rather than a direct founder-engagement play," but the row is `Ready?=TRUE`/`Status=Sourced`
  with a named, role-relevant contact, and a 2026-07-20 redo pass found a genuinely confirmed,
  rigorously-sourced Vancouver hook (a *Reluctant Traveler with Eugene Levy* episode naming
  Vancouver-born Michael Bublé) after an earlier pass found nothing — real, recent work product
  that would be wasted parking it now. Left in Tier 2.
- **TECHTO** — internal notes flag doubt on its sponsorship budget and (more seriously) that its
  claimed "real Vancouver presence" doesn't hold up under verification (its actual events are
  Toronto/Montreal-based; the only Vancouver signal is a speculative "coming soon" signup form).
  But its contact, Alex Normal, is Founder & Managing Partner — the most senior title of any row
  reviewed in this pass — and the same note recommends reframing the ask (cross-promotion, not a
  cheque) rather than dropping the row. Left in Tier 2, flagged for a corrected Why Them.
- Also reviewed and kept for having stronger-than-expected evidence or a countervailing strength
  despite a blocked route/zero named contact: **Foresight Canada** (repeat VSW sponsor in 2019 and
  2023 — too valuable a relationship to park), **FrontFundr** (real paid sponsorship history, NVBC
  Silver, $7,500+ CAD), **Trulioo** and **Thinkific** (well-evidenced, well-funded Vancouver
  hometown names), **Smythe LLP** (named contact, decade-long Launch Academy relationship,
  self-described in its own `Why Them` as "one of the more reliably warm professional-services
  names on this list"), **Google for Startups** (solid quantified track record, no data-integrity
  problems — a closer call than University of Toronto but left in given only 6 slots).

**Exemption respected:** `The Cansbridge Fellowship` was never a candidate and was not touched —
confirmed live at `Outreach Tier="Tier 2"` before and after this pass, per Tej's explicit
instruction ("you can move any of them into tier 3 except for cansbridge").

**Built `tier2_tier3_demote.ts`** (throwaway, `npx tsx`, deleted after run — same conventions as
`tier1-tier2-rebalance.ts`: header-name/org-name resolution via `readTracker`, dry-run-by-default,
`--write` flag, before/after print, guards each write by re-checking the row is still
`Outreach Tier="Tier 2"` immediately before touching it, and hard-refuses to run at all if the
exempt org is ever present in the demote list). Only the `Outreach Tier` cell was written on each
of the 6 rows — `Status`, contacts, drafts, and all other enrichment fields left exactly as-is,
same discipline as the Tier 1 pass.

**Written (`--write`), verified by fresh read after:** all 6 planned cells landed —
`Outreach Tier: "Tier 2" → "Tier 3"` on CFIN, Microsoft, Anthropic, AngelList, Planet Food,
University of Toronto. **Live counts after: Tier 2 = 50** (net target hit exactly), **Tier 3 = 6**
(a new tier label, first use — tentative hold only). `Tier 1` (20), `Warm` (3), `Tier 5` (3)
unaffected. `The Cansbridge Fellowship` confirmed still `Tier 2`.

Throwaway script `tier2_tier3_demote.ts` run via `npx tsx`, deleted, not committed.

### 2026-07-21 (Tier 2 subtabs created in the Outreach Drafts doc)

Tej asked for a child tab under the doc's existing `Tier 2` tab for each of the 50 Tier 2
organizations, mirroring the existing structure under `Tier 1` (one subtab per org, meant to hold
that org's outreach copy once drafted) — Delivery Google Doc
`1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk` (docs/outreach-copy-playbook.md's canonical doc).

- **Confirmed via a live `documents.get({ includeTabsContent: true })` read that "tabs" here means
  the real Google Docs Tabs feature** (separate content streams, shown in the left sidebar), not
  headings — the doc has 3 root tabs (`Tier 1` with 20 org children, `Tier 2` with 0, `Archive` with
  a mix of org and misc children) confirmed by reading the tab tree, not assumed.
- **Confirmed the Docs API supports tab creation:** `Schema$AddDocumentTabRequest` (`tabProperties:
  {title, parentTabId, index}`) exists in `googleapis`'s docs v1 types and works via
  `documents.batchUpdate`. **No move/rename operation exists for tabs** (no
  `UpdateTabPropertiesRequest` in the API) — only add and delete.
- **Tab titles are unique document-wide, not just within a parent** — the first `--write` attempt
  429'd on `addDocumentTab` with "Tab title must be unique." Diagnosed by walking the full tab tree:
  5 of the 50 Tier 2 orgs (A100, Graphite Ventures, Northleaf Capital Partners, Vanedge Capital,
  Yaletown Partners — the same 5 of the 6 orgs moved from Tier 1 into Tier 2 earlier today, see the
  Tier 1→Tier 2 rebalance entry above) already have a tab, sitting under `Archive`.
- **Read those 5 tabs' actual content before deciding anything** — all 5 contain real, finished
  outreach-email drafts (recipient, contact, route, the rendered `[initiative]`/`[goal]` clauses,
  sources), written while these orgs were still Tier 1 candidates. Since the API can't move a tab
  and deleting+recreating would destroy that drafted content, **left all 5 exactly where they are**
  rather than deleting or working around the uniqueness constraint with an off-pattern title.
  **Flagged to Tej instead: these 5 need a manual drag from `Archive` to `Tier 2` in the Docs UI**
  (the API can't do it, but the UI's tab panel supports drag-and-drop reparenting) — until that
  happens they simply won't show up as `Tier 2` children even though the sheet already tiers them
  correctly.
- **Created the other 45 as new, empty child tabs under `Tier 2`**, alphabetically ordered (matching
  the existing `Tier 1` convention), via 3 chunked `batchUpdate` calls (20/20/5 requests — kept well
  under any request-size limit rather than assuming one 50-request call was safe). Read the doc back
  afterward and confirmed all 45 titles present under the `Tier 2` parent tab.
- No content was written into any of the 45 new tabs — they're empty, ready for outreach copy next,
  same as this doc's `Tier 1` subtabs were before drafting started.
- Throwaway scripts (`inspect_doc.ts`, `inspect_archive_tabs.ts`, `create_tier2_tabs.ts`) run via
  `npx tsx` and deleted, not committed.

**Closed out same day:** Tej manually dragged the 5 flagged tabs (A100, Graphite Ventures,
Northleaf Capital Partners, Vanedge Capital, Yaletown Partners) from `Archive` to `Tier 2` in the
Docs UI. Verified live via a fresh `documents.get({ includeTabsContent: true })` read cross-checked
against the sheet's live Tier 2 membership: **all 50 Tier 2 orgs now have a matching subtab under
the doc's `Tier 2` tab, no missing, no unexpected extras**, and the 5 dragged tabs no longer appear
under `Archive` (their drafted content moved with them, unaffected by the reparent). `Archive` now
holds only non-org tabs (`Batch 1 LinkedIn Msgs`, `Tab 1`, `Greater Vancouver Board of Trade`,
`The Forum`, `National Bank`, `*Voyager Capital`). Tier 2's doc-side scaffolding is done — ready for
outreach copy to be written into each subtab next.

### 2026-07-21 (Draft Link backfill — all 70 Tier 1 + Tier 2 orgs)

Closes out the Draft Link backfill following the tab-creation work above and the AWS/Absolute
Software spot check (both confirmed live by Tej to correctly jump to the right tab when clicked).
Every Tier 1 and Tier 2 org's `Draft Link` cell in `master-prospects` now holds the correct
tab-based URL, `https://docs.google.com/document/d/1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk/edit?tab=<tabId>`,
replacing stale `.../edit#heading=h.xxx` links left over from the old single-body-document render
(most Tier 1 rows had these; most Tier 2 rows were simply blank, except Absolute Software which
was already correct).

**Fresh live read first, per the standing habit:** re-confirmed the live tier counts before
assuming the task scope — `Outreach Tier="Tier 1"` = 20, `="Tier 2"` = 50, exactly the 70 expected
from the brief (matches the counts landed by the Tier 1↔Tier 2 rebalance entries earlier the same
day). No drift since those passes.

**Matching approach (in order: exact → case-insensitive → known exceptions → refuse to guess),
run against a fresh `documents.get({ includeTabsContent: true })` read of the Doc's full tab tree
(79 tabs total: the 70 org tabs + 3 root tabs `Tier 1`/`Tier 2`/`Archive` + 6 misc `Archive`
children)):**
- **68 of 70 matched on exact title.** No ambiguous exact-title collisions (checked — e.g. the
  Doc's `Archive` tab holds a separate `National Bank` tab distinct from the Tier 1 org
  `National Bank of Canada`, which matched its own like-named tab cleanly; no collision risk).
- **1 matched case-insensitive:** `Zendesk Startups` (sheet) → `ZenDesk Startups` (tab) —
  verified this capitalization mismatch is still live, not fixed since it was flagged as
  something to check in the brief.
- **2 matched via the known exceptions, both re-verified still accurate:**
  `CVCA — Canadian Venture Capital & Private Equity Association` → tab `CVCA`; `Version One
  Ventures` → tab `*Version One Ventures` (leading asterisk).
- **0 unmatched.** No org required fuzzy/substring matching or a guess — every one of the 70
  resolved with high confidence under the ordered rules above.

**Built `draft_link_backfill.ts`** (throwaway, `npx tsx`, deleted after run — same conventions as
the tier-rebalance scripts: `readTracker`/`t.letter("Draft Link")` resolved fresh at write time
rather than hardcoded, dry-run printed the full match list + a separate unmatched list before any
write, `--write` flag gated the actual write, batched via one `values.batchUpdate` call with
`USER_ENTERED`, verified every written cell by fresh read-back afterward).

**Written (`--write`), verified by fresh read-back:** all 70 `Draft Link` cells landed exactly as
constructed — **70/70 verified**, zero mismatches. Only rows already confirmed `Outreach
Tier="Tier 1"` or `="Tier 2"` on the fresh read were ever included in the write batch, so no
`Tier 3`, blank-tier, `Warm`, or `Tier 5` row was touched (e.g. `Voyager Capital` and `The Forum`,
both `Warm`, correctly excluded; the `Tier 3` sextet from the demote pass above correctly
excluded).

### 2026-07-21 (`Outreach Route` converted from live formula to manual dropdown)

Per Tej: he wants `Outreach Route` to be a deliberate decision he makes per row — a personal
checklist for "this is ready to draft against" and a guarantee to anyone else on the sheet that
the listed route is the *chosen* one, not whatever a formula happened to pick when a row had more
than one workable option (e.g. both a personal email and a LinkedIn URL).

- **`Ready?` explained first** (Tej asked): `=IF(LEFT($BT,7)="Blocked", FALSE, AND(Their
  Initiative<>"", Their Goal<>""))` — TRUE when the row has a non-blocked route AND both
  personalization clauses filled. Feeds `scripts/advance-status.ts`'s `Enriched` derivation.
- **Confirmed `scripts/advance-status.ts` already covers the "status auto-advance as a script"
  half of the ask** — it was never live/scheduled, only runs on demand (`--write` to apply), and
  reads `Outreach Route` by header name, so converting the column to manual text required zero
  changes there.
- **Converted `Outreach Route` (BT) from its live `IFS` formula to a strict dropdown**, 9 options:
  `Email — personal`, `Email — personal (secondary)`, `Email — shared inbox`, `LinkedIn`,
  `Warm — via Andrew`, `Warm — via Viv`, `Warm — via Holden`, `Warm — via Tej`,
  `Blocked — no route` — per Tej, keeping one explicit warm option per relationship-holder rather
  than a generic `Warm` catch-all, even though the person's name already lives in `Warm Lead
  Person`.
- **Seeding:** dry-run first (`route_manual_dryrun.ts`) split all 393 data rows by `Status` index —
  **30 rows already at `Drafted — awaiting approval` or later** (27 Drafted, 3 Archived) kept
  their formula-computed value as the starting manual value, since a real draft (or an archive
  decision) already exists against that route; all 30 values matched the new 9-option enum cleanly,
  no leftover trailing whitespace or dual-person edge cases in this preserved set. **The other 363
  rows were left blank** per Tej's explicit call — no inherited default, he chooses each one.
- **Updated `Ready?` (BU)** to also treat a blank route as not-ready (previously only checked for
  `Blocked`, which would have let a row with filled clauses but no *chosen* route read `Ready?=TRUE`
  now that blank is the common starting state): `=IF(OR($BT{row}="",LEFT($BT{row},7)="Blocked"),
  FALSE,AND($BO{row}<>"",$BP{row}<>""))`, rewritten for all 393 rows.
- **Updated the two docs that described the old formula behaviour** —
  [outreach-copy-playbook.md](outreach-copy-playbook.md) (route field description, `Ready?`
  formula) and [org-goals-enrichment-model.md](org-goals-enrichment-model.md) (final field set
  table, the "states 1–5 advance themselves" section) — so neither still tells a future reader
  "don't hand-edit, it's a formula."
- **Written (`--write`), verified by fresh read-back** against 4 spot-check orgs (A100, AWS,
  Zendesk Startups, Musqueam Indian Band — all correct) plus one blanked-row check (AbCellera —
  confirmed empty). Throwaway scripts (`route_manual_dryrun.ts`, `route_manual_write.ts`) run via
  `npx tsx` and deleted, not committed.

Throwaway script `draft_link_backfill.ts` run via `npx tsx`, deleted, not committed.

### 2026-07-21 (Smythe LLP — contact identification, "Ben Capps" replaced)

Tej asked for the right contact at Smythe LLP (row 313, Category `Professional services`,
`Outreach Tier` = Tier 2), starting from a placeholder `Primary Contact Name` of "Ben Capps" with
Title/Email/LinkedIn all blank and nobody having verified who he was or whether he fit.

**Fresh live read first, per the standing habit:** by the time this ran, `Primary Contact Name`
was already blank (Tej had evidently cleared it and reset `Status` back to `Sourced` from
`Contact identified` sometime after the brief was written) — confirms the write below filled a
blank field rather than overwriting existing data.

**Ben Capps — checked, real and current, but not the right fit.** Confirmed via
`https://www.smythecpa.com/about-us/teams/` → his own bio page
`https://www.smythecpa.com/team-member/ben-capps/`: Partner, Accounting & Assurance Group, leads
the Real Estate & Construction niche group, community involvement is Treasurer of Heritage BC and
a director at North Shore Community Foundation — real, current, but nothing tying him to
startups/tech/community sponsorship. Not a match for what this project needs.

**Independent search for a better-fit person (per the brief's step 2) surfaced Camellia Ho.**
Web search for Smythe + "emerging companies"/startup practice turned up
`https://www.launchacademy.ca/smythellp-and-launch-fostering-innovation-in-vancouver-tech-ecosystem/`
(Dec 15, 2023): Camellia Ho, Partner and Leader of Smythe's Technology Industry Group, is the
named Smythe contact running mentorship for Launch Academy's Maple Program, part of a 10+ year
Smythe–Launch partnership (Maple Program, LaunchPad Program, Launch Builders event sponsorship).
Notably, **Launch Academy's own sponsor page is this row's existing Source Link**
(`https://www.launchacademy.ca/sponsor/`) — Camellia is the actual person behind that
relationship. Cross-checked directly against her own Smythe bio page
`https://www.smythecpa.com/team-member/camellia-ho/`: Partner, Leader of the Technology Industry
Group and of Cloud Accounting, works with startups on "reporting, tax, and control frameworks
that position them for growth," active with BC Tech and the Vancouver Entrepreneurs Forum.
LinkedIn confirmed on the same bio page: `https://www.linkedin.com/in/camellia-ho-04273a24/`.
This is a textbook match for the brief's definition of "the right contact" (partner explicitly
tied to community/startup engagement, not a random practice-area partner) — a clearly stronger
fit than Ben Capps.

**Checked for a dedicated marketing/BD/community role too** (per the brief's step 2) — the full
team page (`/about-us/teams/`) has no title containing "Marketing," "Business Development,"
"Communications," or "Community" among 95+ listed members; those roles exist at Smythe
(newsroom coverage found a `Marketing & Communications Manager` and separate `Marketing
Coordinator`/`Marketing Manager` hires over the years) but aren't surfaced on the public team
page, and none of them carry Camellia's direct, named tie to the startup/tech community or to
this row's own Source Link — so Camellia Ho is the better primary contact, not a marketing
generalist.

**Email — pattern confirmed on Smythe's own domain, then applied.** No address is published on
either Ben Capps' or Camellia Ho's own bio page. Found the firm's email pattern
(`[first-initial][lastname]@smythecpa.com`) independently confirmed on Smythe's own site: Natasha
Kambo, listed as `Marketing Coordinator` with address `nkambo@smythecpa.com`, published directly
on Smythe's own newsroom page
`https://www.smythecpa.com/newsroom/marketing-communications-us-tax-managers/` (fetched
directly, not from a search snippet or a third-party contact-scraper site). Applied that
confirmed pattern to Camellia Ho as `cho@smythecpa.com` — **flagging this explicitly as
pattern-derived, not an address individually published under her name**, same distinction as the
brief asked for.

**Written (`--write`), verified by fresh read-back** on row 313: `Primary Contact Name` =
"Camellia Ho" (replacing the blanked-out "Ben Capps"), `Title` = "Partner, Technology Industry
Group Leader", `Email` = "cho@smythecpa.com" (pattern-derived, see above), `LinkedIn URL` =
"https://www.linkedin.com/in/camellia-ho-04273a24/" (directly confirmed). `Outreach Route` and
`Status` untouched per the 2026-07-21 manual-dropdown/on-demand-script entry above — left for Tej.
Throwaway scripts `smythe_contact_update.ts` and `smythe_row_check.ts` run via `npx tsx` and
deleted, not committed.

### 2026-07-21 (Thinkific — contact identification, starting from zero)

Tej asked for the right contact at Thinkific (row 347, Category `Tech`, `Outreach Tier` = Tier 2).
Fresh live read confirmed the row was genuinely blank across all contact fields (Primary Contact
Name/Title/Email/LinkedIn URL/Generic Intake Email/Form) — no placeholder to replace, unlike
Smythe LLP.

**Thinkific's own `/press/` page (fetched directly via browser, not a search snippet) publishes
both a role-based press contact and its current leadership team** — `press@thinkific.com` (Press
Inquiries) and `ir@thinkific.com` (Investor Inquiries), plus three named leaders: Greg Smith
(Chief Executive Officer, Co-Founder), Amanda Malko (Chief Revenue Officer, joined from G2/
Mailchimp), and Elise Stribos (Chief People Officer, joined 2025). No dedicated marketing/
community/partnerships-titled role is surfaced on this page or anywhere else checked.

**Searched for a mid-level marketing/community/partnerships contact first, per the brief's step
2 — none found with a clear tie to sponsorship decisions.** Confirmed current: Greg Brauner (VP
Marketing, based in Austin — not Vancouver), Allie Russell (Director of Product Marketing,
Vancouver-based, LinkedIn `ca.linkedin.com/in/allierussell` — real and current since 2021, but
product marketing, not community/events/partnerships). An "Affiliates and Partnerships Manager"
role exists as a job posting but no named current employee in it was found. Miranda Lievers
(the other named founder in the brief) is confirmed **no longer operational** — she transitioned
to an advisory role in 2023 per Thinkific's own investor-relations announcement
(`investors.thinkific.com/news/news-details/2023/Miranda-Lievers-Co-Founder-of-Thinkific-
Transitions-to-Advisory-Role/`) and now runs her own coaching practice; not a viable current
sponsorship contact.

**Recommended: Greg Smith, Co-Founder & CEO** — the brief's own suggested angle, and the
strongest fit given no dedicated community/partnerships role exists. Confirmed current via
Thinkific's own `/press/` page bio (title exactly as above) and independently via his active
LinkedIn (`linkedin.com/in/gregsmith-thinkificceo`, multiple 2026-dated posts, consistent
"Co-Founder & CEO at Thinkific" heading) and his Forbes Technology Council profile. He has a
long public record of Vancouver-ecosystem engagement (BC Tech community calls, Forbes Tech
Council, founder-community interviews going back years) that lines up directly with this row's
own Source Link (BC Tech Technology Impact Awards). Also surfaced in passing: Thinkific has
prior direct VSW history — it co-presented a session at Vancouver Startup Week 2019 (with Osler
and Rhino Ventures) — worth flagging to whoever drafts outreach copy later as a possible
re-engagement angle, though this row's `Warm Lead?` stays `FALSE` since nobody here has an active
relationship with him.

**No personal email confirmed or written.** No firstname/lastname-pattern `@thinkific.com`
address is published anywhere under any employee's name (only the two role-based addresses
above) — there is nothing to safely derive a pattern from, unlike the Smythe LLP precedent, so
`Email` was left blank rather than guessed.

**Written (`--write`), verified by fresh read-back** on row 347: `Primary Contact Name` = "Greg
Smith", `Title` = "Co-Founder & CEO", `LinkedIn URL` =
"https://www.linkedin.com/in/gregsmith-thinkificceo/" (directly confirmed), `Generic Intake
Email/Form` = "press@thinkific.com" (directly published on Thinkific's own press page — kept as
a fallback route alongside the named contact). `Email` left blank (unconfirmed, not guessed).
`Outreach Route` and `Status` untouched by this write — left for Tej per the 2026-07-21
manual-dropdown/on-demand-script entry above. Note: `Status` was observed to read "Route
identified" on the post-write read-back despite `Outreach Route` still being blank, which is not
something this write caused (only N/O/Q/`Generic Intake Email/Form` columns were touched) and
doesn't match `advance-status.ts`'s own derivation logic for that state — most likely a separate,
concurrent manual edit by Tej; flagged here rather than silently normalized. Throwaway script
`thinkific_contact_update.ts` (plus a header-name lookup helper) run via `npx tsx` and deleted,
not committed.

**Correction, same day:** the "Route identified"-despite-blank-route pattern above is not a
concurrent edit — it's a direct, sheet-wide side effect of the `Outreach Route` formula→dropdown
conversion earlier the same day. Any row whose `Status` was already at "Route identified" or
"Enriched" *before* the conversion (earned by the old formula) is now stale relative to its
freshly-blanked route, and `scripts/advance-status.ts` won't correct it — it only ever moves
`Status` forward, by design, so it can't walk a row back down even when the thing that justified
the forward move is gone. Likely affects more than just Thinkific; flagged to Tej, no fix applied
yet pending his call on whether to run a one-time corrective pass.

### 2026-07-21 (Trulioo — primary/secondary contact, Tej's tie-break)

Tej asked for the right contact at Trulioo (row 354, Category `Tech`, `Outreach Tier` = Tier 2).
Fresh live read confirmed the row was genuinely blank across all contact fields, same starting
point as Thinkific.

**Trulioo currently has no CMO/Head of Marketing.** Dawn Crew, Trulioo's first-ever CMO (appointed
April 2022), is confirmed absent from Trulioo's own live Leadership page
(`trulioo.com/company/leadership`, fetched fresh) — and Trulioo has an *open* "Head of Marketing"
requisition (MaRS job board, posted 2026-03-26, Vancouver) explicitly describing the hire as
someone who will "build and lead" the marketing org, i.e. no successor has been placed yet.

**Correct function identified via a real, since-closed Trulioo job posting**
(techjobs.marsdd.com/companies/trulioo/jobs/36566276): "Event Marketing Manager" explicitly owns
"sponsorship logistics" as a core responsibility — the right functional target for VSW-style
outreach.

**Two current people hold that exact title; the agent couldn't independently break the tie** —
LinkedIn blocked direct profile reads both times (HTTP 999 anti-bot), so both candidates are only
aggregator-corroborated (RocketReach/ZoomInfo/search snippets), weaker than the Smythe/Thinkific
precedent of a directly-loaded bio page:
- **Angelika Kadzielska** — Event Marketing Manager, Vancouver. Stronger independent
  corroboration: tied to Trulioo's Money20/20 USA sponsorship ("5 Star Sponsor"), plus conference
  speaker/panel appearances (DigiMarCon Canada West, VIATEC AI Meetup).
- **Alanna Brokop** — "Manager, Event Marketing," Vancouver, prior roles at Jobber and Canadian
  Tire.

**No usable email either way** — only generic role-based aliases are published on Trulioo's own
domain (`media@trulioo.com`, `sales@`, `support@`, confirmed via BC Tech's member directory and
recurring press-release syndication); no individually-published `@trulioo.com` address exists
anywhere to derive a real pattern from (unlike Smythe's `nkambo@smythecpa.com` precedent), so none
was written or guessed.

**Tej's call: Angelika as primary, Alanna as secondary** — both titles kept exactly as sourced
above (secondary matches her actual title, "Manager, Event Marketing," not force-normalized to
match Angelika's). **Written (`--write`), verified by fresh read-back** on row 354:
`Primary Contact Name` = "Angelika Kadzielska", `Title` = "Event Marketing Manager",
`Secondary Contact Name` = "Alanna Brokop", `Secondary Contact Title` = "Manager, Event
Marketing". `Email`, `LinkedIn URL`, `Secondary Contact LinkedIn`, `Secondary Contact Email`,
`Outreach Route`, and `Status` all left untouched — no confirmed email/LinkedIn exists for either
person, and route/status are Tej's per the 2026-07-21 manual-dropdown entry. Throwaway script
`trulioo_write.ts` run via `npx tsx` and deleted, not committed.

### 2026-07-22 (Andrew-approval Slack sync — attempted, reverted; dead end documented)

Tej wanted Andrew to review outreach copy directly in the Outreach Drafts doc — an Approve /
Revisions Needed choice plus a comments field per org subtab — and have Tej trigger a Slack bot
command (`@bot sync AD`) that reads the doc and writes the result into two new
`master-prospects` columns. Built most of it, then **scrapped and fully reverted** it once the
core interaction mechanism turned out not to be buildable. Recording this so nobody re-attempts
the same dead end.

**What was built, then undone:**
- Two new sheet columns, `Outreach Copy AD Approval Status` (strict dropdown, `Approve` /
  `Revisions Needed`) and `Outreach Copy AD Comments` — added, then deleted via `deleteDimension`
  once the feature was scrapped. Verified gone by fresh read-back (both header lookups return
  `undefined`).
- A plain-text `Approval: [Approve / Revisions Needed]` / `Comments:` block inserted at the end
  of all 70 Tier 1 + Tier 2 org subtabs in the Outreach Drafts doc (same tab-matching logic as
  the Draft Link backfill — 70/70 matched cleanly). Tej then asked for the block moved to the
  top, converted to a table, and for the approval field to be a real dropdown chip — that's when
  the dead end below surfaced. All 70 blocks were subsequently located and removed via
  `deleteContentRange`, verified clean by fresh read-back (0 tabs still containing `Approval:`).
- `src/types.ts`: added `AD_APPROVAL_STATUS_ENUM`/`AdApprovalStatus` and extended
  `MASTER_FIELD_KEYS` with the two new keys, so the Slack command could write through the
  existing `updateMasterFields` structurally-scoped path (golden rule #1) rather than opening a
  new unrestricted write route. Reverted before ever touching `src/sheets.ts`'s
  `MASTER_FIELD_COLUMNS` map or wiring anything into `router.ts`/`index.ts` — no deployed-service
  code ever changed; `git status` on `src/` confirmed clean after the revert.

**The dead end, confirmed empirically, not assumed:** neither a native Google Docs dropdown chip
nor a native checklist checkbox is exposed by the Docs API in any form.
- Grepped the vendored `googleapis` Docs v1 type definitions for "dropdown" and "chip" — the only
  chip-like types that exist are `RichLink` (Drive file links) and `PersonProperties`
  (@mention chips). Nothing models a dropdown.
- For checkboxes: created a real checklist (`createParagraphBullets` with `bulletPreset:
  "BULLET_CHECKBOX"`) in a throwaway test tab, asked Tej to click one of the two items live in
  the doc, then re-fetched via `documents.get`. **Zero difference anywhere** — the checked
  item's `textRun.textStyle` was still `{}`, the paragraph's `bullet` object was unchanged, and
  the document's `lists` map had no per-item checked state at all. The bullet's `glyphType` had
  come back as `GLYPH_TYPE_UNSPECIFIED` even before the click, suggesting what rendered may not
  even have been a true interactive checkbox. Either way: nothing "clickable" in Google Docs
  survives a `documents.get` round-trip in a form the API can read. Test tab deleted after.
- Also checked "custom building blocks" (Insert → Building blocks) per Tej's question — zero
  API surface (`grep -i buildingblock` on the same type defs: no hits). Purely a client/editor
  feature, not something that can be created or read via the API at all.

**Tej's call once the constraint was clear:** the only remaining reliable mechanism was a plain
table cell Andrew types into directly (no native picker) — Tej said no, drop the idea entirely,
and clear every edit made toward it. Done, verified above. **If this comes up again:** any
future design needs a text-based input (typed word, or a Google Form feeding a sheet directly),
not a native Docs interactive widget — none of them round-trip through the API.

### 2026-07-22 (Tier 2 enrichment batch — 20 orgs, one agent each)

Tej asked for the 20 remaining un-enriched Tier 2 orgs to each be enriched, run as 20 parallel
agents (one org per agent), each briefed to: read the row live for context first, deep-scrape the
org's own domain (never open-web search), verify rather than paste `Why Them` (unverified budget
note, previously wrong on KPMG's Cyprus lab), write `Their Initiative`/`Their Goal`/
`Personalization Source`/`VSW Alignment`/`LI Short Hook` (LinkedIn-routed rows only) via a
throwaway per-org `.ts` script, verify by fresh read-back, and report a log paragraph back rather
than touch PLAN.md or `scripts/advance-status.ts` directly (avoiding 20-way write collisions on
this file and on the sheet-wide status pass). All 20 finished; log entries below, consolidated and
appended in one pass afterward. `scripts/advance-status.ts --write` and
`scripts/run-report.ts Tier 2` were then run once, by hand, after every org completed.

**Result: 18 of 20 enriched, 1 blocked by design (no genuine hook), 1 (this section's header
count) — see Metro Vancouver below for the exception.** One process note: the original batch of
20 Agent calls only actually launched 18 — Trulioo and Wealthsimple were dropped when the tool
calls were composed and had to be caught and launched in a second pass after Tej asked "are they
all done?" prompted a recount. No sheet writes were affected; the gap was caught before either
row was touched.

#### Alumni Ventures (row 16, Category `VC`, `Outreach Route` = Email/Generic Inbox)

Confirmed the target is Alumni Ventures Group (avgfunds.com → av.vc, "America's Largest Venture
Firm For Individual Investors"), not a university-run alumni-relations namesake — deep-scraped
`av.vc/av-funds`, which surfaced the firm's distinctive, verifiable hook: 20 school-branded
venture funds sourced through university alumni networks (Green D Ventures/Dartmouth, Blue Ivy
Ventures/Yale, Chestnut Street Ventures/Penn, etc.), each with an independent Investment Committee
and no minimum school-related-deal quota. `av.vc/about` supplied the firm's own stated mission —
"to grow, engage and learn with an inclusive community of stakeholders to create difference-making
ventures" — used to derive `Their Goal`. Cross-checked the existing `Why Them`/Source Link claim
that Alumni Ventures "partners with Web Summit": confirmed on Web Summit's own event page, which
lists them with a "PARTNER" designation — that claim held up, so it's cited (not as
Personalization Source, just supporting context) in `VSW Alignment`. Wrote `Their Initiative`
("your 20 school-branded venture funds"), `Their Goal` ("growing an inclusive community of
stakeholders to create difference-making ventures"), `Personalization Source`
(av.vc/about | av.vc/av-funds), and `VSW Alignment` (network-as-deal-flow thesis vs. VSW's founder
room, explicitly noting no evident Vancouver/BC presence so this reads as ecosystem-fit not local,
closing with a peer-to-peer/community tone directive). `LI Short Hook` left blank — route is
email, not LinkedIn. Dry-run-then-write via a throwaway script, read back and confirmed exact
match; script deleted after.

#### Aon (row 24, Category `Finance`)

`Why Them` cited two startup-adjacent hooks beyond the Inventures 2025 sponsorship (already
verified via `inventurescanada.com/sponsors`, Aon's logo present) — an "Entrepreneurs in
Residence" program and a "Startup Conclave" — both checked directly and both fell apart on
inspection: the EIR program is a dormant 2014 Aon–Springboard 2000 initiative aimed at women-led
businesses with no evidence of ongoing activity, and the Startup Conclave is Aon India's Bengaluru
event (May 2026) focused on IPO-readiness for later-stage Indian startups, unrelated to Canada.
Rather than force either into outreach copy, deep-scraped aon.com directly and found a live,
named, Aon-branded team — the **Digital Economy practice** (`aon.com/digital-economy/`) — that
states outright it supports clients "whether at start-up, scale-up or expansion," not just
enterprise accounts. Wrote `Their Initiative` = "Digital Economy practice", `Their Goal` =
"supporting clients through start-up, scale-up, and expansion", `VSW Alignment` (framing: pitch
this specific practice, not Aon broadly, given the other two hooks don't hold up; no Vancouver/BC
locality claimed since nothing on their site ties the practice there), and `Personalization
Source` = the two aon.com Digital Economy URLs. `LI Short Hook` left blank (`Outreach Route` =
Email (Work), not LinkedIn). All four cells written by header-resolved column, read back live to
confirm exact match. No other columns touched.

#### Aritzia (row 29, Category `Consumer brand` / Fashion retail)

`Why Them` claimed AI/automation/tech-ecosystem investment as the hook; deep-scraped
`investors.aritzia.com` (press releases, investor FAQ, environmental & social pages) and could not
verify a specific named AI/automation program — left that thread unused rather than force it.
Surfaced a genuinely specific, current, locally-relevant hook instead: Aritzia's Q4/FY2026 results
press release (`investors.aritzia.com`, May 7, 2026) confirms a **new distribution centre under
construction in Delta, British Columbia**, alongside CEO Jennifer Wong's own words on the
"Powering Stronger" plan's three growth levers — "geographic expansion, digital growth and
increased brand awareness." Confirmed Vancouver HQ/founding (611 Alexander Street, founded 1984)
directly on Aritzia's own investor FAQ page rather than from memory. Caught a namesake trap:
"Aritzia Community™" is a registered trademark for a handbag line, not a philanthropy initiative —
avoided using it. Wrote `Their Initiative` → "Delta, British Columbia distribution centre";
`Their Goal` → "geographic expansion, digital growth, and increased brand awareness";
`Personalization Source` → the Q4 FY2026 press release + investor FAQ URLs; `VSW Alignment`
framing the Vancouver-founded-to-global trajectory with a "confident, peer-to-peer, not starstruck"
tone directive. `LI Short Hook` left blank (`Outreach Route` = Email, Generic Inbox). Left
`Status`, `Outreach Route`, and all contact fields untouched. Read the row back fresh after
writing to confirm exact values.

#### ATB Financial (row 31, Category `Bank`)

`Why Them`'s framing of the Radical Ventures investment as "recent" checked out as real but stale
(ATB's own press release is dated Jan 25, 2021, not current) — not used as the personalization
hook. Deep-scraped ATB's own domains instead: `atbventures.com` (ATB Ventures, their R&D/
innovation arm) surfaced **Oliu™**, a DIACC-certified digital identity platform ATB built and
ships to organizations (launch article Sept 29, 2022, still actively partnering as of an April
2024 thirdstream™ integration), and `atb.com`'s own newsroom surfaced ATB's Jan 16, 2025 close of
**The51 Food and AgTech Fund**, with CEO Curtis Stange's quote about "empowering the next
generation of AgTech entrepreneurs." Wrote `Their Initiative` = "the Oliu digital identity
platform," `Their Goal` = "giving people ownership and control of their own data" (their own
stated mission for Oliu), `Personalization Source` = the two atb-domain URLs, and a `VSW Alignment`
note framing the hook around ATB's demonstrated product-building and direct founder investment
rather than any BC/Vancouver locality claim (ATB is Alberta-based). `LI Short Hook` left blank —
this row's `Outreach Route` is an email route, not LinkedIn. Grammar-gated programmatically before
writing; read back fresh after write, all four fields matched. `atb.com`'s ATB X Accelerator page
returned an infinite redirect loop via both WebFetch and Firecrawl and couldn't be verified — not
used as a source.

#### ATCO (row 32, Category/Subsector both blank going in, `Outreach Route` = LinkedIn DM)

Category and Subsector were blank going in; `Why Them` and `Primary Contact Name`/`Title` ("Paul
Reynolds, Senior Director, ATCO Ventures") resolved the namesake to ATCO Ltd., the Calgary-based
energy/housing/defence conglomerate — not a different ATCO. Deep-scraped ATCO's own venture
platform (`https://ventures.atco.com/`), which yielded a specific, verifiable named initiative
beyond the generic "ATCO Ventures" umbrella already sitting in `Why Them`: **ATCO EdgeWorks**, a
newly announced program under ATCO Ventures that partners with outside technology providers,
layered on ATCO's modular-construction and energy expertise. Wrote `Their Initiative` = "ATCO
EdgeWorks"; `Their Goal` = "converting innovation into commercial outcomes through venture
building and strategic partnerships" (drawn near-verbatim from the site's own mission language);
`Personalization Source` = `https://ventures.atco.com/`; `VSW Alignment` built around the site's
own "founder-first" framing plus EdgeWorks' external-partner-facing structure, ending in a tone
directive to keep drafting commercially grounded rather than evangelical; `LI Short Hook` = "ATCO
EdgeWorks caught my eye" (28 chars, route = LinkedIn DM). All 5 cells resolved by fresh
header-name lookup, dry-run printed first, then written, then read back and confirmed
exact-match. The known contact-email gap (`Email` cell holds a text note, not an address, logged
2026-07-21) was left exactly as found.

#### Centre for Digital Media (row 75, Category `University`)

Deep-scraped `thecdm.ca` directly (curl on raw HTML, not just a fetch-summarizer, to get exact
quotes) rather than open-web search. Found a specific, own-domain-verified hook on
`https://thecdm.ca/industry`: **Accelerate Innovation**, CDM's structured 12-week
industry-partnership program pairing a multidisciplinary graduate team with a partner org, full IP
ownership retained by the partner, named case studies with Metro Vancouver, Samsung, and Buffalo
Buffalo. Wrote `Their Initiative`="Accelerate Innovation", `Their Goal`="turning ideas into
working prototypes while partners retain full IP ownership", `Personalization
Source`="https://thecdm.ca/industry", `VSW Alignment` noting the Vancouver-based, cross-institution
(UBC/SFU/Emily Carr/BCIT) talent pipeline and that Primary Contact Simran Bedi (Industry &
Partnerships Coordinator) is literally the intake point for this exact program. `LI Short Hook`
left blank — `Outreach Route` is "Email (Generic Inbox)", not LinkedIn. **Flagged a `Why Them`
inaccuracy**: its claim of a "Center for Digital Media Entrepreneurship" coaching freelance/
solo-creator ventures could not be verified anywhere on thecdm.ca; the closest real thing is the
Venture Pitch Option inside MDM's Projects II. Logged that as an appended `Notes` addition
(existing Notes content preserved) rather than silently correcting or reusing the unverified
claim. Confirmed not a past VSW sponsor (`VSW`/`Past VSW Event Partner` both FALSE).

#### Foresight Canada (row 137, Category `Accelerator` / Cleantech)

`Why Them` claimed "Led by CEO Jeanette Jackson" — deep-scraping Foresight's own site
(`foresightcac.com/about`, `/team/david-sanguinetti`) and their own CEO-transition announcement
found this is stale: Jackson moved to board/strategic-advisor in July 2025 and David Sanguinetti
is the current CEO. Left `Why Them` untouched but flagging it here since it's a fact that would be
wrong if quoted to the prospect. The rest of `Why Them` — repeat VSW sponsor in 2019 and 2023, the
Foresight 50 — held up and was independently corroborated by the 2026-07-21 tier-review entry in
this log. Wrote `Their Initiative`="the Foresight 50" (their sixth-annual showcase of Canada's
most investible cleantech ventures, confirmed live and open for 2026 applications through June
30), `Their Goal`="positioning cleantech as Canada's new economic engine" (drawn from their own
2026 Foresight 50 announcement headline/framing), and a `VSW Alignment` note grounding the ask in
the BC-founding (2013) and prior-sponsor history so drafting treats this as a returning-partner
follow-up rather than a cold pitch. `Personalization Source` set to the three foresightcac.com
URLs used. `LI Short Hook` left blank — `Outreach Route` is Email, not LinkedIn.

#### FrontFundr (row 139, Category `Finance`)

Fresh live read first confirmed all five enrichment fields blank. Deep-scraped `frontfundr.com`
directly (the marketing site is a JS SPA — plain fetch returned empty; used the browser tool to
render it) rather than open-web search. `frontfundr.com/canadian-startup-challenge-2026`,
FrontFundr's own initiative page, names a specific, current, non-generic hook: **Back the Next
Canadian Startup Challenge**, a nationwide nomination-and-pitch competition (applications June
1–30, 2026, live pitch early July) that surfaces promising Canadian founders and gives the winner
a funded equity-crowdfunding campaign — independently corroborated by a 2026-07-14 GlobeNewswire
release naming femtherapeutics as the inaugural winner, though that release wasn't used as the
cited source since it's off their own domain. `Their Goal` uses their own mission language from
`frontfundr.com/about-us`: "expand access, drive innovation, and grow Canada's private markets."
Also verified two things in passing: (1) the row's existing `Why Them` sponsorship claim holds up
— FrontFundr is confirmed live as a **Silver Sponsor** on `newventuresbc.com/our-sponsors/`, no
correction needed; (2) the row's `Primary Contact Name`/`Title` ("Trieste Reading, Chief Growth
Officer") independently matches FrontFundr's own team page. `LI Short Hook` left blank —
`Outreach Route` is `Email (Work)`, not LinkedIn.

#### Google for Startups (row 148, Category `Accelerator` / Startup Support)

Distinct from the separate "Google Cloud" row — confirmed no conflation. Deep-scraped
`startup.google.com` and Google's own Canadian newsroom rather than reusing the row's stale `Why
Them` (which cited Africa-accelerator numbers now outdated: 106+/$350M+/3,700 jobs vs. current
~190+/$400M+/~3,500 jobs). Found a specific, Canada-only, own-domain hook: the **Google for
Startups Accelerator: Canada** — a 10-week, equity-free, Seed-to-Series-A AI/ML accelerator —
whose 2026 cohort (announced Mar 10, 2026 on `blog.google/intl/en-ca/`) included a Vancouver
company, **EyeCareX**, and Victoria's MyHealthspan. Wrote `Their Initiative` = "the 2026 Google
for Startups Accelerator: Canada cohort", `Their Goal` = "supporting founders as part of Canada's
innovation ecosystem", `Personalization Source` = the program page + press release, `VSW Alignment`
grounding the ask in the real BC presence (EyeCareX), and `LI Short Hook` = "Google for Startups
Accelerator: Canada" (39/50 chars, `Outreach Route` = LinkedIn DM). Grammar-gated, read back fresh
and confirmed exact match. Flagging the Africa-vs-Canada `Why Them` mix-up, not corrected there.

#### Hiive (row 159, Category `Finance` / Financial services)

Deep-scraped hiive.com directly rather than trusting the row's `Why Them` note. `Why Them` claimed
Hiive is "Vancouver-founded" — confirmed independently via Hiive's own Terms of Use
(`hiive.com/terms`), which lists the registered address of The Hiive Company Limited as 700-980
Howe Street, Vancouver, BC. `hiive.com/our-story` supplied the founder team (Sim Desai, Sarah
Huggins, Stuart Eccles, Prab Rattan) and the company's own mission language: to "centralize,
standardize, and automate liquidity for private companies and their shareholders."
`hiive.com/about` surfaced a genuinely specific, non-boilerplate named feature — the **Hiive50
Index**, an equal-weight price index of the 50 most liquid securities traded on their own
platform. Wrote `Their Initiative` = "your Hiive50 Index"; `Their Goal` = "centralizing,
standardizing, and automating liquidity for private companies and their shareholders";
`VSW Alignment` = Vancouver HQ + founder-audience fit + tone directive; `Personalization Source` =
the three hiive.com URLs used; `LI Short Hook` = "your Hiive50 Index" (19 chars, `Outreach Route`
is LinkedIn DM). Grammar-gated before writing, read back fresh: 5/5 fields matched exactly. No
prior Hiive-specific enrichment or contact research existed in PLAN.md before this entry.

#### LinkedIn (row 204, Category `Tech`, as a sponsor prospect — not the outreach channel)

Row's own `Why Them` flagged that no dedicated LinkedIn startup-sponsorship program had turned up
in an earlier pass — true, but deep-scraping LinkedIn's own domain surfaced a different,
genuinely LinkedIn-specific hook instead: the **Top Startups Canada list**, LinkedIn's own annual,
data-driven ranking of Canada's fastest-growing young companies (privately held, 5 years old or
younger, 30+ employees), based on LinkedIn platform signals. Verified live on LinkedIn's own
domain via the 2023 edition and the official LinkedIn News company post for the 2024 (7th annual)
edition, which quotes LinkedIn describing it as "a data-backed ranking of the 15 emerging
companies that you should be paying attention to right now" — passes the substitutability test
since no competitor platform publishes anything equivalent. Wrote `Their Initiative` = "Top
Startups Canada list", `Their Goal` = "spotlighting Canada's fastest-growing startups and the
talent behind them", `Personalization Source` (both first-party URLs), `VSW Alignment`
(founder/builder-audience framing, tone directive: collaborative and evidence-based, not salesy),
and `LI Short Hook` = "Your Top Startups Canada list" (30/50 chars) — treating `Outreach Route` =
`LinkedIn DM` as qualifying for the short-hook field. Row confirmed distinct from the separate
Microsoft-family rows (e.g. The Coalition); nothing Microsoft-specific was used.

#### lululemon (row 210, Category `Consumer brand`)

Existing `Why Them` claimed a ZymoChem bio-based-nylon collaboration guided by lululemon's
"Science of Feel" platform — checked and factually accurate (confirmed via lululemon's own March
19, 2025 press release), but it's a materials-science B2B partnership, not a community/founder
hook, so it wasn't used as the enrichment source. Instead deep-scraped
`corporate.lululemon.com/our-impact/lululemon-gives` and lululemon's Oct 16, 2025 press release
announcing `lululemon Gives` (the evolution of the Vancouver-launched 2021 "Centre for Social
Impact"), which funds a named **Community Wellbeing Grant** backing community-led wellbeing
organizations, targeting 20M people and $100M USD by 2030. Confirmed Vancouver HQ (1818 Cornwall
Ave) directly from lululemon's own corporate footer. Wrote `Their Initiative` = "Community
Wellbeing Grant", `Their Goal` = "reach 20 million people and contribute $100 million to social
impact organizations by 2030", `VSW Alignment` (flags the Vancouver-roots/grassroots-community
angle over an innovation-fit pitch, tone directive: warm and community-credible, not
sales-forward), `Personalization Source` = the two corporate.lululemon.com URLs, and `LI Short
Hook` = "Vancouver-born brand funding global wellbeing" (`Outreach Route` = LinkedIn DM).

#### Mastercard (row 216, Category `Finance`)

Deep-scraped Mastercard's own domain rather than the existing (unverified) `Why Them` text.
Verified `Start Path` directly on `mastercard.com/global/en/innovation/partner-with-us/
start-path.html`: a live, currently-active global engagement program for later-stage
fintech/payments startups, six tracks, six-month core program — and its own news page shows
genuinely recent named cohort activity (7 companies into Blockchain & Digital Assets, June 2026;
5 into Acceptance, May 2026). Wrote `Their Initiative` = "Start Path", `Their Goal` = "scaling
later-stage fintech and payments startups through strategic partnerships and co-innovation",
`Personalization Source` (both Start Path URLs used), and `VSW Alignment` (framing note directing
future drafting to peer-to-peer innovation-team tone, not corporate-giving). `LI Short Hook` left
blank — `Outreach Route` is `Email (Work, Unverified Format)`, not LinkedIn. **Flag for whoever
drafts from this row:** the on-file contacts (Rebecca Harrison, Sarah Ely) are both
Changeworks/CSR-side per the 2026-07-14 append to `Why Them`, not Start Path — the Start
Path-framed clauses just written may need a different contact before drafting; contact fields left
untouched.

#### Metro Vancouver (row 221, Category `Gov` / Regional Government) — BLOCKED, left blank by design

Deep-scraped metrovancouver.org and cross-checked against investvancouver.ca before writing
anything. Result: **blocked, `Their Initiative`/`Their Goal`/`VSW Alignment`/`Personalization
Source` left blank** — no genuine, externally-facing startup/innovation program exists at the
whole-Metro-Vancouver-government level. Metro Vancouver's verified core mandate is water,
liquid/solid waste, air quality, regional parks, housing, and regional planning (Metro 2050); its
only named "innovation" program, the Sustainability Innovation Fund (est. 2004), is explicitly
staff-only per its own page ("Members of the public, NGOs, and external organizations are not
eligible to apply directly"), so it would be a misleading hook for founder outreach. More
significantly, the row's existing `Why Them` note — the AI/MV Sector Profile 2024 PDF and the
"accelerators... financial support and mentorship" claim — turns out to actually describe **Invest
Vancouver**, not Metro Vancouver: the PDF lives on investvancouver.ca, Invest Vancouver's own
domain, and Invest Vancouver already has its own row in this tracker. Same class of error as the
KPMG/Cyprus miss — a qualification note wrong about which entity it was describing. Logged the
full finding in the row's `Notes` field. **Flag for Tej:** this reinforces
`docs/broad-org-breakdown-candidates.md`'s existing High-confidence call that Metro Vancouver
duplicates Invest Vancouver's territory — the startup-relevant content belongs on that sibling
row, and this Metro Vancouver row may be worth deprioritizing rather than drafting outreach copy
for.

#### Notion (row 248, Category `Tech` / SaaS)

Deep-scraped Notion's own site (`https://www.notion.com/startups`) and confirmed the row's
existing `Why Them` program-level claim independently: "Notion for Startups" offers tiered
discounts up to 6 months free of the Business plan (with Notion AI, stated max value "$12,000 for
100 employees"), gated on eligibility, and Notion explicitly frames the goal as wanting "to help
more companies lay a strong foundation that can grow with them from the beginning." Could **not**
independently verify the `Why Them` note's more specific claim that Notion is currently a Launch
Academy sponsor — the partner page shows only a logo wall, no text-extractable partner list — so
that detail was left out of the written copy fields rather than asserted. Wrote `Their Initiative`
= "Notion for Startups"; `Their Goal` = "help more companies lay a strong foundation that can grow
with them from the beginning"; `Personalization Source` = `notion.com/startups`; `VSW Alignment`
(tone: practical and founder-to-founder, not enterprise-sales); `LI Short Hook` = "Notion for
Startups caught my eye" (33 chars, `Outreach Route` = LinkedIn DM). **Flagged, not acted on:**
`Source Link` still points at a Slack screenshot rather than an org-domain URL.

#### Smythe LLP (row 313, Category `Professional services` / Accounting)

Built on the 2026-07-21 Camellia Ho contact-identification entry, not re-derived from scratch.
Re-verified both source URLs still live and accurate: Launch Academy's page still names Camellia
Ho as running mentorship for the Maple Program (part of the 10+ year Smythe–Launch partnership),
and her own Smythe bio still confirms she leads Smythe's Technology Industry Group and Cloud
Accounting Group and "works closely with startups to establish reporting, tax, and control
frameworks that position them for growth." Also found Smythe's own dedicated Technology Industry
page (`smythecpa.com/industries-we-serve/technology/`, not previously surfaced) — confirms a
"from start-up to exit" tech practice, though it wasn't needed for the written clauses given how
strong the existing sourcing already was. Wrote `Their Initiative` = "the Maple Program
partnership", `Their Goal` = "positioning startups for growth", `Personalization Source` = both
URLs (pipe-separated), `VSW Alignment` = 3 sentences on the decade-long partnership + Camellia's
direct community tie, ending with a peer-not-vendor tone directive. `LI Short Hook` left blank —
`Outreach Route` on this row is `Email (Work, Unverified Format)`. Not a past VSW sponsor
(`VSW`=FALSE), so standard cold-outreach copy applies, not the re-engagement variant. Contact
fields, `Outreach Route`, and `Status` untouched.

#### The Cansbridge Fellowship (row 340, Category `Accelerator` / Fellowship)

Deep-scraped `cansbridgefellowship.com/program` and `/sponsor` rather than relying on the existing
`Why Them` note or its cited third-party source. Found a genuinely specific, named program
component — the **Asia Internship**, a $10,000-scholarship, minimum-10-week self-organized
internship across Asia (Malaysia, Sri Lanka, Indonesia, Japan, Korea, Thailand, India) — plus
their own stated goal language ("knowledge of Asia, entrepreneurial skills, and a strong sense of
purpose") and a verified BC tie (UBC listed as a partner university on their sponsor page). Wrote
`Their Initiative` = "the Asia Internship", `Their Goal` = "equipping fellows with knowledge of
Asia, entrepreneurial skills, and a strong sense of purpose", `VSW Alignment` (peer-to-peer
talent-pipeline framing, not a big-cheque ask, citing UBC and YC/Thiel-fellow alumni), and
`Personalization Source` with both URLs. `LI Short Hook` left blank — route is Email (Work). **Flag:**
the existing `Why Them` note's dollar figure ("$6,000 scholarships") conflicts with the org's own
current site ("$10,000 scholarship") — not corrected here since `Why Them` wasn't in scope, but
should not be trusted for a dollar figure in outreach copy without a fresh check.

#### Thinkific (row 347, Category `Tech`)

Built on the verified 2026-07-21 contact research, not re-derived from scratch. Deep-scraped
`thinkific.com/press/` (leadership/press contacts unchanged: Greg Smith still CEO/Co-Founder) and
`thinkific.com/features/learning-communities/` (named product "Thinkific Communities," used as the
Initiative rather than generic homepage feature bullets). Also located the actual VSW 2019 session
page (`vancouverstartupweek2019.sched.com`) confirming Greg Smith personally — not just
"Thinkific" as an org — spoke on "Ready or Not: How to Prepare Your Company for VC and Angel
Investment" alongside Osler and Rhino Ventures, Sept 18, 2019; folded into `VSW Alignment` with a
tone directive favoring re-engagement/company-history framing. **Flagged, not fixed:** the row's
`Primary Contact Name` has changed since the 2026-07-21 write — it's now Melissa Wong (Manager,
Events & Customer Advocacy) rather than Greg Smith, so `VSW Alignment`'s tone clause explicitly
notes that the VSW-2019/CEO history belongs to Greg Smith, not to the current contact, and
shouldn't be used as if Melissa herself has that history. `VSW` checkbox is FALSE, so this row
won't surface in the automated past-sponsor re-engagement flag despite the real 2019 tie. Wrote
`Their Initiative` = "Thinkific Communities", `Their Goal` = "deepening customer connections
through community", `Personalization Source` (press/features/VSW-2019 URLs), `VSW Alignment`, and
`LI Short Hook` = "your CEO spoke at VSW 2019" (26/50 chars, `Outreach Route` = LinkedIn DM).
Contact fields, `Outreach Route`, and `Status` untouched.

#### Trulioo (row 354, Category `Tech` / Identity Verification)

Built on the 2026-07-21 contact research (Angelika Kadzielska primary, Alanna Brokop secondary —
left untouched). Deep-scraped `trulioo.com` directly. The strongest current, verifiable,
non-boilerplate material was Trulioo's own April 21, 2026 press release and product page for
**UBO Discovery**, a named AI-governed beneficial-ownership resolution engine that drove 51% YoY
growth in APAC business verification volume (up to 98% UBO coverage in Vietnam, 81% in Singapore)
— chosen over the existing Money20/20 USA sponsorship lead because it was fresher and fully
first-party sourced (Money20/20 2026 sponsorship confirmation lived only on `us.money2020.com`,
third-party). Wrote `Their Initiative` = "UBO Discovery", `Their Goal` = "uncovering beneficial
ownership even where registries are thin or absent" (drawn from CPO Zac Cohen's quote and the
product page's own framing), `Personalization Source` = the UBO Discovery product page + press
release URLs, `VSW Alignment` (references confirmed Vancouver HQ, 400–114 E. Fourth Ave., from
`trulioo.com/company/contact-us`, plus the Money20/20 sponsorship pattern), and `LI Short Hook` =
"Your UBO Discovery launch caught my eye" (39 chars, `Outreach Route` = LinkedIn DM). Contact
fields, `Outreach Route`, and `Status` untouched.

#### Wealthsimple (row 383, Category `Finance` / Fintech / Wealth management)

`Why Them`'s CIX Innovator of the Year 2026 claim (Mike Katchen, March 2026 CIX Summit) checked
out true via third-party coverage (BetaKit, Yahoo Finance, Elevate) but wasn't used as the source
— deep-scraped Wealthsimple's own newsroom instead and found a fresher, more specific hook:
**Wealthsimple Predict**, a brand-new CIRO-regulated prediction-markets trading app, publicly
launched via their own press release (2026-06-17/18) with a dedicated own-domain page. Wrote
`Their Initiative`="Wealthsimple Predict", `Their Goal`="democratizing access to prediction
markets for Canadians", `Personalization Source` (both URLs, pipe-separated), `VSW Alignment`
(builder-led product-launch framing, tone directive: builder-to-builder not
enterprise-partnerships), and `LI Short Hook`="your new Wealthsimple Predict app" (33/50 chars).
`VSW`/`Past VSW Event Partner` both FALSE, no re-engagement variant needed. **Flag:** `Outreach
Route`="LinkedIn DM (Secondary)", not the literal "LinkedIn" string originally specified for
gating `LI Short Hook" — written anyway since the route is LinkedIn-based. `Status`, `Outreach
Route`, `Warm Lead?`, contact fields untouched.

#### Cross-cutting notes from this batch

- **Recurring pattern confirmed:** `Why Them` was wrong or stale on at least 6 of the 20 rows
  (Aon's two dead programs, Foresight Canada's outdated CEO, Google for Startups' Africa-vs-Canada
  stat mix-up, Metro Vancouver's entity mix-up with Invest Vancouver, Cansbridge's stale dollar
  figure, Centre for Digital Media's unverifiable "entrepreneurship center" claim) — consistent
  with the standing caution that `Why Them` is a budget-qualification note, not sourced research.
  None of the wrong claims were used in any written field; each was independently re-derived from
  the org's own domain.
- **One row (Metro Vancouver) intentionally left unenriched** — not a failure of the process, a
  correct outcome per the playbook's "no verifiable hook → leave blank, log why" rule. Worth a
  look for whether the row should be merged/deprioritized against the separate Invest Vancouver
  row.
- **Two contact-fit flags surfaced that weren't asked for but are worth acting on:** Mastercard's
  on-file contacts are CSR-side, not tied to the Start Path hook that got enriched; Thinkific's
  contact changed to Melissa Wong since the 2026-07-21 research, and the VSW-2019 history in her
  row's `VSW Alignment` belongs to a different person (Greg Smith) and needs careful framing if
  used.
- All 20 throwaway per-org scripts (`enrich_*.ts`) were created and deleted by their respective
  agents; `git status` on the repo root after the batch showed none left behind.

### 2026-07-22 (`Drafted?` checkbox column added; Status advance-to-Enriched fixed for the `Draft Link` false-positive)

Ran `scripts/advance-status.ts` (dry run) after the batch above to move newly-enriched rows to
`Status = Enriched`. It instead proposed advancing 46 rows straight to `Drafted — awaiting
approval` — because `derive()` treats any non-blank `Draft Link` as proof a real draft exists, and
`Draft Link` is already populated on all 50 Tier 2 rows from 2026-07-21's "create a dedicated
drafting section for each org" work. Those are placeholder links to empty doc sections, not
rendered drafts — only 5 Tier 2 rows have actual copy. Did not run `--write` on the unmodified
script; flagged to Tej instead of silently mislabeling ~41 rows as awaiting his review when
nothing was actually there to review.

**Tej's fix:** add a manual `Drafted?` checkbox, set only when real copy exists, and update the
script to gate on that instead of `Draft Link`. Tej is updating `scripts/advance-status.ts`
himself; this entry covers only the sheet-side change made in the meantime.

**Added `Drafted?` column** (live, `master-prospects`, inserted immediately right of `Named
Contact?` via `insertDimension` — verified post-insert: `Ready?`=72, `Named Contact?`=73,
`Drafted?`=74, `Draft Link`=75, `Draft Variant`=76, all shifted correctly, no formula breakage
expected since Sheets auto-adjusts references on column insert same as a UI insert). Header
written, then `BOOLEAN`-condition data validation (checkbox UI) applied to rows 3–398. Backfilled
by reading current `Status` fresh: **TRUE for the 31 rows already at `Drafted — awaiting approval`
or later** (real drafts exist), **FALSE for the other 362 populated rows** (3 blank-org rows
skipped). Verified by fresh read-back on a sample (Absolute Software / Alumni Ventures / Aritzia,
all correctly `FALSE`).

**Marked genuinely-enriched rows as `Enriched` without the `Draft Link` shortcut and without
touching drafts.** Ran a throwaway script replicating `advance-status.ts`'s forward-only /
human-territory rules (never touch index 5+ "Revisions requested" onward, never touch an
unrecognised Status, never move a row backward) but capping the target at `Enriched` and deriving
purely from `Ready?=TRUE` + `VSW Alignment` filled — `Draft Link` never consulted. **22 rows
advanced** `Route identified → Enriched`: the 19 enrichable orgs from today's batch (Metro
Vancouver correctly excluded — never became `Ready?=TRUE` since it was left blank by design) plus
3 rows enriched in an earlier session that had the same stale-Status bug and had never been caught
(**Apple TV, Graphite Ventures, SAP**). 51 rows already at `Enriched` or beyond were left alone;
5 human-territory rows untouched; 315 not-yet-ready rows untouched. Verified by fresh read-back:
Alumni Ventures/Trulioo/Wealthsimple all confirmed `Status = Enriched`, `Drafted? = FALSE`,
`Draft Link` still non-blank (expected — that placeholder link isn't being cleared, just no longer
trusted as a drafted-copy signal); Metro Vancouver confirmed untouched at `Route identified`.

**No outreach-drafts document was written to.** Per Tej's explicit instruction, this pass only
corrects `Status`/adds the tracking column — actual drafted copy waits until Tej has reviewed the
newly-enriched columns and tells Claude to proceed. Throwaway scripts (`add_drafted_column.ts`,
`verify_drafted_column.ts`, `mark_enriched.ts`, `verify_final.ts`) run via `npx tsx` from the repo
root, deleted after each, none committed.

### 2026-07-22 (broad-org breakdown — duplicate-row cleanup, first step of the follow-up)

Tej asked to move forward on the broad-org breakdown work
(`docs/broad-org-breakdown-candidates.md`); chose to resolve the 4 duplicate/confused-row issues
that doc had already flagged before starting any department/contact research on top of them, since
research split across a duplicate pair would need re-doing. Read each pair's full row (`Why Them`,
`Notes`, `Status`, contact fields) fresh via a throwaway script before deciding — no merge/rename
done from the doc's summary alone.

**Vancouver Airport Authority / YVR (row 364, kept) ← Vancouver International Airport (YVR) (row
367, deleted).** Genuine duplicate, same org. Kept row 364 (further along: `Status = Route
identified`, named contacts Stephen Smart / Chris Richards). Folded row 367's unique detail — the
BCIT MOU, Integrated Marketplace cleantech program, and Digital Twin platform (VP Innovation Albert
Van Veen) — into row 364's `Why Them` rather than discarding it, and logged row 367's provenance
(net-new from staging row 1053, PDF sector profile via Slack) into row 364's `Notes`.

**Rogers (row 285, kept) ← Rogers Communications (row 286, deleted).** Genuine duplicate. Kept the
plain brand-name row (matches sheet convention: `Telus` not `Telus Communications Inc`). Folded in
row 286's unique fact (Women Empowerment Awards Presenting Sponsor) alongside the existing
Wavefront/Inventures/Entrepreneur-of-the-Year facts, and logged row 286's sourcing note
("Curated prospect research · Firecrawl-backed 2026-07-07") into row 285's `Notes`.

**Deloitte (row 104, kept) ← Deloitte Consulting (row 105, deleted).** Genuine duplicate — row 105
had already self-flagged this in its own `Notes` ("Firecrawl's results here were mostly blank...
this row may be worth merging with the Deloitte row"). Kept row 104 (further along: has a named
contact, Aliya; `Status = Route identified`). Folded in row 105's one unique fact (SXSW
business-innovation presentation) into row 104's `Why Them`.

**TD Bank Group (row 330) renamed to "TD Innovation Partners (TDIP)" — not deleted.** Re-reading
both rows showed this was never a true duplicate: `TD` (row 329, Tier 1, `Status = Drafted —
awaiting approval`, named contact, fully enriched) is the whole-bank/parent row; row 330's content
was never about the parent bank at all — it's specifically about TD Innovation Partners (TDIP), a
dedicated founder-literate banking team, i.e. a correctly narrower sub-entity that just had a
name confusingly close to the parent's legal name. Renamed the `Organization Name` cell only (no
content changes); added a `Notes` clause stating explicitly it's distinct from the `TD` row so
neither Tej nor a future agent re-flags it as a duplicate again.

**Net effect:** 393 → 390 org rows. All merges verified by fresh read-back (fresh `readTracker()`
call after every write) confirming the 3 deleted names are absent, the 4 surviving/renamed rows
read correctly, and total row count dropped by exactly 3. No content was silently dropped — every
fact from a deleted row was folded into its surviving sibling's `Why Them` or `Notes` before
deletion. Throwaway scripts (`check_dupes.ts`, `check_yvr.ts`, `check_yvr2.ts`, `dedupe_orgs.ts`,
`verify_dedupe.ts`, `spotcheck.ts`) run via `npx tsx` from the repo root, all deleted after use,
confirmed via `git status --short`.

**Not yet done:** the doc's other 3 flagged issues in the "Already correctly narrowed" /
namesake-caution section don't need action (they're informational, not duplicates).

### 2026-07-22 (broad-org breakdown — department/contact research, 13 orgs, one agent each)

Tej asked to move on to the actual department/contact-research follow-up. Before launching agents,
re-read fresh row data for all 19 High-confidence public/quasi-public orgs and triaged out 6 that
didn't need fresh research: Vancouver Economic Commission and Coast Capital Venture Connection are
both `Archived` (dead orgs/programs per their own `Notes`); Northeastern University already has a
named contact and past-sponsor status; City of Vancouver is already `Drafted — awaiting approval`
with a named contact; Metro Vancouver already got this exact research earlier today; Vancouver
Airport Authority/YVR already has two named contacts tied to its Innovation Hub. Launched 13
research-only agents (one per remaining org: Province of BC, Government of Canada, UBC, SFU,
Queen's, U of T, U of Alberta, U of Calgary, SAIT, Red Deer Polytechnic, City of Toronto, BC Hydro,
Vancouver Fraser Port Authority) — each deep-scraped the org's own domain, cross-checked against
existing sibling rows to avoid proposing duplicates, and reported structured findings back rather
than writing to the sheet or to any file themselves (to avoid write-collisions, matching the Tier 2
enrichment batch's pattern).

**Full findings written to `docs/broad-org-department-research.md`** rather than inlined here given
the volume (13 orgs × several candidates each). Headline results: **21 new candidate sub-entity
rows recommended across 11 orgs**, each with a named contact where one could be found (e.g. InBC
Investment Corp's Interim CEO, UBC's CDL-Vancouver Executive Director, SFU's Charles Chang
Institute Executive Director, Queen's DDQIC Executive Director). 2 orgs (BC Hydro, Vancouver Fraser
Port Authority) yielded no genuine split — both instead surfaced that their existing `Why Them`
note is actually describing a different org's program (NorthX/CICE for BC Hydro; Innovate BC for
VFPA, whose own site also blocked direct scraping throughout).

**4 pre-existing `Why Them` data-quality flags surfaced as a side effect** (not fixed — out of
scope for this pass, logged for whoever enriches these rows next): U of T's CANSEC sponsorship
claim is uncorroborated; SAIT's "Indigenous-focused innovation programming" claim about CapCon is
wrong, and "Empowering Innovation Spirit Conference" isn't a SAIT program at all — it belongs to
EntrepreNorth, an unrelated Yellowknife/Whitehorse nonprofit; U of Alberta's Inventures 2025
sponsorship claim traces to University of Calgary instead; BC Hydro's $3M energy-storage-call claim
belongs to NorthX/CICE (which already has row 245), not to BC Hydro itself. Consistent with the
standing caution that `Why Them` is an unverified qualification note, not sourced research.

**No writes made to the Google Sheet.** This entire pass is research only, reported into a new doc
for Tej to review — deciding which of the 21 candidates to actually add as new rows (and how to
categorize the two federally-funded-but-independently-governed nonprofits, DIGITAL and Mitacs) is
his call, not made here.

### 2026-07-22 (broad-org breakdown, round 2 — school/faculty, CLA, and government-mandate research, 21 orgs/topics, one agent each)

Tej asked to go deeper: individual schools/faculties (Business, Engineering/CS) within each major
BC and Alberta university, not just the 4 universities already researched; Campus-Linked
Accelerators (CLAs) across BC and the GTA beyond CDL; and a structural understanding of how
Government of Canada and BC funding actually flows plus a broader mandate-based sweep of federal
and provincial bodies. Also introduced a new standing instruction for this and future research:
**don't filter candidates only against VSW as it exists today — flag anything that would fit a
broader/evolved version of VSW even if it's a stretch for today's format.**

Scoped to 21 agents: 15 university school/faculty agents (Business + Engineering/CS per university,
skipping schools already redundant with an existing row — e.g. no SFU Business agent since
`SFU Beedie School of Business` already exists) across UBC, SFU, UVic, KPU, TRU (BC) and U of
Alberta, U of Calgary, Mount Royal, Athabasca, MacEwan (Alberta); 2 CLA landscape agents (BC, GTA);
2 Government of Canada agents (funding-allocation structure, mandate-based branches); 2 BC agents
(same split). All research-only, no sheet writes, reported back rather than writing to shared
files.

**Full findings written to `docs/broad-org-department-research-v2.md`.** Headline results: **~25
new candidate rows** at high confidence (Amii, Mount Royal's Institute for Innovation and
Entrepreneurship, DMZ, ventureLAB, Velocity, YSpace Network, Creative BC, Indigenous Services
Canada's Aboriginal Entrepreneurship Program, KPU Melville School of Business, UVic Innovation
Centre, and others), plus ~10 more flagged as evolved-VSW-only fits (biotech, hardware/
manufacturing, venue-partnership, family-enterprise angles).

**Notable non-candidate findings surfaced as a side effect:**
- **NRC IRAP's mandate quietly absorbed Sustainable Development Technology Canada's (SDTC, wound
  down 2024-25) former cleantech-startup funding role** — the existing NRC IRAP row's pitch just
  got stronger; no new row needed.
- **PacifiCan's Regional Innovation Ecosystems (RIE) program** (up to $3M, "business networking"
  explicitly eligible) is the specific mechanism to name when pitching PacifiCan, sharper than a
  generic sponsorship ask.
- **Security flag:** `startgbc.com` is an unrelated lookalike domain (Bangkok address) — George
  Brown College's real startGBC program is at `georgebrown.ca/startgbc`.
- **Operational flag:** Mount Royal University's own site referenced "a cyber incident affecting
  its systems and services" during research — worth independent verification before any real MRU
  outreach.
- BC ministries don't have a generic sponsorship fund; money flows only through named published
  grant programs, so "does this ministry have money" is the wrong test — "does a specific open
  program's eligibility actually fit" is the right one.

**No writes made to the Google Sheet.** Combined with round 1
(`docs/broad-org-department-research.md`), roughly 46 candidate sub-entity rows have now been
surfaced across both research passes for Tej to review and decide on.

### 2026-07-22 (broad-org candidates — full-sheet dedup pass, 11 net-new rows added)

Tej asked which candidates from the two research docs are "100% obvious" adds, with an explicit
instruction to dedup against the live sheet first — flagging that dedup here is non-deterministic
(acronyms, renamed programs) and might need LLM judgment, not just string matching.

**Ran a full cross-check of all ~46 candidates against every one of the (then-)390 `master-prospects`
Organization Names** (pulled fresh, not from the research docs' own per-org exclusion lists, which
only checked against names *given* to each agent — not the whole sheet). This caught real
duplicates the individual research agents missed:

- **InBC Investment Corp.** (row 167) — already exists, `Status = Route identified`, contact Jill
  Earthy on file. Round-1 research on this exact org had already found she's departed — flagged,
  not corrected here (contact fields untouched).
- **DIGITAL** (row 108) — already exists, `Status = Sourced`, no contact.
- **DMZ** (row 111) — already exists, `Status = Sourced`, no contact. Round-2 research found
  Abdullah Snobar (ED & CEO) as a live contact candidate — not written, flagged for the contact-ID
  step.
- **Charles Chang Institute for Entrepreneurship** (row 77) — already exists, `Status = Contact
  identified`, contact Thomas Partridge on file. Fresh research found a different name (Janice
  O'Briain, Executive Director) — flagged for Tej to reconcile, not silently overwritten.
- **"CDL-Vancouver"** — maps to the existing generic row 97, "Creative Destruction Lab" (`Status =
  Route identified`), whose own `Why Them` already describes "its Vancouver stream out of UBC
  Sauder." Existing contact "Darryl/Clara Ng" vs. fresh research's Darrell Kopke/Sean Elbe —
  flagged, not overwritten. **Recommended next step (not done):** rename this row to "Creative
  Destruction Lab – Vancouver" once CDL-Toronto is added as a sibling, same pattern as the earlier
  TD Bank Group → TD Innovation Partners (TDIP) rename.

None of these 5 got new rows — they need enrichment/contact-reconciliation on their existing rows
instead, which is less work, not more.

**Added 11 confirmed net-new rows** (`master-prospects`, rows 391–401, verified by fresh read-back):
Amii, Mount Royal University — Institute for Innovation and Entrepreneurship, KPU — Melville School
of Business, Creative BC, MacEwan Ventures, UVic Innovation Centre, ventureLAB, Velocity
(University of Waterloo), TRU — Bob Gaglardi School of Business and Economics, YSpace Network
(York University), Mitacs. Each written with `Organization Name`/`Category`/`Subsector`/`Why Them`/
`Notes`/`Status="Sourced"` only — `Outreach Tier` and all contact fields left blank, consistent with
treating contact-identification as its own separate step (per Tej's own stated 4-stage pipeline:
identify → find contacts → enrich → draft), not something to conflate into org-identification.
Each row's `Notes` records the source URLs and a suggested-but-unverified contact name/title found
during research, so that research isn't lost even though it wasn't written into the contact fields
themselves. `Category` values chosen against the corrected 16-value enum (AGENTS.md golden rule
#6/PRD §6); Mitacs and Creative BC's categorization is a judgment call (federally/provincially
funded but independently governed nonprofits) — flagged in their own `Notes` cells for Tej to
correct if a different Category fits better.

390 → 401 total org rows. Verified via fresh read-back on all 11 org names + row numbers before
declaring done. Throwaway scripts (`add_new_orgs.ts`, `verify_new_orgs.ts`) run via `npx tsx`,
deleted after use, confirmed via `git status --short`.

**Second pass, same session: added the next 11.** After reviewing the first 11, Tej asked what else
qualified; on review the round-1 cutoff had been more conservative than necessary — 11 more
candidates matched the identical bar (named contact, real budget/program, no major caveat) and had
just missed the first cut. **Added** (`master-prospects`, rows 402–412, verified by fresh
read-back): UBC — CS Industry Partnership Program, SFU — Computing Science Industry Relations,
University of Toronto Entrepreneurship (UTE), University of Alberta Innovation Fund (UAIF, Category
`VC` — it's a real venture fund, not a program), eHUB Entrepreneurship Centre (University of
Alberta), Innovate Calgary, Haskayne Centre for Entrepreneurship and Innovation, ARIS (SAIT), SADT /
Bissett Seed Fund (SAIT), CIM-TAC (Red Deer Polytechnic), Dunin-Deshpande Queen's Innovation Centre
(DDQIC). Same write pattern as the first batch (Org Name/Category/Subsector/Why Them/Notes/
Status=Sourced only, contact fields blank, suggested contacts recorded in `Notes`). This script also
added a hard guard — throws before writing if any target name is already present in the sheet —
since a second manual dedup pass invites a copy-paste collision that the first batch's script didn't
need to defend against.

412 → verified total. Throwaway scripts (`add_new_orgs_2.ts`, `verify2.ts`) deleted after use.

**Not yet done:** the remaining ~20 candidates from both docs (real-but-caveated ones — Hunter Hub,
CDL-Toronto, QPI, City of Toronto's tech sector team, Emily Carr's Shumka Centre, UBC Okanagan's
e@UBCO, Indigenous Services Canada's Aboriginal Entrepreneurship Program, BC's Ministry of Tourism/
Arts/Culture/Sport; plus the lower-priority GTA CLAs and every evolved-VSW-only flag) are still
pending Tej's review — presented back to him in chat, not yet added. Also still pending: the 5
existing-but-thin rows found during the dedup pass (InBC Investment Corp., DIGITAL, DMZ, Charles
Chang Institute for Entrepreneurship, Creative Destruction Lab) need enrichment + contact
reconciliation, not new rows.

### 2026-07-22 (Andrew's Tier 1 review feedback applied to the live outreach-drafts doc)

Andrew reviewed the Tier 1 (20-org) outreach drafts in the delivery doc
(`1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk`) and gave 3 feedback items: (1) reword the email
"brief call" ask sentence, (2) remove two closing lines (the Tue/Thu scheduling ask + the one-pager
offer), (3) replace the LinkedIn connection note with new copy. Split drafting across 5 parallel
research-only agents (4 orgs each) to work out the exact per-org old→new text; agents were told not
to write anything, just report back for Tej's review.

**Three judgment calls surfaced before any drafting and put to Tej directly (not decided
unilaterally), since each affected many orgs identically:**
1. Andrew's new LinkedIn text ran 378–403 chars per org once `[name]`/`[org name]` were filled in —
   over the doc's hard 300-char cap (playbook: Viv has no LinkedIn Premium/InMail). **Tej approved
   trimming** it to a locked template that preserves his meaning (decade running, thousands of
   people, dozens of events, org stood out, opening next year's program, connect and hear how our
   work can help you reach your goals) while fitting under 300 for every org (worst case 298/300,
   Kensington Capital Partners).
2. Andrew's line-1 reword only has a literal match in the 4 **Email B** drafts (City of Vancouver,
   National Bank, Sequoia, Valhalla). The 5 **Email A** drafts (CVCA, EY, PwC, Trade and Invest BC,
   Version One Ventures) have a different "20-minute conversation to learn:" bulleted structure with
   no equivalent single line. **Tej's call: leave Email A's bulleted section untouched**, apply only
   the two-line removal there.
3. **Google Cloud** is a past VSW sponsor (2025) with a special re-engagement LinkedIn note per the
   playbook's no-cold-copy-to-past-sponsors rule; Andrew's new text is cold-style. **Tej's call:
   keep the re-engagement opener, splice in Andrew's new closing ask** rather than overwriting with
   the generic cold template.

**Doc-structure finding that changed how the write was executed:** every org's Tier 1 draft turned
out to live in its own **Google Doc tab** (not just a heading) under a "Tier 1 (20)" parent tab —
confirmed via `documents.get({includeTabsContent: true})`. Several orgs' drafts are also duplicated
byte-for-byte elsewhere in the same doc (a "Tier 2 (50)" tab tree and an "Archive" tab tree that
Andrew has not reviewed) — a whole-document text search-and-replace would have silently corrupted
those untouched copies. Used the Docs API's `tabsCriteria.tabIds` on each `replaceAllText` request
to scope every edit to exactly the originating org's tab, so cross-tab duplicates were never at
risk regardless of text overlap.

**Applied via one throwaway `.ts` script** (auth pattern matching `src/sheets.ts` but
`docs_v1`/scope `https://www.googleapis.com/auth/documents`, per the outreach-copy-playbook's Docs
API note): extracted live per-tab text first to verify every old-text string against the real doc
(not the flattened export used for drafting) — this caught that real apostrophes/ampersands differ
from the markdown export's escaped forms — then ran 36 scoped `replaceAllText` requests in a single
`batchUpdate` call: 11 LinkedIn note bodies + headings (10 generic + Google Cloud's spliced variant),
4 Email B sentence-swaps + line-removals, 5 Email A line-removals-only, and Valhalla's two removals
handled as two distinct edits (its Tier 1 tab itself contains two different drafts to two different
people — Randy Thompson via a table row, Grant Lawrence via a plain-text repeat below it — both
needed the same edits). Read the doc back afterward and confirmed programmatically: zero leftover
occurrences of either removed line or the old ask sentence, every LinkedIn note ≤300 chars and
matching its heading's declared count, no run-on ("and your" appearing twice in one paragraph).
Scripts (`inspect_doc_tabs.ts`, `extract_tabs.ts`, `apply_doc_edits.ts`) deleted after use.

**Pre-existing doc-quality issues surfaced along the way, left untouched (out of scope for this
pass, flagged for Tej):** PwC's Tier 1 entry is missing its `Contact:` metadata line; CVCA's last
Email-A bullet is missing a list marker/paragraph break other orgs have; Sequoia's To/Cc/Bcc table
cells read literal `Person Person Person` / `Person` (looks like a leaked placeholder, not Emma
Matthieson's real email); AWS's and Vancity's old connection-note headers were each off by one
character from the actual old note length (pre-existing, unrelated to this edit); Top Down
Ventures' Tier 1 "Personalization used" block is missing a `source →` line its Tier 2 duplicate has;
Valhalla's Grant Lawrence draft has no `Contact:`/tracker-row line in Tier 1 (only its Tier 2 copy
does).

### 2026-07-22 (Absolute Software — re-enrichment research + live sheet correction)

**Research (background agent, no sheet writes):** deep re-scrape of `absolute.com` plus corroborating
sources (LinkedIn, Wikipedia, BC Tech, Indeed) to check the existing `Why Them`/`VSW Alignment`
clauses against current facts and reason through what ROI Absolute would actually want from a VSW
sponsorship. Full memo written to `docs/absolute-security-vsw-fit-research.md` (research-only,
dated, cited).

**Headline finding: the existing "Vancouver-HQ'd, publicly traded, peer-sponsor" framing was stale
on two counts.** (1) Absolute went **private in July 2023** (Crosspoint Capital, delisted from
TSX/Nasdaq) and rebranded from Absolute Software to Absolute Security in 2024 — "publicly traded"
was wrong. (2) **Headquarters is now contested** — Absolute's own About page still calls Vancouver
"global headquarters," but every 2026-dated source (LinkedIn's company page, Wikipedia's infobox,
every 2026 press-release dateline) says headquarters moved to Seattle and Vancouver is a regional
office. The stronger, more current fact the research surfaced instead: Absolute is a **named anchor
partner of BC Tech's `BCTech4Startups` program** alongside Amazon, EA, SAP, and TELUS — real
evidence they already spend a "back the local startup ecosystem" budget line, plus active Vancouver
hiring across engineering/sales/partnerships (checked live 2026-07-22). Ranked ROI candidates for
Absolute, most to least evidenced: talent/employer-brand > local ecosystem/community standing >
executive thought-leadership > direct sales pipeline (weak — their buyer is enterprise IT/security,
not early-stage founders) > M&A/acquisition scouting (unevidenced, not real).

**Applied to the live sheet at Tej's request** (row 5, `master-prospects`, org name `Absolute
Software`, columns resolved by header name not letter): rewrote `Why Them` (G) and `VSW Alignment`
(BM) to drop the stale HQ/public-company framing, correct the ownership/HQ facts, replace the weaker
"2026 TechMap" partnership mention with the stronger BCTech4Startups anchor-partner fact, and
reframe the ask as talent/community rather than a peer-scale headquarters pitch. Preserved the
existing warm-lead mention (Tej's cousin, ex-CSM) — not dropped, per golden rule #3. `Their
Initiative`/`Their Goal`/`Personalization Source` (the Secure Endpoint 10 clause) were left
untouched — the research found nothing wrong with that clause, only with the surrounding framing.
Did **not** touch the `Warm Lead?` checkbox — the memo restates (does not resolve) the known
inconsistency already flagged in the 2026-07-14 Absolute/RBC merge entry above. Written via a
throwaway `.ts` script (same service-account pattern as every other live-sheet write in this log),
verified by reading both cells back post-write, script deleted after use.

**Follow-up same day: `Personalization Source` (BL) also corrected.** One of its two URLs,
`absolute.com/company/about-absolute-security`, was the exact page originally cited to back the
now-retracted "global headquarters in Vancouver" claim — orphaned once that claim was pulled from
`Why Them`/`VSW Alignment`. Swapped it for `absolute.com/company/investors`, the real on-domain
source for the "private since 2023, Crosspoint Capital" fact the corrected copy now states; kept
the Secure Endpoint 10 blog URL unchanged. `Their Initiative`/`Their Goal` left untouched — nothing
in the research contradicted them. `LI Short Hook` confirmed correctly blank (`Outreach Route` =
Email, not LinkedIn, so the field isn't required).

### 2026-07-22 (Accenture — deep re-enrichment research, then live sheet correction detaching Accenture Ventures)

**Research (background agent, no sheet writes):** same treatment as Absolute Software above,
starting from a page Tej flagged (`accenture.com/ca-en/about/accenture-innovation`). Full memo at
`docs/accenture-vsw-fit-research.md`. **Finding: that page is global boilerplate** — no named
Canadian/Vancouver programs, just generic "5 I's of Innovation"/Accenture Labs framing, not usable
as a personalization source on its own. The existing hook (Project Spotlight's 2024 investment in
Sanctuary AI) turned out not fabricated but needing care: Sanctuary AI had a real crisis in the year
after the investment (founding CEO forced out Nov 2024, ~30 layoffs) but has genuinely recovered by
mid-2026 (a production milestone with a Tier-1 automotive supplier, fresh BDC Capital/InBC
financing tied to Vancouver headcount growth, active hiring again per Jan 2026 trade press) — and
Project Spotlight itself is a high-volume global program (9-10 deals in 2025 alone), so "backing
Sanctuary AI" is one of many concurrent bets, not a uniquely deep local relationship. Both named
contacts (Jenna Nowson, Matthew Wu) independently corroborated as still current. Real, current
Vancouver hiring signal found (Indeed: dozens of open roles spanning tech/consulting/delivery,
2026-07-22), sitting inside a larger global AI-driven restructuring context (Julie Sweet's own
CNBC-quoted words: exiting staff who can't be reskilled, but also guiding to FY26 headcount growth
across three markets) — the honest version of a hiring signal, not an unqualified boom. Flagged the
`Inventures = TRUE` checkbox as possibly overclaimed (only found an Accenture speaker appearance,
not a sponsor listing) and the current `Why Them`'s "Web Summit partner" line as already
inconsistent with the row's own `Web Summit Vancouver` checkbox (FALSE) — an appearance URL, not a
sponsorship. Also found the Founder Institute reference in `Why Them` traces to a 2013 Brussels
internal-employee program, unconnected to Vancouver or anything current.

**Follow-up decision (Tej, discussing which entity the row should represent):** should this row be
"Accenture" or "Accenture Ventures"? **Decided: Accenture (the local Vancouver office), not
Ventures** — Ventures is a $250M global corporate-VC fund with no local sponsorship budget or
Vancouver-based team; the actual sponsor-decision authority sits with the local office (Nowson,
Wu), the same entity already on the row as contacts. Mirrors the broad-org-split rule in
`org-goals-enrichment-model.md` §4 in reverse: split into a sub-entity only when the unit — not the
parent — holds the goal and the budget; here the parent holds both.

**Applied to the live sheet at Tej's explicit request, detaching Accenture Ventures entirely from
the row's copy** (row 8, org name `Accenture`, columns resolved by header name): rewrote `Why Them`
(G), `Their Initiative` (BJ), `Their Goal` (BK), `Personalization Source` (BL), `VSW Alignment`
(BM), and `LI Short Hook` (BN) — dropped the Sanctuary AI/Project Spotlight hook entirely (not
softened — removed), dropped the unsupported "enormous marketing and innovation budget" boilerplate
(fails the substitutability test — true of every top-5 consultancy) and the stale Founder
Institute/overclaimed Web Summit lines, and rebuilt the personalization around the hiring +
AI-reskilling signal instead: `Their Initiative` = "your active Vancouver hiring push", `Their
Goal` = "growing headcount across its markets while reskilling for the AI skills it needs".
**Known tradeoff, stated to Tej rather than hidden:** Accenture Vancouver doesn't have an
equally-strong *named* local program to replace Sanctuary AI with once Ventures is off the table —
the new hook is a real, current, dated situational fact (active local hiring amid a global
restructuring), not a proprietary program name like the old one. `Personalization Source` rebuilt
to `accenture.com/ca-en/careers` (required own-domain anchor) plus the Indeed Vancouver listing and
the CNBC piece quoting Julie Sweet on FY26 headcount/reskilling — verified live via `WebSearch`/
`WebFetch` in-session (no accenture.com-owned page confirms the SXSW activation either, matching the
memo's finding; kept as a caveated mention in `Why Them`, not a Personalization Source citation).
**Did not touch** the `Inventures`/`Web Summit Vancouver` checkboxes or the SXSW-tier ambiguity —
flagged to Tej, not resolved unilaterally, same posture as the Absolute `Warm Lead?` flag. Written
via a throwaway `.ts` script (dynamic row/column lookup by Organization Name and header text, same
pattern as every other live-sheet write in this log), all six cells verified by reading back
post-write, script deleted after use.

### 2026-07-22 (Tier 2 deep re-enrichment — 24-org batch research + systematic data-quality audit)

**Context.** Following the Absolute/Accenture/Ada CX deep re-enrichments, Tej asked for the same
quality bar across every remaining Tier 2 row and for it to be made "formulaic." Built
`docs/tier2-reenrichment-playbook.md` (the repeatable recipe + apply/hold rules) and
`scripts/build-reenrichment-brief.ts` (read-only; dumps a row's full current state + heuristic
pre-flight flags to feed each research agent). Ran **24 more orgs** as one-research-agent-each in
three waves of 8 (Accelerate Fund, Air Canada, Airbus, Alumni Ventures, Amazon, AMD, Angel Forum,
Aon · Apple TV, Aritzia, Aspect Biosystems, ATB Financial, ATCO, Centre for Digital Media, Dell,
Foresight Canada · FrontFundr, Global Affairs Canada, Google for Startups, Graphite Ventures, Hiive,
LinkedIn, Lovable, lululemon). Each produced a dated, cited `docs/<org>-vsw-fit-research.md` memo —
**research only, no per-row sheet writes yet** (Tej reviewing before content is applied). Cross-org
findings drove the playbook updates (CANSEC per-row audit, Inventures checkbox both-directions,
returning-VSW-partner-mislabeled-cold, LinkedIn-hook grammar, wrong-region program examples,
portfolio/parent cross-references like Accelerate Fund↔Yaletown and Aspect↔Rhino).

**Systematic data-quality audit — the one batch of writes applied this session (Tej's explicit
"separate audit pass" call).** Swept all 50 Tier 2 rows for the mechanical issues the memos kept
surfacing, verified each against authoritative sources, and corrected only what was positively
confirmed. **16 checkbox writes**, keyed by Organization Name, columns resolved by header, each
read back post-write (all 16 verified OK):
- **CANSEC → FALSE (8, phantom — all confirmed absent from CANSEC's own 2026 sponsor list at
  `cansec.defenceandsecurity.ca`):** Ada CX, Alumni Ventures, Aspect Biosystems, FrontFundr,
  Google for Startups (Google *Cloud* is the real CANSEC sponsor — different entity), RBC,
  Smythe LLP, Trulioo.
- **CANSEC → TRUE (1, real but was FALSE):** Airbus — its own `Why Them` claims "CANSEC Silver" and
  Airbus is on both CADSI's Silver-Sponsors page and the CANSEC 2026 list. Dell left TRUE (verified
  real — the one genuinely-sourced CANSEC checkbox).
- **Inventures → TRUE (5, real but was FALSE — all confirmed on `inventurescanada.com/sponsors`'
  2025 list):** Air Canada, Aon, ATB Financial, ATCO, Foresight Canada.
- **Inventures → FALSE (2, phantom — absent from the 2025 list):** Graphite Ventures (likely
  confused with Graphite's own Calgary founder event), Lovable.

**Deliberately NOT changed, and why (flagged for Tej, not auto-resolved):**
- **`Outreach Route` values — no changes.** Several memos flagged `LinkedIn DM` / `Email (Work)` as
  "invalid dropdown values" against `org-goals-enrichment-model.md`'s documented strict enum. **Read
  the live data validation directly: the real strict dropdown on the route column (AT) is
  `Email (Personal)` · `Email (Work)` · `Email (Work, Secondary)` · `Email (Generic Inbox)` ·
  `Email (Work, Unverified Format)` · `LinkedIn DM` · `LinkedIn DM (Secondary)` · `Warm via
  Andrew/Viv/Holden/Tej` · `Contact Form`.** So `LinkedIn DM` etc. are the *actual* valid values;
  the doc's `Email — personal`/`LinkedIn` enum was never applied to the live column. The memos'
  route-invalidity claims were false alarms — no rows touched. (The doc is now the stale one; worth
  reconciling separately.)
- **`Warm Lead?` = FALSE while `Warm Lead Person` is set (Angel Forum, Foresight Canada, PacifiCan,
  TECHTO).** Per the playbook, restated not resolved — flipping `Warm Lead?` is a judgment call
  affecting routing/tone. For Tej.
- **`VSW` checkbox = FALSE on verified past VSW sponsors (Foresight Canada — 2019+2023 per Tej's own
  past-sponsors data; Global Affairs Canada — 2016 per sched.com; Angel Forum — probable 2025
  session).** Left as-is because flipping to TRUE flips the row from cold to re-engagement copy — a
  strategic call outside the mechanical audit scope. High-priority for Tej.
- **Inventures on Accenture and Vancouver Tech Journal** — both absent from the 2025 list, but
  Accenture could be a different-year sponsor and VTJ isn't yet researched; flagged rather than
  unchecked.
- **Vanedge Capital's phantom CANSEC** — held with the other 4 already-drafted rows (A100, Northleaf,
  The Syndicate, Vanedge, Yaletown), which are research-only this pass so the live drafts don't
  desync.

All research memos and the two tooling files are uncommitted working docs; the 16 checkbox writes
are the only live-sheet change from this batch. Per-row content corrections (clause rewrites,
contact fixes, boilerplate removal) remain staged in the memos pending Tej's review.

### 2026-07-22 (Tier 2 re-enrichment — waves 1-3 CONTENT applied, per Tej's per-wave direction)

Per Tej's decisions (AskUserQuestion): **apply every copy change the memos recommend, flag all
contact changes and apply none.** Applied across the 24 researched rows (Accelerate Fund, Air Canada,
Airbus, Alumni Ventures, Amazon, AMD, Angel Forum, Aon, Apple TV, Aritzia, Aspect Biosystems, ATB
Financial, ATCO, Centre for Digital Media, Dell, Foresight Canada, FrontFundr, Global Affairs Canada,
Google for Startups, Graphite Ventures, Hiive, LinkedIn, Lovable, lululemon) via three throwaway
`.ts` scripts (one per wave, keyed by Organization Name, columns by header, Notes read-then-appended
so nothing was buried, spot-verified per wave). **~88 copy-cell writes** touching only `Why Them`,
`Their Initiative`, `Their Goal`, `VSW Alignment`, `Personalization Source`, `LI Short Hook`, and
per-row `Notes` — composed from each memo's own "if you wanted to act on this" language, respecting
the grammar gate (Initiative = one noun phrase; LI hook ≤50 chars, bare noun phrase — fixed the
broken ATCO "…caught my eye" and lululemon "Vancouver-born brand funding global wellbeing" hooks) and
the substitutability test (removed "real/enormous/deep budget" boilerplate everywhere it appeared).
Plus **one verified checkbox flip beyond the audit set**: Hiive `BC Tech Technology Impact Awards`
→ TRUE (won Company of the Year – Scale 2025).

**Contact fields: zero writes.** Every contact issue the memos surfaced was left untouched and
compiled for Tej — the notable ones: **Google for Startups** ("Hendryck D./BDR" → real owner Iran
Karimian); **AMD** (Rudy Torrijos LinkedIn resolves to an unrelated PitchBook analyst — do not send);
**Amazon** (Allison Lovelace = Amazon Ads/Seattle, no AWS/Canada tie → Jesse Dougherty is the
evidenced local alt); **LinkedIn** (Munish Taneja appears to have moved to Reddit); **FrontFundr**
(LinkedIn URL is a different junior employee's — person/email are right); **Apple TV** (Stephanie
Sheng is an Ivey undergrad intern → Julia Benaroya); **Air Canada** (Hotmail likely wrong);
**Aritzia** (add VP Corporate Giving Corinne Kepper, replace generic inbox); **Aon** (Jady Fitton is
Consumer Products Group, not Digital Economy); **Foresight Canada** (nleduc@foresightcanada.com is
the wrong domain — real one is foresightcac.com); **GAC** (Ottawa dev-finance desk is the wrong door
— use TCS Pacific Regional Office); **lululemon**, **Lovable**, **ATCO**, **Graphite**, **Alumni
Ventures** (title/slug corrections). Each row's `Notes` now carries its specific contact flag.

**Also left for Tej (strategic/out-of-mechanical-scope):** the `VSW`-checkbox flips on verified past
sponsors (Foresight 2019+2023, GAC 2016) that would switch those rows from cold to re-engagement
copy; the Angel Forum probable-2025-session (confirm with Viv); the four `Warm Lead?`-vs-`Warm Lead
Person` inconsistencies; the LinkedIn tier-downgrade; and the Accelerate Fund↔Yaletown coordinated-
outreach decision. **Route values confirmed NOT changed** — several memos flagged "LinkedIn DM"/"Email
(Work)" as invalid against the stale enum doc, but the live data validation proves they're the real
strict dropdown values.

### 2026-07-22 (Status flip — the 17 not-yet-deep-re-enriched Tier 2 rows moved Enriched → Route identified)

Per Tej: the Tier 2 rows that have **not** yet had this cycle's deep re-enrichment shouldn't sit at
`Status = Enriched` (which overstates their readiness). Flipped **17 rows** (`Status` col A,
`Enriched` → `Route identified`), keyed by Organization Name, each verified currently-`Enriched`
before writing, all read back post-write: Mastercard, Microsoft for Startups, Mosaic Accelerator,
NorthX, Notion, PacifiCan, RBC, SAP, SFU VentureLabs, Smythe LLP, TECHTO, The Cansbridge Fellowship,
Thinkific, Trulioo, Vancouver Tech Journal, VANTEC Angel Network, Wealthsimple. `Route identified`
validated against the Status enum before the write (golden rule #15).

**Deliberately NOT flipped:** the 5 already-drafted rows (A100, Northleaf, The Syndicate, Vanedge,
Yaletown) are at `Drafted — awaiting approval` — *past* Enriched, with live drafts sitting with
Andrew; moving them back would erase the "a draft exists" signal and violate the lifecycle's
forward-only / never-overwrite-a-downstream-human-decision rule. Metro Vancouver was already at
`Route identified` (no-op).

**Caveat flagged to Tej:** these 17 rows still have `Ready? = TRUE` (their shallow clauses are still
filled), so re-running `scripts/advance-status.ts --write` would auto-advance them back to `Enriched`
(the script derives Status 1–5 forward from `Ready?`). This manual downgrade is a marker of
"not-yet-deep-re-enriched," not a durable state — it holds only until that script runs or the rows
get their deep pass.

### 2026-07-23 (Wave 4 deep re-enrichment applied — 7 of 8 rows, 50 cell writes; RBC held)

Applied wave 4's memo recommendations to `master-prospects`, resolved by header name and keyed by
Organization Name (columns are reshuffled live). Per Tej's two directives on this batch: **RBC is on
hold** (not written — RBCx is already at `Meeting booked` with Viv, and a cold RBC approach would
collide with a live conversation), and **no memo's "they won't pay cash" conclusion was applied as
written.** Where the research shows a cheque is a harder sell, the copy now names the constraint,
names the higher-probability opening, *and* says to make the paid ask explicitly rather than
pre-conceding it. This changed the `VSW Alignment` framing on Mosaic, NorthX, Notion and Microsoft.

**PacifiCan reframed per Tej:** the memo recommended pitching the Regional Innovation Ecosystems
stream, whose intake closes 2026-09-11. Tej's direction is that VSW wants **a meeting to determine
which stream fits**, not a pitch for one stream. So RIE is used as the *personalization hook* while
`VSW Alignment` makes the ask a scoping conversation with the Lower Mainland team across RIE, CEDD
and a future RAII round, with the September 11 date carried as a reason to book early rather than as
the ask. Supported by two findings on PacifiCan's own material: its guidance says it "may consider
applications submitted under one program for suitability and potential funding under other PacifiCan
programs," and its small event agreements appear to come through a business officer rather than an
open call.

**Rows written (7):** Mastercard (215), Microsoft for Startups (222), Mosaic Accelerator (228),
NorthX (245), Notion (247), PacifiCan (258), SAP (292). Fields touched per row: `Their Initiative`,
`Their Goal`, `Personalization Source`, `Why Them`, `VSW Alignment`, `LI Short Hook` (Notion kept its
existing `Their Initiative`; Microsoft kept its verified `Their Goal`). **`Notes` was read-then-
appended on every row, never overwritten** (golden rule #3).

**Checkbox corrections (3), each on own-domain evidence:** Mastercard `Web Summit Vancouver`
FALSE→TRUE (confirmed on the event's own domain for 2025; tier unconfirmed); Microsoft for Startups
`Web Summit Vancouver` FALSE→TRUE (on the event's own 2026 exhibitor page — note this is
Microsoft-the-company, not the program); SAP `BC Tech Technology Impact Awards` FALSE→TRUE (four
confirmations on BC Tech's own domain, clearest dated 2026-06-10: "The 2026 Gamechanger – Company
Culture Award is presented in partnership with SAP").

**Highest-value defects this wave fixed:** Microsoft's row shipped **"Founders Hub," a program name
Microsoft retired 2025-07-02**, in three separate fields. SAP's row personalized off a **training-
course module with zero occurrences of "Vancouver" and zero of "startup"** — it passed the own-domain
check because that rule tests the *host*, not whether the page is about the org's strategy (logged as
a gap in `run-report.ts`'s checks). SAP's `Why Them` also mis-attributed a defunct program's stat:
the "200 startups" figure belongs to SAP.iO No Boundaries (whose domain no longer resolves), not to
"SAP for Startups," which is a European ERP sales motion gated at Series A–C. Mosaic's three
personalization fields all pointed at an intake page that has read "Applications Currently Closed"
across four captures spanning ~10.5 months. NorthX's row joined a NorthX-only April 2025 investment
to a separate September 2025 Scotiabank agreement and called it "just invested."

**Grammar gate ran in code on every row before writing.** Two adjudications worth recording:
(1) the gate initially failed Microsoft because the composed sentence contained two " and "s — but
the second is a **serial comma** inside the goal ("build, learn, and grow"), not the banned
mid-sentence conjunction collision, so the check now counts only " and " not preceded by a comma;
(2) Mosaic's `LI Short Hook` ("the Mosaic Architects") repeats the org name, which would stutter in
Andrew's LinkedIn Message A — **accepted** because that row's route is `Email (Personal)` (the email
render is clean) and every branded term on their site except "Ancestral Intelligence" contains
"Mosaic." Logged in the row's `Notes` with an instruction to swap the hook if the route ever changes.

**Contacts: all flagged, none applied** (Tej's standing rule for this cycle). Each row's `Notes` now
carries its specific flag — Mastercard (both titles wrong; Rebecca Harrison's committee chairmanship
is recorded *as* her title), Microsoft (Hamed Rabah is US-based IC with no Canada remit; Bakari Brock
better evidenced), Mosaic (`rochelle@rochelle.ca` is unpublished), NorthX (`marketing@northx.ca` is
their published partnerships address), Notion (Emma Yee Yick now Head of Global Community and owns
the relevant budget), PacifiCan (title wrong per the 2026-04-29 directory; `info@pacifican.gc.ca` is
the designated Lower Mainland front door), SAP (Katryn Cheng is Senior Director not VP; Susan Walker
likely a namesake; Cindy Fagen, MD SAP Labs Canada, is the better route).

**Still for Tej, raised by this wave:** the **NorthX warm route via Katty Wang** — VEF's own board
page puts NorthX's contact and VSW's co-chair on the same board, and Katty appears **zero times** in
`Warm Lead Person` across 393 rows while her VEF seat bridges at least eight others. The `Launch
Academy` checkbox is unreliable across ≥4 rows (Microsoft, Notion, RBC all trace to one 2026-07-04
Slack screenshot; only Smythe appears on Launch Academy's own live sponsor page). `Source Type =
"Past VSW event partner"` remains a **sourcing artifact** — all 10 rows carrying it have `VSW=FALSE`;
left unchanged on Mosaic and NorthX rather than fixing one row out of ten. Row 86, "Climate
Innovation Zone (Canada)," is not an organization and should be folded into the NorthX row. And
whether a separate **Microsoft Vancouver** row should be split out (2,500+ staff, its own Garage, and
the entity that has actually written local cheques).

### 2026-07-23 (Wave 5 research launched — the last 9 plain Tier 2 rows)

Briefs generated with `scripts/build-reenrichment-brief.ts` and 9 agents spawned in parallel:
SFU VentureLabs, Smythe LLP, TECHTO, The Cansbridge Fellowship, Thinkific, Trulioo, Vancouver Tech
Journal, VANTEC Angel Network, Wealthsimple. Research only — nothing written to the sheet by the
agents. Each brief carries Tej's 2026-07-23 no-pre-conceding-cash directive plus the standing
correction that the `Outreach Route` enum in `org-goals-enrichment-model.md` is stale (four prior
agents wasted effort flagging valid values as invalid).

**Defects visible from the briefs alone, pre-assigned to the agents:** Thinkific's `Why Them` calls a
**TSX-listed company** "the Vancouver startup that raised $22M," and its own `VSW Alignment` cites a
sourced **VSW 2019 panel** while `VSW` and `Past VSW Event Partner` are both FALSE. Trulioo's says
"$52M" for a company that raised **$394M USD at a $1.75B valuation in 2021**. SFU VentureLabs has its
**secondary contact's LinkedIn and Email columns swapped**. TECHTO's contact is recorded as "Alex
Normal" against a LinkedIn slug of `alexanderlnorman`, and the row has `Warm Lead? = FALSE` with a
`Warm Lead Person` and a `Warm Lead Path` filled in. Cansbridge's contact email is a **student
address at a different institution** (`@ivey.ca`). Vancouver Tech Journal has `Warm Lead? = TRUE` with
no person and no path. Wealthsimple has **no `Source Type`, no `Source Link`, no `Notes`, and no TRUE
checkbox** — no recorded reason for being in the tracker at all. Three rows (SFU VentureLabs,
Cansbridge, Vancouver Tech Journal) carry their **own name as an event-partner column**, which is
either meaningful or a tracker artifact and should be settled once.

### 2026-07-23 (Wave 5 applied — 5 genuinely-cold rows, 32 cell writes; 4 re-engagement rows held)

All 9 wave 5 memos landed. Applying them split cleanly in two, and the split is the wave's main
finding: **four of the nine rows are past or active VSW partners mislabeled as cold.** Applying cold
"we've been following you" copy to a returning sponsor would be actively wrong, and the cold→re-
engagement flip (with its `VSW` / `Past VSW Event Partner` checkbox change and tone reframe) is the
same strategy call held for Tej on Foresight/GAC/Angel Forum in wave 4. So:

**Applied (5 genuinely-cold rows, copy + read-then-append Notes, no checkbox/contact changes):**
Wealthsimple (380), Trulioo (352), The Cansbridge Fellowship (338), Smythe LLP (311), TECHTO (331).
All six clause fields per row except where the memo said keep (Cansbridge kept its verified
`Their Initiative` and `Their Goal`). Every initiative/goal/hook ran the coded grammar gate before
writing — all clean. One gate refinement carried from wave 4: an internal "and" *inside the goal*
(Wealthsimple's "invest and save") is a benign noun/verb list, so the composed-sentence connector-
"and" count now subtracts goal-internal "and"s rather than failing on them.

**Held for Tej (4 re-engagement rows — memos written, nothing applied):**
- **Thinkific (345)** — VSW **2019 sponsor in VSW's own words** ("sponsoring this event by providing
  a great venue"); CEO co-presented the Osler/Rhino panel. `VSW`/`Past VSW Event Partner` FALSE are
  wrong. Also: `Why Them` calls a **TSX-listed company** (IPO'd April 2021, ~C$1.17 now) "the startup
  that raised $22M" — that round was Sept 2020, led by Rhino.
- **SFU VentureLabs (301)** — lapsed **three-time VSW sponsor (2020, 2021, 2025)**, corroborated four
  ways incl. Viv's own 2024 note; both contacts already warm (Grace Sullivan filed VSW's contact form
  Dec 2024 and Katty replied; Ryan Cross in a live March 2024 negotiation). Secondary-contact
  LinkedIn/Email columns confirmed swapped. Flagship program is **Perago**, not "Marketing PowerUp."
- **VANTEC Angel Network (369)** — co-hosted **two official VSW 2018 sessions** + a **comped booth at
  VSW's 2024 Ecosystem Showcase** (arranged Stuart↔Katty↔Viv). "BC's longest-standing" is false
  (Angel Forum, 1997, predates it). WUTIF is the Accenture-Ventures trap — rejected. **NVBC Silver,
  min $7,500 confirmed** in the page HTML + 2026 PDF (a defensible cash ask).
- **Vancouver Tech Journal (365)** — active VSW partner: its own 2026-04-14 VSW explainer is
  **bylined by Katty Wang and Vivian Lago, VSW's two co-chairs**. Resolves the unexplained
  `Warm Lead? = TRUE` (the warm people are Viv + Katty). `Inventures = TRUE` likely phantom;
  `New Ventures BC = FALSE` is the mirror bug (should be TRUE). Also a **direct competitor** — runs
  paid Vancouver Tech Days + monthly VTJTalks into VSW's audience and sells into the same sponsors.

**URGENT, surfaced to Tej separately:** **Rhino Ventures is at `Status = Approved` with a rendered
COLD draft cleared to send**, but Rhino co-presented the same VSW 2019 session as Thinkific — so a
mis-toned cold note could go to a past VSW sponsor. Osler (256) is the third org on that session,
also unflagged. Not touched (approved, human-owned) — flagged for Tej to review before it sends.

**Pure-data checkbox bugs surfaced this wave (flagged, not flipped — mostly on *other* rows):**
Cansbridge's memo found **RBC and Inovia both carry `CanSbridge = FALSE` while their own Source Link
cites the Cansbridge sponsor page** (clean bugs on those rows). Trulioo's `BC Tech Technology Impact
Awards = TRUE` reflects a 2023 *win*, not a sponsorship — same winner-vs-sponsor distinction as SAP,
but here it argues for FALSE; left for Tej since the checkbox's intended semantics (win vs sponsor)
is his to define. Wealthsimple should **not** get a Toronto Tech Week flip (unpaid community partner,
the Notion pattern). VTJ's Inventures/NVBC pair above.

**Cross-cutting: the BC-angel/ecosystem cluster is a coordination hazard now large enough to name.**
VANTEC, Angel Forum, SFU VentureLabs, New Ventures BC and e-Fund are tightly interlinked (VANTEC
sponsors NVBC, co-locates with VentureLabs, peers with Angel Forum; several route through Viv/Katty)
— they should go out as one coordinated wave, not five independent asks. Same logic already applies
to the professional-services cluster (Smythe/BDO/Fasken share the VEF board) and the fintech cluster
(Wealthsimple/RBCx/Hiive/FrontFundr).

**Tally after wave 5:** all 32 Tier-2 non-drafted rows now have a deep-research memo in `docs/`; 33
rows have had copy applied (waves 1–5, minus RBC held and the 4 re-engagement rows held); RBC + the 4
re-engagement rows await a Tej decision; the 5 drafted rows (A100, Northleaf, The Syndicate, Vanedge,
Yaletown) have not been researched this cycle.

### 2026-07-23 (Re-engagement copy drafted for the 4 held rows — awaiting Tej + Andrew approval)

Per Tej: work up re-engagement copy for the 4 past/active VSW partners held from wave 5 (Thinkific,
SFU VentureLabs, VANTEC, Vancouver Tech Journal), following Andrew's templates closely, for one-pass
approval. Spun up 4 drafting agents (one per row); each read Andrew's verbatim Email A/B + LinkedIn
A/B (pulled from the "Thread with Andrew" Notion page) plus the playbook's re-engagement variant, and
its own research memo for the held `[initiative]`/`[goal]`/`[LI hook]` and the sponsor year(s).
Output assembled into **`docs/reengagement-drafts-for-approval.md`** (nothing written to the sheet or
to any Google Doc).

QA done before assembly: no em dashes in any outgoing subject/body/LinkedIn copy (all "—" hits are in
markdown headings/flags); every LinkedIn note ≤300 chars (Thinkific 252, SFU 251, VANTEC 271, VTJ
261); Andrew's Email A/B wording kept verbatim except the sanctioned re-engagement paragraph swap.

Two rows required an **adapted** re-engagement paragraph (flagged for Andrew's specific sign-off):
VANTEC and VTJ were participants/content partners, not cash sponsors, so the template's "supported us
in [year]" cheque framing was reworded to match the real relationship (VANTEC co-hosted 2018 sessions
+ a comped 2024 booth; VTJ's VSW explainer was bylined by co-chairs Katty + Viv and it co-ran VSW×
VTJTalks in 2024). Assignments: Thinkific = LinkedIn primary + Email A (chair@); SFU = Email A
(chair@); VANTEC = Email B (community@); VTJ = Email A (community@, warm-via-Viv/Katty preferred).

On approval, the follow-through sheet writes (held): flip `VSW` / `Past VSW Event Partner` TRUE on all
4; apply each memo's held clause values; fix SFU VentureLabs' swapped secondary LinkedIn/Email cells;
un-tick VTJ `Inventures` + set `New Ventures BC` TRUE; place the copy. Open blocker: SFU VentureLabs
has no verified email for Ryan Cross (route via grace@/info@ or verify first).

### 2026-07-23 (Re-engagement drafts placed — 4 rows into the outreach doc + tracker; Tej approved)

Tej approved the 4 re-engagement drafts ("good to go") and asked to add them to the spreadsheet +
outreach doc but NOT the data-quality corrections (he'll do those manually). Confirmed via Docs API
that the SA has edit access to the Tej-owned "Future Planning - Outreach Drafts" doc
(id 1Op9-2WQZYCjZ...), which is organized as nested tabs (Tier 1 / Tier 2 parents, one child tab per
org). The 4 target tabs (Thinkific t.6w8ciy6ljhke, SFU VentureLabs t.uoas1etsa6xg, VANTEC
t.e3yoej7msgoe, VTJ t.dz3wmzxv1coz) were **empty** — clean insert, nothing overwritten.

**Doc:** inserted each full draft (HEADING_1 title, a To/Contact/Route/Sender/row line, a "needs
Andrew sign-off / fill [two time options]" flag line, a "Personalization used" block, the Email
subject+body, and the LinkedIn connection note with its char count) into each tab via the Docs API,
with HEADING_1/HEADING_2 paragraph styles matching the doc's convention. Subjects, bodies and LinkedIn
notes were **parsed from `docs/reengagement-drafts-for-approval.md`** (not retyped) to avoid
transcription error, then verified by read-back. LinkedIn notes: Thinkific 252, SFU 251, VANTEC 271,
VTJ 261 — all ≤300.

**Sheet (per row, 7 cells each = 28 writes):** applied the held clause values (`Their Initiative`,
`Their Goal`, `LI Short Hook`, `Personalization Source` — all the memo-recommended re-engagement
values), set `Draft Variant` = "Email A/B (re-engagement)", `Drafted?` = TRUE, and advanced `Status`
Route identified -> "Drafted — awaiting approval". No `Notes` overwrite (append-only rule not needed
here — these are new draft-state columns).

**Deliberately NOT done (Tej is doing these manually — see the handoff list):** the `VSW` /
`Past VSW Event Partner` checkbox flips, the SFU VentureLabs swapped secondary-contact cells, the VTJ
`Inventures`/`New Ventures BC` checkbox fixes, the Warm Lead fields, and all contact-name/email/title
and Outreach Route changes. Open blocker recorded: SFU VentureLabs has no verified email for Ryan
Cross (route via grace@ / info@ or verify first). All four drafts still need Andrew's sign-off before
sending, and `[two time options]` needs Viv's real availability.

### 2026-07-23 (Status correction — 12 deep-re-enriched rows moved Route identified → Enriched)

Tej caught that column A hadn't been advanced after wave 4/5 copy was applied — these 12 rows were
still sitting at `Route identified`, the marker the 2026-07-22 batch flip set for "not yet
deep-re-enriched." That marker was now stale for them, so flipped forward one step per the Status
lifecycle (`scripts/tracker.ts`'s `STATUS_VALUES`, index 2→3, within the auto-advance range):
Mastercard, Microsoft for Startups, Mosaic Accelerator, NorthX, Notion, PacifiCan, SAP, Smythe LLP,
TECHTO, The Cansbridge Fellowship, Trulioo, Wealthsimple — all `Route identified` → `Enriched`.
Verified live pre-write that each was still exactly `Route identified` (guard against clobbering a
value someone else had already changed).

**Correctly left untouched:** RBC (research done, not applied — still belongs at `Route identified`)
and Metro Vancouver (never researched this cycle — still belongs at `Route identified`). The 4
re-engagement rows (Thinkific, SFU VentureLabs, VANTEC, Vancouver Tech Journal) are already ahead of
this at `Drafted — awaiting approval` from the same-day draft-placement work and were not touched.

### 2026-07-23 (36 full outreach drafts rendered into the doc — the "empty tab" backlog cleared)

Tej asked to render full drafts (not just enrichment-column updates) for every Tier 2 org whose doc
tab was still empty, matching the existing table-based format demonstrated by Graphite Ventures, and
to flip Status (column A) to signal drafted. Audited all 50 Tier 2 doc tabs first — the initial pass
missed that email bodies live **inside Docs API table cells**, not top-level paragraphs, so a
corrected table-aware extractor was required before trusting any "empty" read. That audit found: 4
already rendered by today's re-engagement work (paragraph format), 5 pre-existing table-format drafts
(A100, Graphite Ventures, Northleaf, Vanedge, Yaletown — used as the format reference), 1 just added
by Tej directly (The Syndicate, LinkedIn-note format), 2 correctly excluded (RBC held; Metro Vancouver
never researched), and **40 genuinely empty tabs** — of which 38 had current, this-cycle enrichment
data to draft from.

**Two rows held out and left untouched, flagged rather than silently drafted over:**
- **lululemon** — `Their Goal` contains a dollar figure ("...contribute $100 million to social impact
  organizations by 2030"), violating the outreach-copy-playbook's hard invariant #5 (no dollar
  figures). Pre-dates this cycle's grammar gate; never caught until now. Left at `Enriched`,
  un-drafted, pending a fixed `Their Goal` value.
- **Angel Forum** — contact block is corrupted (`LinkedIn URL: Irene Dorsman`, `Secondary Contact
  Email: irene Ángel de la Independencia` — garbled/wrong data, not a real email or URL). Left at
  `Enriched`, un-drafted, pending a contact-data fix.

**36 rows rendered** (23 email, 13 LinkedIn), each following Andrew's verbatim Email A/B or LinkedIn
A/B templates — reconstructed from the "Thread with Andrew" Notion page — with the render rule
(`ip = initiative.startsWith("your") ? initiative : "your work on " + initiative`), the locked
attendee figure (86 events / 5,000+ people), and fresh forward-looking call-time placeholders
(Tuesday July 28 / Thursday July 30, flagged for Viv to confirm). Channel (email table vs LinkedIn
note) was derived from each row's live `Outreach Route`; **Wealthsimple** correctly routed to its
**secondary** contact (Emily Naddaf) per `LinkedIn DM (Secondary)`. Confirmed via existing drafts
(Graphite/Northleaf/Vanedge/Yaletown) and applied consistently: a `Route: Email — shared inbox` row
gets an `ATTN {FirstName}:` subject prefix only when a named contact's title plausibly reads that
inbox (Accelerate Fund/Arden Tse-Principal, Alumni Ventures/Tuleeka Hazra-Director of BizDev, Centre
for Digital Media/Simran Bedi-Coordinator — all got ATTN); Aritzia has no named contact at all, so it
got a bare "Hello," open, no ATTN, matching the Vanedge/A100 precedent. Direct personal/work-email
routes never get ATTN. Two copy-artifact corrections applied silently as part of the render (not data
changes, just using the clean address): Amazon's email cell literally read "allisonl@amazon.com seems
to be valid" (used the clean address only); Aon's email had a ligature character (`ﬁ`→`fi` normalized
in the rendered `To:` field only, sheet cell untouched).

**Round-robin (Email A/B × chair@/community@, and LinkedIn A/B):** the historical thread across
existing drafts didn't cleanly reconstruct to a single deterministic sequence (checked and logged, not
guessed past), so the Email cycle restarted fresh at position 1 across this batch in tracker-row
order. The **LinkedIn A/B alternation did reconstruct cleanly**: sorting all LinkedIn-note orgs
(13 new + The Syndicate) by tracker row and alternating A/B from position 1 lands Syndicate — which
Tej authored independently — at position 12 = B, matching its actual value exactly. Used that
confirmed sequence for the 13.

**Two rendering bugs caught and fixed before the real batch, via a single-org test (Absolute
Software) read back before scaling:** (1) inserting into 10 table cells in ascending index order
corrupts everything, since each earlier insert shifts every later index — fixed by sorting all
per-tab inserts in **descending** index order before writing. (2) the "Personalization used" heading
style was computed from the table's pre-fill `endIndex`, which goes stale the moment any cell-fill
insertion happens before it in the write — fixed by adding a **Phase D**: re-fetch the doc after all
cell fills land, locate each "Personalization used" paragraph by searching its actual text (not a
computed offset), then style it. Also matched Graphite's exact structure once inspected closely: the
final table row (the email body) sits entirely in **column 1**, with column 2 left blank — not
label|value like the first four rows.

**Verified post-write, all 36:** every target tab now contains a `Subject:`/table-row (23) or
`Connection note` (13) — zero missing; the 4 held-out orgs (Angel Forum, lululemon, RBC, Metro
Vancouver) confirmed still empty/untouched in both the doc and the sheet; all 36 sheet rows confirmed
flipped to `Status = Drafted — awaiting approval`; `Draft Variant` set to `Email {A/B} · {sender}@` or
`LinkedIn {A/B} · Viv's profile` per row, matching the existing column convention. `Drafted?` and
`Draft Link` were left untouched, matching the precedent set by the five pre-existing table-format
rows (none of which have `Drafted?=TRUE` either) and because `Draft Link` was already pre-populated
with each row's tab anchor before this cycle began.

**2026-07-23 — Andrew's copy feedback applied to all 36 drafts + format switched to the "Format"
tab; lululemon's dollar-figure clause replaced.** Andrew reviewed the 36-draft render and asked for
three fixes, applying to every draft going forward (documented in
[docs/outreach-copy-playbook.md](docs/outreach-copy-playbook.md)'s "Andrew's copy revision" section):
the CTA line (whichever form — Email A's bulleted ask or Email B's single-line ask) collapses to
"If you're open to it, we'd love to set up a brief call to chat about how our work can help you
reach your organizational goals?"; two trailing lines (the times-or-redirect line, the one-pager
line) are deleted outright; the LinkedIn connection note gets new canonical wording. Separately, Tej
rejected the 5-row table formatting we'd modeled on Graphite Ventures and pointed at the "Format" tab
in Archive (a real PwC draft already in the right shape) as the correct structure: `HEADING_1`, blank,
a 3-row × 2-col table (`To:` / `Subject Line:` / `Additional Info`), blank, body as **plain paragraphs
directly in the tab** (not inside a table cell), `HEADING_2` "Personalization used" + clause lines.

Spun up two background agents (per Tej's request) on disjoint tab sets after doing the content/format
design work myself (no ambiguity left for them — pure Docs-API execution):
- **Agent 1** rewrote all 23 email-format tabs (Absolute Software, Accelerate Fund, Ada CX, Air
  Canada, Alumni Ventures, Amazon, Aon, Apple TV, Aritzia, ATB Financial, Centre for Digital Media,
  Dell, Foresight Canada, FrontFundr, Global Affairs Canada, Lovable, Mastercard, Mosaic Accelerator,
  PacifiCan, SAP, Smythe LLP, TECHTO, The Cansbridge Fellowship) to the new structure + copy, reusing
  the descending-index-order and re-fetch-before-restyling fixes documented above.
- **Agent 2** rewrote all 13 LinkedIn connection notes (Accenture, Airbus, AMD, Aspect Biosystems,
  ATCO, Google for Startups, Hiive, LinkedIn, Microsoft for Startups, NorthX, Notion, Trulioo,
  Wealthsimple) — verified complete, all 13 confirmed matching the new text with correct `(n/300)`
  counts (267-287 chars, all under the cap), and confirmed nothing else in each tab (title, To/Contact
  lines, Personalization used section) was disturbed.

**LinkedIn note had to be compressed, flagged for Andrew's sign-off:** his literal wording runs
390-410 chars once a real name/org is substituted — over LinkedIn's 300-char connection-note cap
(unchanged constraint from the original render). Compressed to preserve every substantive claim
(co-chair identity, decade of events, thousands each year, org's alignment, expanding to larger
partners next year, invitation to connect) while fitting the worst-case real name/org combo in the
tracker (287 chars). This is new copy, not pre-approved — logged in the playbook as needing sign-off.

**Explicitly left untouched, as before:** A100, Northleaf Capital Partners, Graphite Ventures,
Vanedge Capital, Yaletown Partners, The Syndicate, Angel Forum, RBC, Metro Vancouver, and the 4
re-engagement tabs (Thinkific, SFU VentureLabs, VANTEC Angel Network, Vancouver Tech Journal).

**lululemon's `Their Goal` clause fixed** (was `Status=Enriched`, never drafted — the dollar figure
is what excluded it from the 36-draft batch). Tej asked to find something else relevant given
"they're innovators." Deep-scraped `corporate.lululemon.com`: beyond the Community Wellbeing Grant
(mental-health/wellness giving, not a founder/tech hook, and the source of the banned $100M figure),
lululemon's Raw Materials Innovation team runs a real multi-year run of startup investments/
partnerships in sustainable-materials tech (ZymoChem bio-based nylon, Samsara Eco enzymatic
recycling, Epoch Biodesign, Geno) — most recently a **10-year plan with Samsara Eco** (announced
Jun 11, 2025) to scale recycled nylon/polyester. This is a genuinely founder/investor-relevant
innovation hook with no dollar figure needed. Wrote `Their Initiative` → "the Samsara Eco 10-year
recycled-materials plan", `Their Goal` → "sourcing recycled raw materials and building a circular
ecosystem for high-performance products", `Personalization Source` → the announcement URL, `LI Short
Hook` → "your Samsara Eco recycled-materials plan". Old Community Wellbeing Grant material was
**not deleted** — appended a dated addendum to `Why Them` and `VSW Alignment` instead, per the
never-bury-existing-content rule, in case that angle is wanted for a different draft later.

**Angel Forum contact data fixed, then lululemon drafted (2026-07-23, same session).** Tej confirmed
Angel Forum's primary contact (Natalie Heili, Marketing, natalie@angelforum.ca — already correct in
the sheet, no change needed there) and separately the corrupted secondary-contact cells (flagged
2026-07-22, not touched until now) turned out to be a genuine transposition, not garbage: "Irene
Dorsman" was sitting in the `LinkedIn URL` column (a name, not a URL) instead of the empty `Secondary
Contact Name` column — moved it there (her `Secondary Contact Title = CEO` was already correct,
confirmed via the team page in the prior enrichment pass). `LinkedIn URL` cleared (Natalie's actual
LinkedIn URL isn't known — left blank, not guessed). `Secondary Contact Email` previously held the
garbled non-email "irene Ángel de la Independencia" — cleared, with the original text preserved in
`Notes` per the never-silently-drop rule. `Last Touch Date` previously held "Emailed July 15" (a
channel+date mashed into a date field) — split into `Last Touch Date=2026-07-15` and `Last Touch
Channel=Email`. Angel Forum itself was **not drafted** in this pass — `Why Them` still carries an
unconfirmed flag that it may have already run a VSW 2025 session (Greg Smith Award angle), which per
[[project_returning_vsw_partners_mislabeled_cold]] means it needs the past-partner history checked
with Viv before cold copy goes out, not folded into this data-hygiene fix.

lululemon: rendered the actual draft now that the clause fix landed. Corrected `Outreach Route` on
read was `LinkedIn DM`, not email (no email address exists in the row) — so this is a **LinkedIn**
draft, not an email draft, into lululemon's (previously empty) tab. Round-robin: LinkedIn A/B has
been a clean, 7-7 balanced alternation across the 13+Syndicate drafted so far; inserted lululemon as
`LinkedIn A` (its row, 209, falls immediately after LinkedIn-org's row 203 = B in tracker-row order,
so A continues the local alternation without needing to renumber anything already written). Content:
`HEADING_1` "lululemon — LinkedIn A / Viv's profile", `To:`/`Contact:` lines (Alexa Hatzitolios,
Global Partnerships, Route shown as "LinkedIn" per the existing display convention, tracker row 209),
`HEADING_2` "Connection note (274/300 characters)" + the new canonical-template note built from the
Samsara Eco clause, `HEADING_2` "Personalization used" + the 3 clause lines. Verified by reading the
tab back — matches the other 13 LinkedIn tabs' structure exactly. Sheet: confirmed `Status` was still
exactly `Enriched` before writing (guard against clobbering any other change), then flipped
`Status → Drafted — awaiting approval`, `Drafted? → TRUE`, `Draft Variant → LinkedIn A · Viv's
profile`; `Draft Link` was already correctly pre-populated with this tab's anchor.

**Angel Forum and RBC drafted (2026-07-23).** Tej cleaned up Angel Forum's `Why Them` himself (the
unconfirmed-past-VSW-partner caveat is gone) and explicitly asked for both to be drafted despite the
two standing holds — Angel Forum's re-engagement-vs-cold question and RBC's RBCx-collision concern —
so proceeded on his authority rather than re-raising either. Both are Email drafts (Angel Forum:
`Email (Work)` → Natalie Heili; RBC: `Email (Work, Unverified Format)` → John Nixon), continuing the
Email A/B × chair/community round-robin from where the 23-org batch left off (last was Cansbridge,
A/chair; next two in the fixed 4-state cycle are B/community → Angel Forum, A/community → RBC).
Clauses were already clean and gate-passing from prior enrichment (Angel Forum: Greg Smith Award /
founder-investor collaboration; RBC: FinSec Incubator / fintech+cybersecurity PMF) — no new research
needed, just composing and rendering.

**New Docs API bug found and fixed while rendering these two:** filling the table's 6 cells (correct,
descending order) and then inserting the post-table body text **in the same batchUpdate**, using a
`tableEndIndex` computed before any of that batch's edits landed, corrupts the draft — every cell-fill
insertion before it in the batch shifts the true end-of-table position forward, so the stale index
lands the entire body-and-personalization block in the middle of whatever text is in the first cell
(here: split "natalie@a" + [~1000 chars] + "ngelforum.ca" mid-address). Caught on read-back before
reporting done, both tabs cleared and rebuilt correctly with the post-table insert as its own
**separate** phase — re-fetch for the fresh table end index *after* the cell fills complete, then
insert. Also caught and fixed a smaller formatting slip: `insertTable` inserts its own leading blank
paragraph, so also inserting one explicitly produces two blank lines under the heading instead of the
one every other drafted tab has — fixed by deleting the extra blank paragraph, verified against
Absolute Software's tab to confirm single-blank-line is in fact the standard.

Verified both by reading back: table structure, body paragraphs, and "Personalization used" heading
all match the 23-org batch's structure exactly. Sheet: confirmed each row's prior `Status` (Angel
Forum: `Enriched`; RBC: `Route identified`) before writing, then flipped both to `Status = Drafted —
awaiting approval`, `Drafted? = TRUE`, `Draft Variant` set per the assignment above.

### 2026-07-23 (Adobe enrichment + LinkedIn draft)

- **2026-07-23 — Adobe enrichment + LinkedIn draft:** Deep-scraped adobe.com (homepage + fast-facts page) via Firecrawl JSON extraction. Initiative: `Adobe for Startups` (confirmed on adobe.com homepage; Hannah Steinhardt is Head of Adobe for Startups). Goal: `amplifying human ingenuity with AI` (sourced from adobe.com/about-adobe/fast-facts.html — Adobe's own stated mission framing). Source: `https://www.adobe.com/ | https://www.adobe.com/about-adobe/fast-facts.html`. Grammar gate passed: "We've been following your work on Adobe for Startups and your focus on amplifying human ingenuity with AI." LinkedIn connection note: 271/300 characters — within cap. Created new Adobe tab (tabId `t.8dv20pc8j5j2`) under Tier 2 parent in the outreach doc via `addDocumentTab`, rendered LinkedIn A format, verified by read-back. Sheet writes: Outreach Route → `LinkedIn DM`, Initiative/Goal/Source/Alignment/LI Hook/Draft Variant all filled, Status → `Drafted`, Drafted? → `TRUE`. All verified by read-back. Route: LinkedIn DM (Hannah Steinhardt, Head of Adobe for Startups). Note: "Outreach Tier" column no longer exists on the sheet (index 60 is now a second Notes column) — skipped that write per header-row resolution.

- **2026-07-23 — Cloudflare Email B draft:** Existing clauses verified (Cloudflare for Startups / giving early-stage founders more runway). Grammar gate passed. Created new Cloudflare tab (tabId `t.ur7jivcybosp`) under Tier 2 parent in the outreach doc via `addDocumentTab`, rendered Email B / community@ format with the corrected multi-phase Docs API pattern (descending cell fills, separate re-fetch before post-table body insert, heading styles applied by content search). Route: Email (Generic Inbox) (os-sponsorship@cloudflare.com). Sheet writes: Outreach Route → `Email — shared inbox`, Draft Variant → `Email B`, Status → `Drafted — awaiting approval`, Drafted? → `TRUE`, Draft Link → tab URL. All verified by read-back. "Outreach Tier" column does not exist on the sheet — skipped per header-row resolution.

### 2026-07-27 (cal.com booking notification feature)

- **2026-07-27 — New feature: cal.com booking → Slack notification.** Monday's week plan (`assets/artifact-src/week-plan.html`) has "Cal link live" as the morning's first production block, and Tej asked for a notification into `#vsw-future-planning` every time someone books through that link, tagging him to confirm with Andrew/Vivian and update the sheet. Architecture decision: added a plain HTTP endpoint (`POST /webhooks/calcom`) to this same service/Railway deployment rather than standing up a separate one — the Slack side already runs Bolt in Socket Mode (no inbound port), and `.env.example`'s `PORT` var had been sitting unused since Stage 0. New files: `src/calcom/types.ts`, `parseBooking.ts` (pure extraction — attendee name/email from `payload.attendees[0]`, company from `responses` matched first by the exact identifier Tej configured in cal.com (`your-company-name`) then by common variants then by a case-insensitive label search for "company", so a live payload-shape mismatch surfaces a `companyFieldMissing` flag in the message rather than silently dropping the one field Tej called out as most important; notes from the built-in `responses.notes`), `verifySignature.ts` (HMAC-SHA256 hex over the raw body vs the `x-cal-signature-256` header, per cal.com's own webhook docs — https://cal.com/docs/developing/guides/automation/webhooks), `formatMessage.ts` (Block Kit — company + Pacific date/time as the bold headline so both are visible without opening anything else per Tej's ask, the `<@SLACK_ADMIN_USER_ID>` mention + "confirm with Andrew and/or Vivian, then update the spreadsheet" line, Name/Email/Notes as a plain bullet list per slack-communication-style.md, and the sheet link (`masterSheetLink()`) in a `context` block per the same doc's "secondary info is visually secondary" principle), `server.ts` (the actual HTTP listener, opt-in on `CALCOM_WEBHOOK_SECRET` being set — if unset it logs a warning and skips starting rather than crashing the whole bot's boot over one new feature). Wired into `src/index.ts` right after `app.start()`. Added `formatPacific12h` to `src/time.ts` (same America/Vancouver convention as the rest of the file) for the 12-hour, capital-AM/PM time format Tej asked for. Copy in the message was run through the Stop Slop Guide and Tej Nathoo Voice System Notion pages per his request (no em dashes, no filler openers, direct/active phrasing) — the one deliberate wording change from Tej's literal ask was "and prompt to update the spreadsheet" → "then update the spreadsheet" (cutting a slightly indirect verb per the Stop Slop "be direct" rule); flagged to Tej for approval, not decided silently.
  - **Human steps still needed before this goes live (not done by this session — no Railway/cal.com dashboard access):** (1) enable a public domain for this Railway service (Settings → Networking → Generate Domain, or `railway domain` — never needed before since Socket Mode has no inbound port); (2) create the webhook in cal.com (Settings → Developer → Webhooks): Subscriber URL = `https://<that domain>/webhooks/calcom`, trigger = Booking Created, and set a secret there; (3) put that same secret in `CALCOM_WEBHOOK_SECRET` locally and on Railway (`railway variable set`).
  - **Known open item, not a blocker:** the exact `responses` key cal.com uses for the custom "Company name" question (identifier `your-company-name`, confirmed by Tej) hasn't been checked against a real payload yet — cal.com's own docs don't spell out whether it's the literal identifier string. `parseBooking.ts`'s multi-candidate + label-search fallback is the mitigation; Monday's own plan already includes booking a real test meeting through the link to confirm the notice-period rule, which doubles as the first live check of this parsing before the link goes to Andrew.
  - Verify: `npx tsc --noEmit` clean, `npx vitest run` 180/180 (new: `tests/calcom-parseBooking.test.ts`, `tests/calcom-verifySignature.test.ts`, `tests/calcom-formatMessage.test.ts`, plus 2 new cases in `tests/time.test.ts`). Not yet live-tested — needs the human steps above, then a real test booking.

### 2026-07-27 (Tier 3 selection — untiered pool scoring)

- **2026-07-27 — Wrote `Tier 3` to 44 `master-prospects` rows (column BI), Tej's manual selection.** Tej filtered the live sheet to `Tier` = blank/3/5 AND `Warm Lead Person` (col C) blank — the untiered/no-warm-path pool — and asked for the top 44 to prioritize, using only what's already on the sheet (`Why Them`, `Notes`), no new research. Header row re-read fresh per the live-column-reshuffling pattern: this sheet has been restructured heavily since AGENTS.md's column map was written (col A is now `Status`, not `Prospect ID`; `Tier` now lives at BI, added post-map). Read A3:BW1000 (998 rows), applied the two filters programmatically (296 rows matched), excluded 3 `Status = Archived` rows (2 explicitly noted as defunct orgs), leaving 293 candidates. Ranked on: past-VSW-sponsor language in `Why Them`/`Notes`, named-dollar sponsorship evidence at comparable events (CANSEC/NVBC/Elevate tiers), fresh funding/capital raises, active founder-facing programs, BC/Vancouver roots; deprioritized blank `Why Them` and rows flagging identity/verification problems (e.g. "Firecrawl's results didn't clearly match"). Proposed list iterated once in chat — Tej swapped out Granted, Wizard Labs, and Techstars for Cohere, Procurify, and Hootsuite. Final 44 rows (by `Organization Name`, row #): Donnelly (114), Flywheel (135), FED (129), Grammarly (149), Manning Elliott (213), McCarthy Tétrault (216), Northeastern University (241), Sparkbridge (314), TransLink (351), WorkSafe BC (388), BC Tech (42), IBM (163), M2M Tech (211), SRED.ca (318), Lighthouse Labs (200), CAE (67), Hanwha (155), Pomerleau (266), Roshel (285), MDA Space (218), BAE Systems (36), Rogers (284), Cohere (91), Cloudflare (88), Cisco (82), Google (145), JPMorgan (184), OpenAI (254), NVIDIA (250), Salesforce (289), Databricks (102), Figma (131), Stripe (323), WELL Health Technologies (383), Dapper Labs (101), KOHO (190), Moment Energy (224), Sanctuary AI (290), Wayve Technologies (379), Waabi (377), Procurify (268), Hootsuite (159), Teralys Capital (336), Inovia Capital (174). Method: throwaway `.ts` script per the CLAUDE.md live-sheet pattern, auth via service account, org name at column B re-verified against each target row immediately before writing (guards against row drift between the read pass and the write pass), dry-run first then `--write`, `spreadsheets.values.batchUpdate` (RAW) — 44/44 cells confirmed updated, temp script deleted after. No other columns touched; `Why Them`/`Notes` left as-is (not verified — see `project_why_them_unverified` memory).

### 2026-07-28 (Tier 3 swap — 3 rows out, 3 in)

- **2026-07-28 — Swapped 3 `Tier 3` rows for 3 replacements, Tej's directive after spotting two warm-tagged rows in what's supposed to be a cold-only tier.** Tej asked for a quick Andrew update on Tier 3 progress; while pulling the "at Route identified" count, flagged that **Microsoft** (row 221) and **Planet Food** (row 262) both carry `Warm Lead Person = Viv` — they'd landed in Tier 3 via the 2026-07-21 Tier 2→Tier 3 demote pass (a different origin than the 44-row manual cold-pool selection above), and picked up a warm-lead owner sometime after. Tej confirmed Tier 3 is meant to be cold-only (no `Warm Lead Person`) and asked to pull both. Separately, Tej called **FED** (row 129, one of the original 44, already `Status = Archived`) a poor fit — doesn't align well, unlikely to sponsor — and asked to pull it too, no replacement criteria given beyond "find another."
  - **Removed:** Microsoft and Planet Food `Tier` → `Warm` (not blanked — they have a real warm-lead owner, so they belong in the existing `Warm` tier rather than falling out of tracking entirely). FED `Tier` → blank (untiered; stays `Archived`).
  - **Replacements sourced from the same untiered/cold pool as the original 44** (`Tier` blank or `Tier 5` AND `Warm Lead Person` blank AND `Status != Archived`, 230 rows), scored with the same deterministic method as the original Tier 2 ranking (Source Type: Past VSW sponsor +300 / Past VSW event partner +250 / Comparable event sponsor +150 / Ecosystem player +50; `Why Them` keyword bonuses for $/sponsorship-tier language, public-company language, Vancouver/BC HQ language). **Granted, Techstars, and Wizard Labs were the top 3 by score but excluded** — Tej already passed on all three when swapping them out of the original 44-row selection on 2026-07-27, so re-proposing them would relitigate a decision he'd already made. Proposed the next tier of candidates (GrowthZone, Kraken Robotics, VRIFY, LightIntegra Technology, Hyper Hippo Entertainment, CCTech, Backstretch, VEF) with a recommendation; Tej approved the top 3 as proposed: **Kraken Robotics** (row 193, CANSEC Silver sponsor + fresh $115M raise), **VRIFY** (row 376, Vancouver-based, $6M raise, Vancouver Tech Journal Core Partner), **LightIntegra Technology** (row 201, Vancouver, $9.88M raised, BC Tech award winner) — all `Tier` blank → `Tier 3`.
  - **Method:** throwaway `.ts` script per the CLAUDE.md live-sheet pattern, dry-run printed all 6 target rows/current values first, org name re-verified against column B immediately before writing (row-drift guard), then `--write` via `spreadsheets.values.batchUpdate` (RAW) on column BI only. All 6 writes confirmed by a separate read-back. Tier 3 total held at 50 throughout. No other columns touched — the 3 new rows keep whatever `Why Them`/`Notes` content they already had (not authored new copy, not verified — see `project_why_them_unverified` memory). Temp scripts deleted after.
  - **Effect on the Andrew update this was blocking:** Tier 3 "at or past Route identified" count dropped from 20/50 to 18/50 — Microsoft and Planet Food had both already reached `Route identified` and are no longer in the cold pool being counted; the 3 replacement rows enter at `Sourced`, not yet routed.

- **2026-07-28 (same day) — LightIntegra Technology (row 201) sunset; swapped for Nimbus Synergies.** Tej reported the company had shut down, one day after it was added to Tier 3 in the swap above. Asked for a replacement.
  - **Replacement search:** re-scored the 5 candidates left over from the same-day scoring pass (GrowthZone, Hyper Hippo Entertainment, CCTech, Backstretch, VEF) — all still sitting untiered in the cold pool. Recommended **VEF (Vancouver Entrepreneurs Forum)** as the top deterministic score (Comparable event sponsor + both $ and Vancouver `Why Them` bonuses); flagged GrowthZone's higher raw Source Type score (Past VSW event partner) as a false lead since its own `Why Them` text frames it as an in-kind tech/platform partner, not a cash sponsor. Tej redirected: wanted a **life-sciences-fit replacement** specifically, since LightIntegra was a diagnostics company — a criterion the deterministic score doesn't capture.
  - Searched the cold pool (same `Tier` blank/`Tier 5` + `Warm Lead Person` blank + `Status != Archived` filter) for life-sciences/health-tech keyword hits in Category/Subsector/Why Them: 5 candidates (Nimbus Synergies, NZ Technologies, Sandpiper Ventures, Spring Activator, Innovate Calgary). Recommended **NZ Technologies** (row 251, Vancouver med-tech, BC Tech Technology Impact Award winner) as the closest direct-company parallel to LightIntegra's shape; named the other 4 (mostly VCs/accelerators) as alternatives. **Tej chose Nimbus Synergies** (row 240, Vancouver health-tech VC, $30M evergreen seed fund) instead — a life-sciences-*investor* angle rather than a direct operating-company swap.
  - **Writes:** LightIntegra Technology — `Status` → `Archived`, `Tier` (BI) → blank, `Notes` (BH) appended (was blank) with `"Sunset (2026-07-28) — company shut down; pulled from Tier 3, replaced by Nimbus Synergies."`. Nimbus Synergies — `Tier` (BI) → `Tier 3` (Status unchanged, stays `Sourced`). Same method as above: dry-run printed both rows' current values, org name re-verified against column B immediately before writing (row-drift guard passed for both), `--write` via `spreadsheets.values.batchUpdate` (RAW), both writes confirmed by read-back. Temp scripts deleted after.
  - **Correction to the swap above's "held at 50" claim:** a fresh count immediately after this write (prompted by Tej asking "why is it only 49 records?") showed Tier 3 at 49, not 50 — and a snapshot taken at the *start* of this conversation, before either of today's edits, already showed 49 (including LightIntegra). So the earlier swap's 3-out/3-in math was never actually verified by a real count; either that swap miscounted at the time or a row lost its `Tier 3` value independently sometime after. Root cause not identifiable after the fact — the sheet doesn't retain that history. **Fix:** rescored the full 242-row cold pool with the same deterministic method, surfaced 4 candidates tied at the top (VEF, Province of British Columbia, Draganfly, Uber — all `Comparable event sponsor` + real `$` + BC signal, except Uber which has `$` + BC via its existing BC Tech partnership but is not BC-HQ'd). Tej picked **Uber** (row 356) — `$1M Uber Transit Innovation Fund` for public-agency mobility pilots, existing BC Tech Technology Impact Awards partnership. Write: `Tier` (BI) → `Tier 3` only (Status unchanged, stays `Sourced`); dry-run confirmed org name + blank `Tier`/`Warm Lead Person` first, `--write` via `spreadsheets.values.update`, confirmed by read-back. **Tier 3 now verified at 50 by direct count**, not by arithmetic assumption.

- **2026-07-28 (same day) — University of Toronto (row 359, `Category: University`) swapped out of Tier 3 for Bell, Tej's directive to replace it with "another company" (an operating business, not an academic institution).** Rescored the cold pool restricted to actual companies (excluding government/university entries like Invest Ontario), surfacing Bell, Boeing, BRP, Calian, and CIBC as top candidates — all tied at the same deterministic score, each with a CANSEC Gold (~$25,750 CAD) or equivalent sponsorship habit on record. Recommended **Calian** (Calian Ventures' post-startup-phase program is a close structural match to VSW's scaling-founder audience); **Tej chose Bell** instead (row 48) — national telecom with a repeated, cross-event sponsorship pattern (CANSEC Gold, Web Summit, Toronto Tech Week).
  - **Writes:** University of Toronto `Tier` (BI) → blank (Status unchanged, stays `Sourced` — not archived, just untiered; no fit issue beyond "not a company"). Bell `Tier` (BI) → `Tier 3`. Dry-run confirmed both org names + current values first, `--write` via `spreadsheets.values.batchUpdate` (RAW). **Note on the read-back check:** the confirmation script that reads a `B{row}:BI{row}` range and grabs the last array element is unreliable — Sheets trims trailing blank cells from a range read, so when the target column (BI) is blank the "last" element resolves to whatever the last *non-blank* column actually is (misread as `"[AD note: see notes at UBC.]"` for University of Toronto here, which was never actually written — that's stray content from an earlier column). Re-verified with direct single-cell reads (`BI359`, `BI48`) instead, which confirmed the write was correct (`BI359` blank, `BI48` = `Tier 3`). **Future read-back checks should always read the exact target cell directly, not a row range with a trailing-element assumption.** Temp scripts deleted after. Tier 3 held at 50.

- **2026-07-28 (same day) — Appended Bell Ventures to `data-staging` (row 1160), Tej's direct request with a source URL** (`bce.ca/about-bce/bell-ventures/team`, plus a general-enquiries email pasted in chat: `BellVentures@bell.ca`). No existing "Bell Ventures" row found (checked all 1159 existing rows) — related-but-distinct from "Bell" (row 252, already `Merged-to-Master`) and "Bell Media" (row 852, `Review`), so not a straightforward auto-merge.
  - **Research:** WebFetch on the team page (name-only, no descriptive text) and the Bell Ventures overview page (`bce.ca/about-bce/bell-ventures`) for grounded facts — per [docs/outreach-copy-playbook.md](docs/outreach-copy-playbook.md)'s "research the org's own site" principle, applied here even though this is a staging add, not outreach copy. Confirmed: corporate innovation/investment arm of BCE Inc., partners with early-stage/growth companies leveraging Bell's network infrastructure (5G/fiber) to accelerate technology adoption. No fund size or investment count published.
  - **Row:** Category `VC`, Sector `Corporate VC (Telecom)`, Why Them (grounded, ≤20 words per PRD §6), Source URL = the team page link, `Duplicate?` → `Review` / `Matched Org` → `Bell` (flagged for Tej's manual dedup call rather than auto-merged or ignored, matching the Bell Media precedent). `Contact` (K) left blank per the hard "always blank" rule (PRD §5/§Non-goals, D3) — the `BellVentures@bell.ca` general-enquiries address was **not** written anywhere in Staging (no column fits a generic inbox address) but was surfaced to Tej in-chat rather than silently dropped; earmarked for `master-prospects`' `Generic Intake Email/Form` column if/when this row gets promoted. `Extractor` = `"Manual (Claude Code, WebFetch)"` (not one of the service's own enum values — this was a direct sheet write, not the deployed pipeline). Confirmed by asking Tej to review the planned row before writing.
  - **Method:** dry-run checked the sheet's tail (rows 1155–1159) to confirm no drift before appending, `--write` via `spreadsheets.values.append` with `INSERT_ROWS`, confirmed by reading back the exact `updatedRange` returned by the API (not a guessed row number). Temp script deleted after.

- **2026-07-28 (same day) — Added Anna Peirce (Field Marketing Programs) as a contact for Adobe (row 11), Tej's direct request.** Both named contact slots were already filled (Primary = Hannah Steinhardt, Head of Adobe for Startups; Secondary = Olli Coupe, Managing Director – Adobe Private Capital) — asked Tej which to overwrite rather than guessing; he chose to replace Secondary. Wrote `Secondary Contact Name` (AY) → `Anna Peirce`, `Secondary Contact Title` (AZ) → `Field Marketing Programs`, `Secondary Contact LinkedIn` (BA) → `https://www.linkedin.com/in/annapeirce/` (no email given, left blank). Per the no-silent-overwrite rule, appended Olli Coupe's outgoing info to `Notes` (BH) rather than discarding it: `"Prior Secondary Contact (replaced 2026-07-28): Olli Coupe, Managing Director - Adobe Private Capital — https://www.linkedin.com/in/ollicoupe/"`, preserving the existing Notes content ahead of it. Dry-run confirmed org name + current values first, `--write` via `spreadsheets.values.batchUpdate` (RAW), confirmed by read-back. Temp script deleted after.

### 2026-07-28 (follow-up-due view — carried from Monday's plan)

- **2026-07-28 — Built the "follow-up-due view" on `master-prospects`, the task carried over from Monday's week plan** ("A filtered view that surfaces who is owed a follow-up, so the list generates itself instead of depending on memory"). Two inputs were missing before this could be built and Tej supplied both: (1) the interval rule — Tej pointed at the "Thread with Andrew" Notion page (`38e6b6f2-b95b-8068-b183-c49d924e5906`) rather than inventing a number; Andrew's actual 2026-07-22 instruction reads *"send follow-up emails two to three business days later to anyone who has not yet responded to our initial outreach"* — implemented the trigger at the **2-business-day mark** (the start of Andrew's window, so nothing slips past it before the 3-day end); (2) the 8 rows currently `Status = Sent` (City of Vancouver, CVCA, EY, National Bank of Canada, Sequoia Capital, Trade and Invest BC, Valhalla Private Capital, Version One Ventures) all have blank `Last Touch Date` and there's no Gmail/inbox access in this environment to backfill real send dates — Tej chose to leave them blank rather than have dates fabricated; they will not surface as due until `Last Touch Date` is filled in (by Tej, or a future session with the actual send dates).
  - **Scoping found the sheet's tracking columns are mostly unused**, worth flagging: `Last Touch Date` (BD) 4/998 filled and inconsistent (mix of real dates and free text like "Emailed him July 14"); `Next Step` (BF) 0/998 filled; `Next Follow-up Date` (BG) has exactly one non-blank cell, on **Rogers** (row 284), and it's stray text (a contact's job-mandate description, not a date) — left untouched, flagged for Tej to clean up, not touched without his say-so per the no-silent-overwrite rule.
  - **Build:** new column `Follow-up Due?` at **BX** (grid expanded from 75 to 76 columns via `appendDimension`), formula per row (rows 3–424, i.e. through the last org row + a 10-row buffer for near-term additions): `=IF($A{n}<>"Sent", FALSE, IF($BD{n}="", FALSE, IFERROR(WORKDAY(IF(ISNUMBER($BD{n}),$BD{n},DATEVALUE($BD{n})),2)<=TODAY(), FALSE)))` — TRUE only when `Status = Sent` AND `Last Touch Date` is populated AND 2 business days have elapsed; a date that can't be parsed (legacy free-text) fails safe to FALSE rather than erroring, so this column silently misses any row with garbage `Last Touch Date` text — worth an occasional spot-check, not a guarantee. Then a Google Sheets filter view (`addFilterView`, `filterViewId 1057117620`, titled **"Follow-up due"**) scoped to columns A–BX, rows 2–424, criterion `CUSTOM_FORMULA =$BX2` (i.e. filters to `Follow-up Due? = TRUE`) — this is the actual "view" Tej opens to see who's owed a follow-up, no memory required.
  - **Verified:** read back BX2's header, BX3–BX5's formula text (`valueRenderOption: FORMULA`) and computed values, and all 8 `Status = Sent` rows directly (`BX` = `FALSE` for all 8, correct — their `Last Touch Date` is blank) before considering this done. Filter view existence re-confirmed via a fresh `spreadsheets.get`.
  - **Known limitation, not a blocker:** the formula fill only covers rows 3–424; any `master-prospects` row appended beyond row 424 (via Promotion or manual add) needs the `Follow-up Due?` formula copied down manually until this gets automated (not done — out of scope for this pass, this was a Sheets-native build, not a `src/` code change).
  - **Method:** two throwaway `.ts` scripts per the CLAUDE.md live-sheet pattern (`build_followup_view.ts` dry-run-then-`--write`, `verify_followup.ts` read-back), both deleted after. `check_tmp3.ts` (an untracked leftover from an unrelated prior session, unrelated to this task) was also found sitting in the repo root and deleted as part of the same cleanup pass.

- **2026-07-28 (same day) — Extended the follow-up work into `overview-stats`, per Tej's follow-up question ("where in the stages/phases should follow up due + follow up issued fit... I'd want to use the drill-down dropdown for the two follow up categories").** First checked whether this reopened a settled decision: `docs/org-goals-enrichment-model.md` §8 explicitly lists `Follow-up sent` under "Stages I deliberately left out" — ambiguous at the 2nd follow-up, and adding it to `Status` would break the 16-value stage partition `overview-stats` reconciles against. Surfaced that to Tej rather than silently building around or against it; he confirmed he didn't actually need it in `Status` — he wanted the count and the drill-down, which the phase-cut mechanism (§9) already anticipated for exactly this. Built that instead, `Status` untouched.
  - **New column `Follow-up Sent?`** at **BY** (grid 76→77 columns), sticky checkbox (BOOLEAN validation, seeded `FALSE` on rows 3–424, same 10-row buffer as `Follow-up Due?`), same "set once, never cleared" mechanic as the existing `Sent?`/`Bounced?`/`Replied?`/`Meeting Booked?` stickies (§9). Purely manual — Tej ticks it when he issues a follow-up; nothing in this environment can detect that automatically (no inbox access). Answers "have I ever caught this one up," a cumulative reached-milestone question, not "which attempt number" — sidesteps the exact ambiguity §8 originally flagged.
  - **`scripts/build-overview-stats.ts` edited** (untracked/not committed, per this repo's convention for `scripts/`): added `followupDue`/`followupSent` to the `Refs` type and to the live-header column lookup; added a `countFollowupDue` helper (`COUNTIFS(Status,"Sent",Follow-up Due?,TRUE)` (+tier)); block ④ (Phase cuts) gained two rows, `Follow-up due` and `Follow-up issued` (`COUNTIF(Follow-up Sent?,TRUE)`), same "overlapping cut, does not sum" treatment as the rest of the block; block ⑥'s drill-down dropdown gained `"Follow-up due"` / `"Follow-up issued"` as two synthetic options alongside the real 16 `Status` values — the Count and org-list FILTER formulas special-case these two labels (route to `Follow-up Due?`/`Follow-up Sent?` logic) rather than doing a literal `Status=` match, since rows under them still read `Status = Sent`.
  - **Pre-existing bug found and fixed in the same file, unrelated to this task:** `main()` still referenced a column named `"Outreach Tier"`, which doesn't exist live anymore — the live header is just `"Tier"` (col BI), confirmed by a fresh header read (live-column-reshuffling pattern). This meant `build-overview-stats.ts` would have thrown on any re-run since whenever that rename happened, before my edits and unrelated to them. Fixed the reference; would have blocked this build entirely otherwise.
  - **Verified before considering this done:** `npx tsc --noEmit` clean. Ran the generator for real (`npx tsx scripts/build-overview-stats.ts`, not a dry run — this script always fully rewrites the tab, which is its documented, idempotent design) — 91 rows written, both new phase-cut rows present and reading `0` (correct, matches the 8 `Sent` rows all having blank `Last Touch Date` / unticked `Follow-up Sent?`). Then a live functional test: set the drill-down dropdown to `"Follow-up due"` and `"Follow-up issued"` in turn and confirmed both correctly returned count `0` / `"— none —"`, while a control value (`"Sent"`) still correctly returned `8` and listed the right 8 orgs — proves the branching logic didn't break normal `Status` filtering. **Then a positive-path test**, since an all-zeros check alone doesn't prove the formula matches on a real hit: temporarily wrote `Last Touch Date = 2026-07-16` and `Follow-up Sent? = TRUE` onto City of Vancouver (row 84, one of the 8 `Sent` rows), confirmed `Follow-up Due?` (BX84) flipped to `TRUE`, confirmed the drill-down picked it up under both `"Follow-up due"` (count 1, listed "City of Vancouver") and `"Follow-up issued"` (count 1, same), confirmed the block ④ phase row read `1`, then reverted `Last Touch Date` back to blank, `Follow-up Sent?` back to `FALSE`, and the drill-down dropdown back to its original value (`"Enriched"`) — read back after revert to confirm no residue. Net effect on real data: zero: this was a write-then-revert verification, called out here per the "log every write" rule even though it left no net change.
  - **Documented in `docs/org-goals-enrichment-model.md`** (new subsection after "The sticky-milestone mechanic" in §9) so the reasoning — why this didn't go in `Status`, what `Follow-up Sent?` actually answers, the manual-only limitation — stays discoverable next to the model it extends, not just in this log.
  - **Method:** two throwaway `.ts` scripts (`add_followup_sent.ts` dry-run-then-`--write` for the new column, `check_headers.ts` for the live header audit that caught the `Outreach Tier` bug), plus two more for the functional/positive-path tests (`test_drilldown.ts`, `test_positive.ts`) — all four deleted after use.

- **2026-07-28 (same day) — Added the Last Touch Date / Follow-up Sent? habit to `assets/artifact-src/week-plan.html` as a Standing Trigger, not a task.** First pass put it as a "going forward" prose note inside a Wednesday close-out micro-row; Tej corrected that it should be a proper Standing Trigger, matching the page's existing When/Then pattern. Moved it: new trigger *"When Status flips to Sent, or a follow-up actually goes out → I update Last Touch Date on that row — and tick Follow-up Sent? if it's a follow-up. Nothing else populates either field."*, and trimmed the Wednesday micro-row back down to just the one-time backfill task (the 8 already-sent orgs), since the ongoing habit now lives in the trigger instead of being duplicated in both places. Wednesday's day panel also carries a new one-time task, "Follow-up sheet housekeeping" (3:00–3:05), for that backfill.
  - **Deployed to the live site**, `twelveoclock.co/vsw-week-plan`, for the first time from a Claude Code session — no prior EXECUTION-LOG entry documented how, so the method is recorded here for next time. It's a separate Railway project/service, not part of the `vsw-future-planning` Slack-bot deploy: project **`vsw-week-plan`** (id `8a597c5a-f187-4c5f-9a1d-43883ac7ce5f`), single service also named **`vsw-week-plan`** (id `3299c9a3-72ea-4330-9d6d-4ce9586fe818`). The directory was already linked to the project (found via `~/.railway/config.json`'s per-path project mapping) but had no service selected (`service: null`) — the service name was found by querying Railway's GraphQL API (`backboard.railway.app/graphql/v2`) directly with the CLI's own cached `accessToken` from that same config file, since the CLI itself has no non-interactive "list services" command. Linked it (`railway service link vsw-week-plan`), then deployed with `railway up --ci -m "<message>"` from inside `web-week-plan/` — builds and pushes a container image directly from the local directory (Docker-based, not a GitHub-integration auto-deploy; matches `web-week-plan/` being untracked/gitignored in the main repo, so there's no git-push path that would trigger this). Verified live via a direct `curl` of `twelveoclock.co/vsw-week-plan` confirming both the new trigger text and the trimmed Wednesday task text were present post-deploy, not just a successful build log.
  - Also republished this same build to the Claude artifact (`claude.ai/code/artifact/4b3c2906-...`) so source, `web-week-plan/index.html`, the live Railway site, and the Claude artifact all match — the three-copies-in-sync rule from CLAUDE.md's design-system section.

- **2026-07-28 (same day) — Corrected the "enrichment broke/ran overnight" framing across the week plan, at Tej's direction, and restructured Wednesday.** Both claims were wrong: nothing broke, and the run wasn't overnight. What actually happened, per Tej: previous tiers' enrichment output showed things worth improving, so he's improving the process before running Tier 3 through it again — a normal iteration, not an incident. Swept every "broke"/"broken"/"overnight" mention out of `assets/artifact-src/week-plan.html`: the Tier 3 scoreboard row, Tuesday's "Enrichment spot-check" micro-row and its carry note, and Wednesday's day-goal, day-cap, block name ("Fix, test, and relaunch enrichment" → "Iterate and relaunch enrichment"), and its "Diagnose and fix" micro-row (rewritten as "Improve the process" — reviewing what Tier 1/2 enrichment struggled with, not hunting a failure point).
  - **Also corrected a structural conflation Tej flagged: enrichment and drafting are sequential, separate processes, not interchangeable** — enrichment has to complete before drafting resumes, and drafting was not actually today's afternoon activity. Tej gave the real AM/PM shape: morning is iterating the enrichment process; afternoon is fixing edits (Andrew's same-day note to replace em dashes with colons across the approved Tier 1/2 LinkedIn drafts, still unapplied) and sending out what's already approved (the 11 Tier 1 messages sitting at `Approved — waiting to send`). Restructured Wednesday's afternoon accordingly: merged the old "Review and requests" reactive block (11:15–12:00, generic buffer) and the old "First drafts, if enrichment landed in time" contingent-drafting block (12:00–2:15) into one production block, **"Fix edits, send approved work"** (11:15–2:15) — apply Andrew's edit, checkpoint, then send the approved backlog. No drafting block remains on Wednesday at all. Close-out's checkpoint and wrap-up copy updated to match (enrichment progress + backlog sent, not "the fix").
  - **Rebuilt and redeployed all three copies** — `npx tsx scripts/build-artifact.ts`, republished the Claude artifact (fetched the live version first per the tool's conflict guard, confirmed no un-merged changes before overwriting), then `railway up --ci` from `web-week-plan/` using the same linked service as the prior deploy. Verified live: `curl`'d `twelveoclock.co/vsw-week-plan` for the new Wednesday day-goal text and confirmed zero remaining case-insensitive hits for "broke", "broken", or "overnight" site-wide.
  - **Also drafted (not sent — Tej sends these himself tomorrow at 8am) two Slack messages to Andrew**, per Tej's request: a "good morning" recap of yesterday's work (framed in past tense since it's being sent the next morning) and a separate short start-of-day ping linking the week-plan page, in the style of Tej's own real historical Slack messages in `#vsw-future-planning`. Read the channel's actual message history first (`slack_read_channel`) to identify what Tej had already told Andrew today, so the recap doesn't repeat his 11:33am "20 of 50 Tier 3 orgs at Route identified" update — the recap instead reports the real delta (50 of 50, final) plus what that update didn't cover: the follow-up-due tracking work and the enrichment reframing above. Both messages were written against a fresh fetch of the **Stop Slop Guide** and **Tej Nathoo Voice System (Agent Reference)** Notion pages (never hardcoded, per [[feedback_stop_slop_guide]] / [[feedback_voice_system_guide]]) — no em dashes, no thesis-antithesis constructions, no LLM-tell phrases from either guide's banned list.

### 2026-07-29 (enrichment-process audit — the run report was blind, the gate was advisory, and VSW had no value asset)

Wednesday's week-plan block was "improve the enrichment process." Tej asked for a full audit of how
enrichment operates, what it writes back, and whether it is effective. The audit found three
structural problems and one dead check. All fixed this session except where noted.

**1. The run report had been reporting "every row clean" on zero rows.** `scripts/run-report.ts`
scoped rows on a column named `Outreach Tier`; that column was renamed to `Tier` on the live sheet
(noted in passing in the 2026-07-23 Adobe entry, never chased down). A missing header resolves to
`""` through `tracker.get()`, the `tier !== ""` filter matched nothing, and the report printed
`=== ENRICHMENT RUN REPORT — all tiered rows (0 rows) === No flags. Every row clean.` **76 real
flags were live on the sheet at the time**, including 4 name↔LinkedIn mismatches and 8 past-VSW
sponsors queued for cold copy. Fixed: the tier column is now resolved against a list of known
header names, and the script **throws rather than reporting clean** if it cannot find a tier column
or if the scope comes back empty. A report that examines nothing must never look like a pass.

**2. The grammar/sourcing gate was advisory, so a row could violate three hard rules and still be
written.** The checks lived only inside the after-the-fact report. **WorkSafe BC** (written
2026-07-27 in the Tier 3 background batch) carries an initiative with two `" and "`s — a guaranteed
run-on — plus no `Personalization Source` and no `VSW Alignment`. Extracted every check into
**`scripts/enrichment-gate.ts`**, which exports `checkRow(RowView)` and `assertClean(flags)`.
`RowView` is a plain object rather than a sheet row **specifically so a write script can gate the
values it is about to write, before the API call**. Each check now carries a severity: `block`
(documented hard rule, `assertClean` throws) or `warn` (heuristics with real false-positive rates,
plus facts that change strategy rather than copy). Overrides need an explicit
`{ allow: ["CHECK NAME"] }` and a line here. Verified against the real WorkSafe BC values: the gate
refuses the write with all 3 blocking flags. `run-report.ts` now consumes the same module, so the
fence and the safety net can never disagree.

**New checks added while extracting:** `LI HOOK REPEATS ORG` (the ATCO "ATCO's work on ATCO
EdgeWorks" stutter, already documented in the re-enrichment playbook but never mechanized) —
**found 8 live cases, including Google Cloud and Kensington Capital Partners, both sitting at
`Approved` i.e. cleared to send**; `LI HOOK TRAILING PERIOD`; and the `Why Us` checks below.
Current state: 4 blocking flags across 128 tiered rows (WorkSafe BC ×3, LinkedIn ×1), 151 warnings.

**3. The project had no asset describing what VSW is worth to a sponsor.** Every research agent
knew a great deal about each prospect and almost nothing about us: the entire encoded understanding
of VSW was a three-sentence paragraph pasted inline in the re-enrichment prompt template. That
asymmetry is why the copy can say "we've been following your work on X" and cannot say what they
would get. Tej pointed at `~/Desktop/Tej Nathoo/vsw-playground`, which turned out to hold exactly
the missing material. Copied into **`docs/vsw/`** (duplicated at Tej's instruction, not moved):
`brand-messaging-framework.md`, `editing-rules.md`, `known-stats-vsw-2026.md`,
`vsw-differentiators.md`, `objection-handling.md`, `community-proof-linkedin-posts.md`,
`media-coverage-canada-now-2026-05.md`.

Wrote **`docs/vsw/vsw-sponsor-value.md`** on top of them, with real audience composition computed
from `vsw-playground/impact-report/data/2026/VSW2026 Attendees.csv` (1,043 profiles; 925 with a
title; 997 with an organization): **696 unique organizations**, **45.1% of titled attendees are
founders/CEOs/owner-partners**, 57% including VPs, directors and other C-suite, 640 repeat
attendees across 2021–2026. Method note recorded in the doc — regex bucketing over free-text
titles, ±2–3 points, and the profile export is a self-selected subset of registrants.

**⚠️ 4. The attendee figure in live sent copy is not supported by our own data, and this is
unresolved.** `known-stats-vsw-2026.md` flagged it on 2026-07-08 and nothing happened. Email B's
sent text reads *"in 2026 hosted 86 events that attracted more than 5,000 people."* The 2026
attendee file holds **1,043**; the largest single year ever recorded is **1,788** (2023); the
deduped 2021–2026 total is **5,019**. A single-year 5,000 would be ~3× the biggest year on record
and sits within thirty of the six-year deduped total, so the likeliest explanation is a cumulative
figure restated as an annual one. **Already sent to the four Email B recipients: City of Vancouver,
National Bank of Canada, Sequoia Capital, Valhalla Private Capital.** Tej's call this session is
that 5,000 stays as the working number; the doc records the defensible framing ("more than 5,000
people over the past five years") and the proposed one-clause fix. **Open, owned by Tej → Mark:**
confirm whether a real 2026 registrant total exists outside Whova. Email A is unaffected
("thousands of people to dozens of events" is defensible). 85+ events and 250+ speakers check out
across every source.

**5. New column `Why Us (→[why])` — the reciprocity field.** The audit's core finding on copy: the
email makes no specific claim of value to the recipient anywhere, and ~90% of it is identical
across every prospect. The fit memos have always ranked ROI candidates by evidence quality, and
that ranking — the most valuable output of the whole research process — landed in `VSW Alignment`,
a column defined as never-quoted. Added `Why Us (→[why])` to `master-prospects` at **BO**, inserted
after `LI Short Hook` via `insertDimension` (dry-run first, header written, **read back by exact
single-cell read `BO2`** per the 2026-07-28 trailing-blank lesson). Verified `Ready?`, `Named
Contact?`, `Drafted?` and `Follow-up Due?` formulas auto-adjusted and still compute (BP/BQ/BR/BY,
spot-checked rows 3 and 50 with `valueRenderOption: FORMULA`). No data written to the column yet —
schema only. `NO WHY-US` fires as a warning only on rows at `Enriched` or later, so rows still in
progress are not nagged for a field they legitimately do not have yet.

**6. Stop Slop was never applied to prospect-facing copy.** Confirmed by grep: zero references in
`outreach-copy-playbook.md` or any enrichment doc, while EXECUTION-LOG shows it being applied to
Slack messages to Andrew. The only gate on prospect text was a regex for run-ons and dollar signs.
Added a **tone gate** section to the playbook: fetch the Stop Slop Guide
(`5d33c81d-b930-419e-8557-41fbb4ec7629`) and the Voice System live from Notion every time, never
cached, per [[feedback_stop_slop_guide]] / [[feedback_voice_system_guide]]. Scope is deliberately
limited to **our** text (the two clauses, `Why Us`, LinkedIn notes, any new external copy) and
explicitly **excludes Andrew's template body**, which is his wording used verbatim. Recorded one
caution: the guide is written for prose/essays, and applied mechanically it would make a polite
business email read as brusque. Noted that Andrew's own 2026-07-29 instruction (replace em dashes
with colons) independently matches a Stop Slop rule.

**7. Stale docs reconciled.** (a) The `Outreach Route` enum in both `outreach-copy-playbook.md` and
`org-goals-enrichment-model.md` still listed `Email — personal` / `LinkedIn` / `Blocked — no route`
— an enum that **was never applied to the live column** and that generated a batch of false
"invalid route value" findings across the Tier 2 memos on 2026-07-22. Both now carry the real live
values with an explicit warning that the live data validation is the authority and any written copy
can go stale again. (b) The enrichment model's Tier 3–4 depth row said "batch scrape, AI-drafted
clauses, spot-review ~20%" — the plan Tuesday's spot-check rejected. Split Tier 3 (full standard)
from Tier 4, and added a dated correction explaining why: sampling-based QA only works when the
unsampled remainder is produced by a process that cannot emit an invalid row, which is what item 2
above now guarantees. (c) `Enriched` redefined to require `Why Us` and **zero blocking flags**
rather than "no unresolved flags." (d) CLAUDE.md's read-order and file map now point at `docs/vsw/`.

**8. `docs/why-us-sentence-before-after.md` — the proposal for Andrew.** Five organizations already
contacted (EY, National Bank of Canada, Version One Ventures, CVCA, Trade and Invest BC), each
showing the **real sent paragraph** pulled from the live drafts doc via the Docs API — extracting
table cell content, since Tier 1 bodies live inside the 5-row To/Cc/Bcc/Subject/body table, not as
plain paragraphs — against the proposed version. The proposal is framed as a **swap, not an
addition**: it replaces *"From what we're seeing on the ground, those priorities line up strongly
with the community that participates in our events each year"*, which is byte-for-byte identical
across all 20 Tier 1 drafts and asserts audience alignment while offering nothing to support it.
Email length, structure, and CTA unchanged. Also caught in the extraction: Trade and Invest BC's
**sent** draft still carries the two-noun initiative (*"your investor services and the international
trade missions you lead"*) that forced an awkward "as well as" repair — the tracker was corrected
afterwards, the draft never was.

**Not done, deliberately:** no `Why Us` values written to any row (schema only — the content pass
comes after Andrew rules on the template change, otherwise we author 128 sentences against a
sentence structure he may not take); no drafts doc edits; no Email B attendee-figure correction
applied to the live doc (flagged for Tej/Andrew, since it changes copy already sent); item 6 of the
audit (the reply/A-B feedback loop) parked at Tej's direction — already on his week plan.

### 2026-07-29 (correction to the attendee-figure finding above)

**Item 4 above was wrong.** Tej clarified: registrants and attendees are two different figures,
each week has drawn 5,000+ in attendance, and VSW deliberately quotes that larger, correct number.
The 1,043 figure in `vsw-playground/impact-report/data/2026/`'s Whova file is a **profile export**
— people who went on to build an in-app profile, a self-selected subset of real attendance — not a
registrant or door count, so it was never the right denominator to compare 5,000 against. This was
not a cumulative-figure-restated-as-annual error; it's two different measurements, and 5,000+ is
the one that's correct. **No correction needed to the sent Email B copy.**

Updated `docs/vsw/vsw-sponsor-value.md` §0 and `docs/why-us-sentence-before-after.md` to remove the
"unresolved discrepancy" framing and the proposed copy fix, both built on the wrong premise. Left a
short note in the before/after doc rather than deleting the section outright, so the concern (and
its resolution) stays visible if it resurfaces. `known-stats-vsw-2026.md`'s 2026-07-08 flag in
`vsw-playground` is now also resolved by this same explanation, though that file lives in the other
repo and wasn't edited.

### 2026-07-29 (Pass A made a standing batch operation — selector script + agent playbook)

Tej's operating pattern going forward: once orgs are tiered and routed, say "enrich the next
batch of Tier N" and have it run 5 agents in parallel, one per org, through the full pipeline up
to (not including) drafting. Built the two pieces that make that a real trigger rather than
something assembled ad hoc each time:

- **`scripts/next-enrichment-batch.ts`** (read-only) — given a tier, filters to `Route identified`
  or later, not `Archived`, `Their Initiative` still blank, and prints the next N (default 5) as
  ready-to-paste org snapshots, same shape as `build-reenrichment-brief.ts`'s Pass B version but
  with FALSE-valued checkboxes filtered out (Pass A doesn't need Pass B's event-partner audit
  noise). Verified against Tier 3: 42 of 50 rows currently eligible.
- **`docs/enrichment-pass-a-playbook.md`** — the batch loop (select → spawn 5 parallel agents →
  wait → `run-report.ts --blocking` across the whole tier, not just the 5 just-written rows →
  `advance-status.ts --write` → report to Tej → repeat) plus a self-contained per-org agent
  prompt template. The template bakes in every fix from today's audit as a required step, not an
  optional one: read `vsw-sponsor-value.md` and produce `Why Us` against it, run the composed
  sentence and `Why Us` through the Stop Slop Guide (fetched live, page id given), build a
  `RowView` and call `assertClean(checkRow(...))` before the write (not after), and stop at the
  drafting boundary — no Docs API, no hand-set `Status`.

This is Pass A's equivalent of what `tier2-reenrichment-playbook.md` already gave Pass B: a
literal, fill-in-`{{ORG_NAME}}` prompt rather than a method description that has to be
re-assembled correctly by whoever runs the next batch. Cross-linked from
`org-goals-enrichment-model.md`'s Tier 3 correction and from CLAUDE.md's file map. Not yet run
against a live batch this session — infrastructure only.

### 2026-07-30 — Pass A enrichment: CFIN (row 76)

Fresh Pass A run, overwriting any prior values per Tej's "redo previously-run rows from scratch"
instruction. Entity confirmed as **Canadian Food Innovation Network** (`cfin-rcia.ca`, matching
the row's `info@cfin-rcia.ca`), not "Canada's Financial Innovation Network" — the staging label
was wrong and `Notes` already recorded the correction.

Deep-scraped their own domain (Firecrawl `/v2/scrape`, JSON-extract + markdown) on
`cfin-rcia.ca/home`, `/yodl/about-yodl`, `/about/our-story`. Written to `master-prospects` row 76:

| Field | Value |
|---|---|
| `Their Initiative` | `your YODL platform` |
| `Their Goal` | `breaking down innovation roadblocks for food businesses` (their own phrase, YODL page) |
| `VSW Alignment` | member-recruitment/BC-founder-access framing + ecosystem-builder tone directive |
| `Why Us` | free membership → growth needs in-person reach; §5 row 1 (customers among founders/SMBs), grounded in the 45%-principals and 696-organizations figures |
| `Personalization Source` | `https://www.cfin-rcia.ca/yodl/about-yodl \| https://www.cfin-rcia.ca/about/our-story` |

`LI Short Hook` not written — route is `Email (Generic Inbox)`.
`assertClean(checkRow(...))` run immediately before the write: **zero flags, blocking or warning.**
Every cell read back by exact address (BJ76, BK76, BL76, BM76, BO76) — all OK. Stop Slop pass run
against the live Notion guide over both the composed sentence and `Why Us`; both scored above 35/50
(no em dashes, no binary contrasts, no vague declaratives). Temp script deleted.

### 2026-07-30 — Pass A enrichment: Databricks (row 102)

Re-run from scratch per Tej's instruction to redo previously-enriched rows. Deep-scraped their own
domain (Firecrawl `/v2/scrape`, JSON-extract + markdown) on `databricks.com/product/startups` and
`/company/about-us`. Written to `master-prospects` row 102:

| Field | Value |
|---|---|
| `Their Initiative` (BJ102) | `the Databricks AI Accelerator Program` |
| `Their Goal` (BK102) | `speeding up the growth of high-potential AI startups` (their own phrasing on the startups page) |
| `VSW Alignment` (BM102) | reaching founders before the data stack is locked in + peer-conversation tone directive |
| `Why Us` (BO102) | §5 row 1 (customers among founders/SMBs), grounded in the 45%-principals and 696-organizations figures |
| `LI Short Hook` (BN102) | `your invitation-only AI Accelerator Program` (43 chars, route is `LinkedIn DM`) |
| `Personalization Source` (BL102) | `https://www.databricks.com/product/startups` |

`assertClean(checkRow(...))` run immediately before the write: **zero flags, blocking or warning.**
Every cell read back by exact address — all OK. Stop Slop pass run against the live Notion guide
over the composed sentence and `Why Us`; both above 35/50. `$200K` credits figure deliberately kept
out of the clauses (dollar-figure rule). Temp scripts deleted.

### 2026-07-30 — Pass A enrichment: Inovia Capital (row 174)

Fresh authoring (row's prior enrichment values overwritten per instruction). Deep-scraped their own
domain (Firecrawl `/v2/scrape`, JSON-extract on the homepage to locate, then markdown on
`inovia.vc/discovery-program/` and `inovia.vc/build-from-canada/`). Written to `master-prospects`
row 174:

| Field | Value |
|---|---|
| `Their Initiative` (BJ174) | `your Discovery Program` |
| `Their Goal` (BK174) | `backing the next generation of Canadian venture firms at pre-seed and seed` (their own framing on the Discovery page) |
| `VSW Alignment` (BM174) | Discovery funds the pre-seed layer directly and through 23 emerging managers; contact runs marketing/comms so the entry point is ecosystem presence, not an investment conversation. Peer-institution tone. |
| `Why Us` (BO174) | §5 row 3 (deal flow — proximity to BC early-stage), grounded in differentiator 4 (built for pre-idea/pre-seed) and the 696-organizations figure |
| `Personalization Source` (BL174) | `https://www.inovia.vc/discovery-program/ \| https://www.inovia.vc/build-from-canada/` |

`LI Short Hook` not written — route is `Email (Personal)`. `assertClean(checkRow(...))` run
immediately before the write: **zero flags, blocking or warning.** Every cell read back by exact
address (BJ174, BK174, BL174, BM174, BO174) — all OK; `Ready?` (BP174) flipped TRUE on its own.
Stop Slop pass run against the live Notion guide over the composed sentence and `Why Us`; both
above 35/50 (no em dashes, no binary contrasts, no vague declaratives; "deliberately"/"exactly"
adverb crutches cut in revision). No dollar figures in any clause. Temp script deleted.

### 2026-07-30 — Pass A enrichment: Grammarly (Tier 3 batch)

Fresh authoring; the row's prior enrichment values were overwritten per Tej's instruction to redo
previously-run rows from scratch. Deep-scraped their own domain (Firecrawl `/v2/scrape`,
JSON-extract across `grammarly.com/`, `/about`, `/business`, `/blog/company/`, then markdown on
`/about` and `/business`). **Material finding:** the company rebranded as **Superhuman** in
October 2025 after acquiring Coda and Superhuman Mail; `grammarly.com/business` now states
Grammarly is delivered through **Superhuman Go**. The prior enrichment (`Grammarly Business` /
"helping teams and companies of all sizes achieve results with AI") was sourced from a stale
single-page check and no longer matches what their own site says. Written to `master-prospects`
row 149:

| Field | Value |
|---|---|
| `Their Initiative` (BJ149) | `Superhuman Go` |
| `Their Goal` (BK149) | `uniting Grammarly, Coda and Superhuman Mail under one AI-native productivity platform` |
| `VSW Alignment` (BM149) | Past sponsor 2019 + 2021 → returning-partner conversation, never cold. Superhuman Go sells at team level; VSW's founders/ops leads are the tooling buyers. Tone: warm, business-development first, acknowledge the rebrand. |
| `Why Us` (BO149) | §5 row 1 (customers among founders/SMBs), grounded in the 696-organizations and 45%-principals figures |
| `Personalization Source` (BL149) | `https://www.grammarly.com/about \| https://www.grammarly.com/business` |

`LI Short Hook` not written — route is `Email (Generic Inbox)`. `assertClean(checkRow(...))` run
immediately before the write: zero blocking flags, **one warning — `PAST VSW SPONSOR`** (VSW=TRUE,
2019 and 2021), which is expected and is already handled in `VSW Alignment`'s re-engagement
directive. Every cell read back by exact address (BJ149, BK149, BL149, BM149, BO149) — all
matched. Stop Slop pass run against the live Notion guide over the composed sentence and `Why Us`;
both above 35/50 (no em dashes, no binary contrasts, no vague declaratives). No dollar figures —
the site's "17x ROI" claim stayed out, same as the prior pass. Temp scripts deleted.

### 2026-07-30 — Tier 3 Pass A enrichment: IBM (row 163)

Deep-scraped `ibm.com` (Firecrawl `/v2/scrape`, JSON-extract) across `/ca-en`, `/ventures`,
`/ca-en/about`, `/quantum/network`. The corporate-wide pages returned only boilerplate; the
specific, non-substitutable material is on **IBM Ventures** — their own copy names the
**capital-plus model** and states they back *"early-stage companies solving the toughest enterprise
challenges through AI and quantum computing."* Prior values overwritten from a fresh scrape.

| Field | Value |
|---|---|
| `Their Initiative` (BJ163) | `IBM Ventures' capital-plus model` |
| `Their Goal` (BK163) | `backing early-stage founders building the next generation of enterprise technology` |
| `Personalization Source` (BL163) | `https://www.ibm.com/ventures` |
| `VSW Alignment` (BM163) | IBM Ventures takes open inbound submissions → VSW is a sourcing channel; Colette Cheung sits in IBM Consulting Canada, so first conversation is about who inside IBM owns founder engagement. Tone: practical, peer-level, no ecosystem cheerleading. |
| `Why Us` (BO163) | §5 row 3 (deal flow / corp dev), grounded in the 696-organizations and 45%-principals figures plus differentiator 4 (pre-seed by design) |

`LI Short Hook` not written — route is `Email (Personal)`. `assertClean(checkRow(...))` run
immediately before the write: **zero flags, blocking or warning** (VSW=FALSE, so no past-sponsor
flag; name↔email consistent). Every cell read back by exact address (BJ163, BK163, BL163, BM163,
BO163) — all matched. Stop Slop pass run against the live Notion guide over the composed sentence
and `Why Us`; both above 35/50. The `$500M Enterprise AI Venture Fund` name was deliberately kept
out of the clause (dollar-figure rule). Temp scripts deleted; `tier3_snapshots_tmp.md` retained.

### 2026-07-30 — Lighthouse Labs replaced with DMZ (row 111) in the Tier 3 batch; DMZ enriched

**Why:** Lighthouse Labs (row 200, one of the 44 orgs Tej hand-selected into Tier 3 on 2026-07-27)
went bankrupt — the 2026-07-30 Pass A enrichment attempt on that row found `lighthouselabs.ca`
now resolves to a GlassRatner Restructuring Inc. notice (Uvaro Inc. and Lighthouse Labs Inc. filed
assignments into bankruptcy 2025-08-01, trustee update 2025-08-21). Tej asked for a replacement:
another org with `Warm Lead Person` blank, no tier assigned yet, and genuinely cold (not just
blank in that one column).

**Selection.** Read `A3:BI1000` live (515 rows). Filtered to `Warm Lead Person` blank + `Tier`
blank — 237 rows. A first pass surfaced Techstars, Wizard Labs, and Granted (all blank in `Warm
Lead Person`), but all three carry `Warm Lead? = TRUE` and a `Warm Lead Path` of `Past VSW
sponsor: <year>` — warm, just mislabeled by that one column, the exact trap the
`returning_vsw_partners_mislabeled_cold` pattern warns about. Excluded those and re-filtered on
`VSW` (col J) = FALSE, `Past VSW Event Partner` = FALSE, `Warm Lead? ` = FALSE, and blank `Warm
Lead Path` — 224 rows, narrowed to Accelerator/Tech-flavored orgs with a real (non-placeholder)
`Why Them`. **DMZ** (row 111, category `Accelerator`, status `Sourced`) was the strongest match:
genuinely cold on every signal, untiered, and its existing `Why Them` already cites three own-site
comparable-event links (Web Summit Vancouver, Elevate Festival, Toronto Tech Week partner pages) —
better-evidenced than Lighthouse Labs' original one-link pitch, with no solvency risk.

**Tier write.** Re-verified `B111 = "DMZ"` immediately before writing (row-drift guard), dry-run
first, then wrote `Tier 3` to `BI111`. Read back by exact cell address: confirmed.

**Enrichment (Pass A standard, run directly rather than via the 5-agent batch loop since this was
a single explicit ask).** Resolved domain via Firecrawl `/v2/search` (`dmz.torontomu.ca` — DMZ is
now under Toronto Metropolitan University, not the old Ryerson branding). Deep-scraped
`dmz.torontomu.ca/`, `/about`, `/incubator` (JSON-extract, own-domain only, per the playbook).

| Field | Value |
|---|---|
| `Their Initiative` (BJ111) | `DMZ Ventures` — their own for-profit investment arm, TMU's first fund, named on `/about` |
| `Their Goal` (BK111) | `building lean, adaptable companies designed to last` — their own homepage language |
| `Personalization Source` (BL111) | `https://dmz.torontomu.ca/about \| https://dmz.torontomu.ca/` |
| `VSW Alignment` (BM111) | DMZ already partners with Web Summit Vancouver, Elevate Festival, and Toronto Tech Week — a heavyweight incubator (2,600+ startups, $3.1B+ alumni raised) that already sponsors peer-ecosystem events beyond Toronto. Tone: peer-to-peer ecosystem-builder conversation, cross-promotion framing, not a cold sponsorship ask. |
| `Why Us` (BO111) | §5 row "Deal flow (investors/corp dev)", grounded in the 45%-principals figure — DMZ Ventures is TMU's first fund actively sourcing startups to back, and VSW's room is 45% founders/principals |

Rejected an early draft of `Their Goal` — "built to thrive, not just survive" (DMZ's own "Home of
the Camel" phrase from `/about`) — because it's a binary-contrast construction the Stop Slop Guide
flags; replaced with the homepage's positively-stated equivalent. Stop Slop Guide fetched live
from Notion (`5d33c81d-b930-419e-8557-41fbb4ec7629`), scored both composed sentences, no rewrites
needed beyond that one swap. `assertClean(checkRow(...))` run before the write: **zero flags**,
blocking or warning. `LI Short Hook` not written — `Outreach Route` still blank; Tej is finding
the contact and route himself. Every cell read back by exact address (BJ111, BK111, BL111, BM111,
BO111) — all matched. Temp scripts (`write_tier_tmp.ts`, `dmz_search_tmp.ts`,
`dmz_scrape_tmp*.ts`, `dmz_gate_check_tmp.ts`, `dmz_write_enrich_tmp.ts`) deleted after.

**Correction, same day — `Their Initiative`/`Why Us` wrongly used DMZ Ventures.** Tej flagged
that DMZ Ventures is a separate entity being reached out to on its own — it can't also be the
initiative on DMZ's own row, or the two outreach threads collide. Re-scraped
`dmz.torontomu.ca/incubator` and `/pre-incubator` (own domain, JSON-extract) for material that's
about the incubator itself, not the investment arm.

| Field | Old (wrong) | Corrected |
|---|---|---|
| `Their Initiative` (BJ111) | `DMZ Ventures` | `DMZ Incubator` |
| `Their Goal` (BK111) | `building lean, adaptable companies designed to last` | `meeting founders where they are so they can scale faster on their own terms` |
| `Personalization Source` (BL111) | `.../about \| .../` | `.../incubator \| .../` |
| `Why Us` (BO111) | DMZ Ventures' fund / deal-flow framing | DMZ's Incubator recruiting tech-driven, revenue-generating, venture-backable founders into its cohorts — same §5 "deal flow" audience row and the 45%-principals figure, reframed around the incubator's own applicant pipeline instead of the fund |

`VSW Alignment` (BM111) left untouched — it never referenced DMZ Ventures. Source page's own
distinctive line ("Unlike traditional accelerators, DMZ's Incubator is designed to meet you where
you are…") is a binary-contrast construction the Stop Slop Guide bans; the corrected `Their Goal`
keeps the substance but drops the "Unlike traditional accelerators" contrast, same fix applied to
the original draft's "thrive, not just survive" line. `assertClean(checkRow(...))` re-run on the
corrected values: zero flags. Every cell read back by exact address, old values printed first to
confirm what was being overwritten. Temp scripts deleted after.

### 2026-07-30
- **Pass A enrichment — Salesforce (row 289, Tier 3).** Tej supplied `salesforce_fy25_stakeholder_impact_report.pdf`'s
  own URL directly (`https://www.salesforce.com/en-us/wp-content/uploads/sites/4/documents/white-papers/salesforce-fy25-stakeholder-impact-report.pdf`)
  after a downloaded semantic-summary version of the same report surfaced it as a much stronger
  source than the row's existing `Why Them` note (a 2018 Salesforce Ventures Canada Trailblazer
  Fund press release — stale, and not the actual clause source per the playbook's own rule that
  `Why Them` is unverified qualification, never migrated). Verified the summary against the real
  PDF live via Firecrawl (`/v2/scrape`) before using anything from it — WebFetch was blocked by
  Salesforce's own bot protection (403), Firecrawl was not.
  - **Two initiative candidates weighed openly with Tej before writing:** `Agentforce` (the
    report's own headline, Salesforce's #1 listed corporate priority) vs. `Trailhead`/`AI for All`
    (Salesforce's 10-year skilling platform + its named $50M+ AI-skills-gap program). Agentforce
    is more prominent but the honest sponsor-fit story is weaker — it's enterprise AI software,
    and VSW's differentiator #4 is explicit pre-idea/pre-seed accessibility, not a natural
    Agentforce buyer. Trailhead/AI for All won on evidence quality: it plugs directly into VSW's
    own named talent-matchmaking programming (§5) with a real Salesforce number (40,000+ people
    placed via Salesforce Talent Alliance since FY21) on the other side. **Tej chose
    Trailhead/AI for All.**
  - **Written:** `Their Initiative`=`AI for All` (BJ289), `Their Goal`=`closing the AI skills gap`
    (BK289), `Personalization Source`=the FY25 report PDF URL above (BL289), `VSW Alignment` (BM289,
    notes the existing BC Naturally AI brochure early-commitment-partner checkbox plus the
    AI-for-All/Trailhead pairing, tone: peer-to-peer, not cold), `LI Short Hook`=`your AI for All
    program` (BN289, route is `LinkedIn DM`), `Why Us` (BO289, matches §5's "Talent / employer
    brand" row, grounded in the 45%-principals figure).
  - Stop Slop Guide fetched live from Notion (`5d33c81d-b930-419e-8557-41fbb4ec7629`) and scored
    against the composed sentence and `Why Us`; cut an "actually," a three-item list
    (`founders, CEOs, and owners` → `founders and company principals`, matching the doc's own
    Accenture-example phrasing), and an em dash from first drafts before writing.
    `assertClean(checkRow(...))` run before the write: **zero flags**, blocking or warning.
    Every cell read back by exact address (BJ289/BK289/BL289/BM289/BN289/BO289) — all matched.
    Temp script (`write_salesforce_tmp.ts`) deleted after.
  - **Deliberately left untouched:** the existing `Why Them` note's Vancouver-office claim — the
    FY25 report never mentions Vancouver, BC, or Canada by name (checked directly), so no new
    locality claim was added anywhere in the written fields. `Status` left at `Route identified`;
    `Ready?` will flip on its own once `advance-status.ts` next runs (not run here — this was a
    single-org write, not a batch).

### 2026-07-30 — Hootsuite (row 159): `Their Initiative`/`Their Goal` replaced with their current
strategic bet, not a stale content artifact
- **Why:** Tej flagged that the existing clause ("your Social Media Trends report" / "turning
  social insights into measurable business impact") didn't reflect where Hootsuite actually is
  right now — a generic annual content-marketing report, not a specific current initiative. Tej
  had independently pulled outside research summarizing Hootsuite's GTM shift (category creation
  around "Social OS", enterprise upmarket, AI-first positioning via Wisdom) and asked which of it
  should become the hook.
- **Method — verified the user-supplied research against Hootsuite's own domain before writing
  anything**, same standard as any other personalization source even though the lead came from
  Tej rather than a fresh scrape: `WebFetch` against `hootsuite.com/whats-new/social-os` and the
  Hootsuite homepage directly, confirming (a) "Social OS" launched **2026-06-24** as a named,
  dated initiative (not a rebrand-in-general), with sub-products Perch/Nest/Parliament/Lumen/Wisdom;
  (b) Hootsuite's own stated tagline for it is **"move at the speed of culture."** Both facts
  traced to hootsuite.com URLs, not the third-party research doc's citations.
- **Written (`master-prospects` BJ159/BK159/BL159):**
  - `Their Initiative (→[initiative])`: `your Social OS launch` (was `your Social Media Trends
    report`)
  - `Their Goal (→[goal])`: `moving at the speed of culture` (was `turning social insights into
    measurable business impact`)
  - `Personalization Source`: `https://www.hootsuite.com/whats-new/social-os |
    https://www.hootsuite.com/` (was the `/about` and `/research` pages)
  - Passed the grammar gate before writing: `initiative` is one named noun phrase, no internal
    "and", no "focus on" collision, no double-"your" (renders verbatim since it already starts
    with "your"). Composed sentence: "We've been following your Social OS launch and your focus
    on moving at the speed of culture."
  - Read back all three cells directly post-write (BJ159/BK159/BL159 individually, not a row
    range) to confirm the write landed, per the read-back-confirmation rule.
- **Deliberately left untouched:** `Why Us (→[why])` — the free-trial → pre-seed-founder-funnel
  framing still holds regardless of Hootsuite's enterprise/AI push (their self-serve tier is
  unaffected by the upmarket motion); not revisited without a specific reason to.

### 2026-07-30 — Freehouse / "Donnelly / Freehouse Collective" (row 114): clauses written cold,
plus a process mistake caught and corrected mid-session
- **Context:** Tej supplied a full company breakdown of Freehouse Managed Services (from their own
  site) in chat and asked for `Their Initiative`/`Their Goal` following the standard grammar-gate
  format. The row's `VSW`=TRUE and `Warm Lead Path`="Past VSW sponsor: 2019" (per the CSV of past
  sponsors, `Why Them` flags real ambiguity about whether this is the same Donnelly). Per the
  reengagement-drafts-for-approval.md precedent, a VSW=TRUE row should get the re-engagement
  variant, not cold copy — flagged to Tej via AskUserQuestion. **Tej explicitly chose "Treat as new
  cold lead"** — his call, logged as the deviation from the default.
- **Written (`master-prospects` row 114):**
  - `Their Initiative (→[initiative])` (BJ114): `your operator-led approach to hospitality
    management` — no named program/fund/cohort exists in the site material Tej provided, so this
    uses their stated "operators, not consultants" positioning instead; flagged NEEDS-VERIFY in
    `Notes` rather than inventing a proper-noun hook.
  - `Their Goal (→[goal])` (BK114): `profitability and operational efficiency` — near-verbatim
    from their own one-line description.
  - `Why Us (→[why])` (BO114): matches §5 "Customers among founders/SMBs" in
    [vsw-sponsor-value.md](docs/vsw/vsw-sponsor-value.md) — Freehouse sells directly to
    owner-operators, and 45% of VSW's room are the principals who'd make that call themselves.
  - `VSW Alignment` (BM114): states the row's cold-vs-re-engagement conflict explicitly so a
    drafting agent doesn't invent a re-engagement framing on its own — tone directive: first-touch,
    don't reference the 2019 relationship.
  - Stop Slop Guide fetched live from Notion (`5d33c81d-b930-419e-8557-41fbb4ec7629`) and applied:
    dropped an em dash and a three-item list from `Why Us` first drafts (`founders, CEOs, or
    owner/partners` → `founders and company principals`, reusing the value doc's own §1 phrasing).
  - Grammar gate (`assertClean(checkRow(...))`) run before writing; only the expected `PAST VSW
    SPONSOR` warn fired (Tej's informed override, not a defect).
- **Process mistake, caught mid-session and corrected:** the first read of this row used a
  truncated range (`A3:AZ600`, stopping at column 51) that never reached `Personalization Source`
  (column 63). I concluded the field was blank, asked Tej to approve skipping it, and he approved
  ("Treat as... skip the personalization source... for future, edit the process"). The field was
  **not actually blank** — `https://www.freehouse.co/ | https://www.freehouse.co/events-booking`
  was already there. Worse, my first write to `Notes` (BH114) overwrote the row's existing content
  ("Net-new prospect from VSW Future Planning past sponsors CSV; sponsored 2019 with in-kind
  attendee discount.") outright instead of merging it.
  - **Corrected in the same session:** re-read the row with the full column range, confirmed via
    Google Sheets revision history (`drive.revisions`, revision 4097, the last snapshot before
    today) that `Their Initiative`/`Their Goal`/`VSW Alignment` were genuinely blank beforehand (no
    data lost there), re-ran the gate with the real `Personalization Source` value (passed clean,
    no override needed), and rewrote `Notes` to preserve the original sentence with the corrected
    context appended.
  - **Playbook updated:** [outreach-copy-playbook.md](docs/outreach-copy-playbook.md)'s
    `Personalization Source` bullet now (a) requires reading the full row width before treating any
    field as blank, and (b) formalizes Tej's standing approval — when he supplies material directly
    and explicitly instructs writing without a source, skip re-asking and use
    `{ allow: ["NO SOURCE"] }` with a logged override. Also saved as a feedback memory
    (`feedback_source_override_and_full_row_reads.md`).
  - Every write read back by exact cell address (BJ114/BK114/BO114/BM114/BH114) post-write, not a
    row range. Temp scripts deleted after (`check_freehouse_tmp.ts`, `check_headers_tmp.ts`,
    `write_freehouse_tmp.ts`, `verify_freehouse_tmp.ts`, `check_revisions_tmp.ts`,
    `check_revision_content_tmp.ts`, `fetch_old_revision_tmp.ts`, `parse_old_revision_tmp.ts`,
    `check_accenture_live_tmp.ts`, `fix_freehouse_notes_tmp.ts`).
- **Unrelated bug surfaced, not fixed here:** while checking column alignment against a known-good
  row, Accenture's live `Why Us (→[why])` cell (row 8) reads literal text `"FALSE"` instead of the
  sentence quoted as its worked example in
  [org-goals-enrichment-model.md](docs/org-goals-enrichment-model.md) — looks like a checkbox
  default overwrote real text, or the real text was never actually written to the sheet despite
  being documented as an example. Worth a pass to check whether other `Why Us` cells across the
  sheet carry the same `FALSE` placeholder instead of real content.

### 2026-07-30 (Moment Energy — Initiative/Goal rewrite, homegrown-ecosystem angle)

- **2026-07-30 — Rewrote Moment Energy's (row 224) `Their Initiative`, `Their Goal`,
  `Personalization Source`, `VSW Alignment`; Tej's directive after rejecting the prior clause.**
  Tej pasted an outside ChatGPT-authored sponsorship memo for Moment Energy (open-web-sourced,
  compared them to Kraken Robotics, proposed naming rights/tracks/packages VSW doesn't have) and
  flagged it as unusable — "how does this even relate to vsw... would just read as poor outreach."
  Confirmed the memo shouldn't feed `Their Initiative`/`Their Goal` (violates the playbook's
  deep-scrape-own-domain rule; its one new-sounding fact, "UL 1974," conflicts with the
  site-sourced UL 1973/9540/9540A already on the row) — but the pre-existing sheet clause had its
  own real problem Tej then surfaced: `Their Initiative` = **"Luna BESS"**, `Their Goal` =
  "getting repurposed batteries certified to deploy at commercial scale" — a pure internal
  product-certification milestone with no connection to the founder/startup ecosystem, giving
  Moment Energy no actual reason to spend resources on VSW instead of their own roadmap.
  - **Research (deep-scrape, per playbook):** Firecrawl `/v2/scrape` JSON-extract against
    `momentenergy.com`'s own `/news` archive (own domain, required method — not the open-web memo)
    turned up several ecosystem-tied milestones: 3rd place + $35K at the 2021 New Ventures BC
    Start-Up Competition, selection for AWS's Clean Energy Accelerator 4.0 (2024), an SFU MOU
    (Mar 2026), and CEO Edward Chiang named Fasken's Climate Tech Founder of the Year (Dec 2025).
    First proposed the Fasken award as the new `Initiative`; **Tej rejected that one too** — didn't
    want the individual-founder-award framing, asked for a "homegrown company" angle instead.
  - **Final clause, sourced entirely from Moment Energy's own domain:**
    - `Their Initiative` (BJ224): `your top-three finish at New Ventures BC`
    - `Their Goal` (BK224): `doubling your Vancouver headquarters and team`
    - `Personalization Source` (BL224): New Ventures BC placement article
      (`momentenergy.com/news/moment-energy-places-third-at-the-2021-new-ventures-bc-competition-scoring-a-35k-prize-package-2`)
      `|` Series A article (`momentenergy.com/news/series-a`) — same source as the HQ-doubling quote.
    - `VSW Alignment` (BM224): rewritten to foreground the homegrown-BC arc (Surrey garage 2019 →
      New Ventures BC finalist → Vancouver HQ doubling its team) instead of a product cert.
  - Passes the clause gate (no internal "and"/comma in the initiative, no "focus on" collision, no
    dollar figure, named specific thing not boilerplate). Org name at B224 re-verified as "Moment
    Energy" immediately before writing (row-drift guard). Write via `spreadsheets.values.batchUpdate`
    (RAW) to the 4 exact cells, headers re-read live immediately before writing (resolved
    `Their Initiative`/`Their Goal`/`Personalization Source`/`VSW Alignment` to BJ/BK/BL/BM — not
    hardcoded), confirmed by reading back each exact target cell individually (not a row range).
    Temp scripts (`check_moment_tmp.ts`, `me_scrape_tmp.ts`, `me_news_links_tmp.ts`,
    `me_articles_tmp.ts`, `write_moment_tmp.ts`) deleted after, never committed.

### 2026-07-30 (Kraken Robotics — VSW Alignment rewrite, CANSEC-sponsorship reasoning)

- **2026-07-30 — Rewrote Kraken Robotics's (row 193) `Their Goal` and `VSW Alignment`, no new
  scraping — Tej directive, reasoning from facts already on the row.** Prompted by Tej's framing:
  Kraken sponsors CANSEC (~$10,300 CAD, already in `Why Them`/`Source Link`), and its sponsorship
  pattern is revealed preference for what it actually buys — defence-procurement/government-relations
  access, not brand awareness. Asked what overlaps with VSW's own audience.
  - **Left `Their Initiative` (BJ193) unchanged** — `your KATFISH towed synthetic aperture sonar`,
    already specific and sourced to `krakenrobotics.com`, and itself a defence/mine-countermeasures
    product, so it already carries the CANSEC logic without editing.
  - **`Their Goal` (BK193)** tightened from the generic "transforming subsea intelligence in
    challenging underwater environments" (borderline boilerplate — would fit almost any subsea
    company) to `scaling subsea intelligence capability into defence and government markets` —
    consistent with the row's own `Category` (`Defense & aerospace`) and the CANSEC sponsorship
    already on file; no new facts invented, no dates/dollar figures.
  - **`VSW Alignment` (BM193)** rewritten to carry the actual "why VSW" reasoning — this is the
    field designed for that (never quoted into a message; `Their Initiative`/`Their Goal` are
    quoted verbatim into the composed sentence, so the relevance case doesn't belong there).
    New text ties Kraken's CANSEC spend (procurement/gov-relations, not awareness) to its
    acquisition-driven growth (Kraken Power 2017, PanGeo Subsea 2021, 3D at Depth 2025, Covelya
    Group 2026) and its existing BC partner (Cellula Robotics) — framing VSW's pre-seed founder
    pool as where Kraken's next acquisition target gets found early. All facts drawn from what
    was already sourced on the row; no fresh scrape run.
  - **Deliberately left out:** a claim that ISED (Innovation Canada) and Innovate BC attendees
    give Kraken a second federal-relations venue at VSW — raised in conversation as a plausible
    angle but not verified against this row or a source this session. Worth confirming separately
    (attendee data lives in the `vsw-playground` repo, not here) before it goes in `VSW Alignment`
    or any outreach copy.
  - Passed `scripts/enrichment-gate.ts`'s `checkRow`/`assertClean` before writing (zero flags).
    Write via `spreadsheets.values.update` (RAW) to the two exact cells, headers re-read live
    immediately before resolving `Their Goal`/`VSW Alignment` to BK/BM (not hardcoded), confirmed
    by reading back each exact target cell individually. Temp scripts (`check_kraken_tmp.ts`,
    `write_kraken_tmp.ts`) deleted after, never committed.

### 2026-07-30 (Tier 3 doc tab links written to `master-prospects` column BS)

- **Wrote a per-company Google Doc tab link into `BS` ("Draft Link") for all 50 Tier 3 rows,
  sourced from "Future Planning - Outreach Drafts #2"** (`1dtYDFnZUmjC6cMk-lTFpcoPQ_hWnxv6kQ8_uTwOaGmY`,
  shared with the `vsw-future-planning@...iam.gserviceaccount.com` service account earlier this
  session — read/write access to the doc verified via a reversible insert-then-delete test through
  the Docs API before any real edit was made).
  - Confirmed via the Docs API that the doc's "Tier 3 (50)" tab has exactly 50 child tabs (one per
    company), matching Tej's own count, and that `master-prospects` has **no Tier column and no
    Tier-3 tab anywhere** — this doc's tab list is currently the only source of truth for the
    Tier 3 roster.
  - Matched each of the 50 tab titles to its `master-prospects` row via `Organization Name` (col B):
    48 matched exactly (case/punctuation-insensitive). Two required a manual override after
    confirming by hand — doc tab **"CloudFare"** (misspelled) → row 88 **"Cloudflare"**; doc tab
    **"Freehouse Collective (Donnelly)"** → row 114 **"Donnelly / Freehouse Collective"** (word
    order flipped). Both confirmed with Tej before writing (he said proceed).
  - URL format: `https://docs.google.com/document/d/<DOC_ID>/edit?tab=<tabId>` — note the API's
    `tabProperties.tabId` already includes the `t.` prefix (e.g. `t.qrzjmn6ol9d3`); an early version
    of the script incorrectly prepended an extra `t.`, caught in a `DRY_RUN` pass before any write.
  - **Pre-write check found row 88 (Cloudflare) already had a non-blank `BS` value** pointing to a
    *different* Google Doc (`1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk`, tab `t.ur7jivcybosp`) —
    presumably a leftover draft link from the original Outreach Drafts doc (#1). Printed it before
    overwriting and flagged it to Tej; overwrote per his "just proceed," but the old link is only
    preserved here in this log, not merged into the cell (single URL field, no multi-value
    convention for `BS` the way `Why Them`/`Source Link` have pipe-delimited append patterns) —
    worth Tej confirming that doc/tab isn't still needed before it's fully forgotten.
  - Wrote all 50 via one `spreadsheets.values.batchUpdate` (USER_ENTERED), then read back every one
    of the 50 exact target cells individually (not a row-range read) to confirm. All matched.
    Temp scripts (`check_tier3_tabs_tmp.ts`, `match_tier3_rows_tmp.ts`, `check_bs_col_tmp.ts`)
    deleted after, never committed.

### 2026-07-30 (Status correction — 101 rows wrongly advanced to `Drafted — awaiting approval`; `Draft Link` false-positive recurred; new Apps Script `advanceStatus()` menu added and fixed)

Tej installed a new in-sheet "VSW → Advance Status" menu (added this session, porting
`scripts/advance-status.ts`'s logic into `scripts/apps-script-sticky-milestones.gs` so `Status`
could be advanced without a terminal). First run threw `Exception: ... cell A521 violates the data
validation rules ... Active, Archived` and, separately, Tej reported the Tier 3 rows it touched
were wrongly set to `Drafted — awaiting approval` when they were just `Enriched`.

**Bug 1 — row-range overshoot.** The script used `sheet.getLastRow()`, which returns the last row
with *any* content in *any* column of the whole sheet, not just this table. Real `master-prospects`
data ends at row 398, but leftover formatting/validation from an old, unrelated table (an
`Active`/`Archived` dropdown) still lives on the grid past row 520, so `getLastRow()` resolved to
521+ and the script tried to write `Status` values into that dead zone, tripping the foreign
validation rule. **Fix:** `lastDataRow_()` now finds the real last row by scanning the
`Organization Name` column for its last non-blank cell (capped at a 1000-row scan ceiling), and
`advanceStatus()` uses that instead of `getLastRow()`.

**Bug 2 — `Draft Link` false-positive, recurrence of the 2026-07-22 bug.** The ported `derive()`
logic (faithfully copied from `scripts/advance-status.ts`) treated any non-blank `Draft Link` as
proof a real draft exists → `Drafted — awaiting approval`. But `Draft Link` is pre-populated with a
placeholder doc-tab link as soon as a row's drafting section is created, well before real copy is
written — exactly the false positive Tej fixed once already on 2026-07-22 by adding a `Drafted?`
checkbox and asking for `advance-status.ts` to gate on that instead. **That fix never actually
landed in `advance-status.ts`** — checked the file directly, it was still reading `Draft Link`.
Ported the same latent bug into the new Apps Script as a result.

**Blast radius, checked before touching anything:** live read found **101 rows** at `Status =
Drafted — awaiting approval` with `Drafted? != TRUE` (i.e. no real draft) — 49 Tier 2, 49 Tier 3, 3
Warm. Only **1** row was legitimately there (`Drafted? = TRUE`). Given the scale and that Tier 2
rows were affected (not just today's Tier 3 run), this was very likely accumulating silently across
multiple sessions since 2026-07-22 every time `advance-status.ts` ran, not just from today's new
Apps Script menu. Re-derived the correct target for each of the 101 using the fixed
(`Drafted?`-gated) logic before writing anything, and confirmed with Tej before applying.

**Written:** batchUpdate of `Status` (col A) for all 101 rows — 98 → `Enriched`, 2 → `Route
identified`, 1 → `Contact identified`. Verified by a single bulk read of `A3:B398` (not 101
individual reads — the first read-back attempt did that and hit the Sheets API's per-minute read
quota; switched to one bulk range read instead). Post-fix distribution: 102 `Enriched`, 52 `Route
identified`, 207 `Sourced`, 10 `Approved`, 6 `Contact identified`, 8 `Sent`, 6 `Archived`, 2
`Meeting booked`, 1 `Bounced`, 1 `Drafted — awaiting approval` (the legitimate one), 1 `Drafted`
(pre-existing, unrelated legacy value, out of scope).

**Fixed at the root, both places:** `scripts/advance-status.ts`'s `derive()` and the Apps Script's
`deriveStatus_()` now both gate on `Drafted? = TRUE`, never `Draft Link`. Comment added to
`advance-status.ts` pointing at this entry so the gate doesn't silently regress a third time.

Temp scripts (`check_tmp.ts` through `check_tmp4.ts`, `fix_status_tmp.ts`, `verify_tmp.ts`) run via
`npx tsx` from the repo root, deleted after, never committed.

### 2026-07-30 (Tier 3 batch drafting — 49 tabs written to "Outreach Drafts #2")

Drafted all remaining Tier 3 rows into their per-company tabs in **"Future Planning - Outreach
Drafts #2"** (`1dtYDFnZUmjC6cMk-lTFpcoPQ_hWnxv6kQ8_uTwOaGmY`). 49 tabs written; BAE Systems left
untouched (Tej wrote it by hand). Scope confirmed live: 51 rows carry `Tier = Tier 3`, 50 are
`Ready? = TRUE`, and Lighthouse Labs (row 200) was set to `Archived` by Tej before this run and
was excluded.

**Process decisions, all Tej's, taken before drafting:**
- **Tab layout = the playbook's fuller format**, not the shape of the hand-written BAE tab:
  `HEADING_1` title, 3x2 table (`To:` / `Subject Line:` / `Additional Info`), body paragraphs,
  `HEADING_2` "Personalization used". A `Flags` section was added where a row had caveats.
- **One channel per tab, chosen by `Outreach Route`** — 31 email/contact-form, 18 LinkedIn.
  This supersedes the BAE tab, which carries both.
- **Email bodies = Andrew's Email A/B verbatim** with the 2026-07-23 revisions applied (CTA
  collapsed to one sentence; times-and-or-redirect line and one-pager line deleted). Variants
  alternate A/chair, B/community, A/community, B/chair down the email rows: 16 A, 15 B.
- **Subjects = Andrew's, matched to variant**; past sponsors get the re-engagement subject.

**Deviations from Andrew's literal template, each deliberate and flagged in the doc's front matter:**
1. **`your work on X` instead of `[Company]'s work on X`.** Andrew's placeholder uses the
   possessive; the playbook makes "your work on" a hard invariant because the possessive stutters
   ("AngelList's work on AngelList Link") and breaks on names ending in s. Playbook wins.
2. **Bodies end at `Best,`**, dropping his signature block, per the playbook's render spec and
   matching the BAE tab.
3. **Heading uses a colon** (`AngelList: Email A / chair@`) rather than the playbook's literal
   `{Org} — Email A / …`, because the no-em-dash rule is absolute in both the Stop Slop Guide and
   the Voice System.
4. **`Why Us` added to Andrew's paragraph 2.** His template has no slot for it, and his paragraph
   ends on "those priorities line up strongly with the community…", a claim with no evidence. The
   `Why Us` sentence now follows it in the same paragraph, which is the Voice System's
   "Claim, then name names" pattern. Tej reviewed both this and a separate-paragraph variant on
   the AngelList tab and chose the in-paragraph version. Andrew's own sentence was not edited.

**`Why Us` rewritten for email prose, sheet cells left unchanged (Tej's call).** The stored cells
were written as analyst notes and shared one shape: "[their program] does X, **and** VSW [696 /
45%]". Three defects against the guides: third person about the reader (Stop Slop rule 5 wants
"you"), stat-stacking (the playbook licenses one number **or** one named format, never both —
Anthropic's cell carried 696 *and* 45%), and identical rhythm across 31 drafts. Rewrites lead with
"you", carry one fact, vary the pivot, and cap near 30 words. **Facts rotated by matching each
prospect to a row in `vsw-sponsor-value.md` §5** rather than defaulting to 696: 11 use the 45%
principals figure, 10 use 696 organisations, 4 a named format (workshop/session), 4 talent
matchmaking, 1 the decade of trust, 1 the sponsor roster. **The tracker and this doc now differ by
design on `Why Us`** — the cells hold the reviewed analyst version, the doc holds what shipped.

**Re-engagement openers on 8 rows** (Flywheel 2019; Superhuman, sponsored as Grammarly, 2019 and
2021; Manning Elliott 2019/2020/2021; Northeastern 2023/2024; Sparkbridge 2025; WorkSafe BC 2019;
BC Tech 2023 and TransLink 2019 on LinkedIn). Two rows carry a VSW flag but were written **cold**:
Donnelly / Freehouse Collective per Tej's directive recorded in its `VSW Alignment`, and McCarthy
Tétrault whose 2019 sponsorship is asserted in `Why Them` while the `VSW` column reads FALSE
(flagged on the tab for confirmation). This copy is still unapproved by Andrew.

**Definition of done, verified by reading the doc back** (not by inspection): 50 tabs, 50 unique
titles; zero run-ons in any opening sentence; all 18 LinkedIn notes ≤300 with the printed count
matching the actual string length (max 261); every email tab has a populated `To:` and
`Subject Line:` cell and every `To:` matches the tracker; every greeting matches its recipient
(8 flagged by the matcher were all false positives — `d.beckers`→Dominik, `kpagliero`→Karissa
Pagliero, `mtkacheva`→Maria Tkacheva, `kstaeger`→Katie Staeger, `jbrown`→Jude Brown, plus three
shared inboxes greeted by name per the playbook's rule); zero em dashes; zero dollar figures; zero
5,000-attendee claims without their timeframe; none of the three 2026-07-23 deleted lines present.
`npx tsx scripts/run-report.ts --blocking` returns 4 blocking flags across 129 rows, **none caused
by this run**: BAE Systems (no `VSW Alignment`, LI hook 57 chars — its `Why Us` cell literally
contains the string `FALSE`, a pre-existing data bug on Tej's hand-written row), DMZ (no LI hook,
see below), and a row named "LinkedIn" that is not Tier 3.

**DMZ (row 111) had no `LI Short Hook`.** Its note was built from `Their Initiative` +
`Their Goal` per Tej's direction ("build them and flag them") and flagged on the tab. The hook was
**not** written back to the sheet, so the blocking flag stands — worth clearing separately.

**Sheet writes.** Headers resolved live at write time (`Drafted?`→BR, `Draft Variant`→BT, not
hardcoded), and a row-drift guard confirmed all 50 `Organization Name` values still sat on their
expected rows before anything was written. One `values.batchUpdate` (USER_ENTERED) set
`Drafted? = TRUE` on 50 rows (49 drafted + BAE row 36, per Tej: "skip writing to BAE but still
check off the Drafted? checkbox since I did it manually") and `Draft Variant` on 49 (BAE left
alone). Read back via two bulk column reads, zero mismatches. Then `scripts/advance-status.ts`
dry-ran clean at exactly 50 rows before `--write`; final distribution shows 50 at
`Drafted — awaiting approval`. This is the first run since the 2026-07-30 fix where
`advance-status.ts` gated on `Drafted?` rather than `Draft Link` — it advanced exactly the
intended 50 and no others, confirming the fix holds.

**Front matter written to the parent "Tier 3 (50)" tab**, carrying the five approval flags
(attendee figure still unconfirmed by Andrew, "expanded VSW" language, new re-engagement copy,
compressed LinkedIn notes, the `Why Us` addition), how the drafts were built, and the re-engagement
roster.

**Correction, 2026-07-30 (Tej):** an earlier version of this entry recorded a "do-not-send list"
covering Sparkbridge, Dapper Labs, Pomerleau and 12 rows on an unverified email format. **No such
list exists** — it was never a real artifact or a real hold on those rows, and it should not be
treated as one. Removed here and from the Friday block of the week plan. Do not reconstruct it from
this paragraph.

Temp scripts (`t3_state_tmp.ts`, `t3_doc_tmp.ts`, `t3_bae_tmp.ts`, `t3_bae_row_tmp.ts`,
`demo_row_tmp.ts`, `demo_tab_tmp.ts`, `t3_dump2_tmp.ts`, `t3_copy_tmp.ts`, `t3_render_tmp.ts`,
`t3_verify_tmp.ts`, `t3_sheet_tmp.ts`, `t3_data_tmp.md`) deleted after, never committed.

---

### 2026-07-30 — Tier 2 `Drafted?` back-fill from Outreach Drafts #1

**Sheet write (`master-prospects`, col BR `Drafted?`): 48 Tier 2 rows set to `TRUE`.**

Reconciled the sheet's 49 `Tier 2` rows (col BI) against the "Tier 2 (50)" section of
[Future Planning — Outreach Drafts #1](https://docs.google.com/document/d/1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk/edit)
(doc id `1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk`). A tab counted as drafted only if it
contained a real draft heading (`<Org> — Email A/B …` or `— LinkedIn A/B …`), not just an org
name tab. 48 of 49 matched; every one already carried a `Draft Link` (BS) and `Draft Variant`
(BT) pointing at that doc, so `Drafted?` was simply lagging.

Rows written (3, 5, 6, 8, 10, 13, 14, 16, 17, 18, 24, 26, 29, 30, 31, 32, 75, 103, 136, 138, 144,
147, 151, 158, 203, 206, 209, 215, 222, 228, 243, 245, 247, 258, 275, 292, 301, 311, 331, 338,
342, 345, 352, 365, 366, 369, 380, 391). Read back per-cell (`B{row}` + `BR{row}` exact ranges,
per the trailing-blank-trim rule) — 48/48 confirmed `TRUE`, zero failures.

**Left `FALSE`: Metro Vancouver (row 220).** Its tab in the doc exists but is empty — org-name
heading with no draft body. It also reads `Ready? = FALSE`, consistent with never having been
rendered.

**Not Tier 2, so out of scope and untouched** even though they appear in the doc's Tier 2 section
or trailing tabs: Adobe (row 11, blank Tier), Monday Girl (225, blank), Cloudflare (88, Tier 3,
already `TRUE` against Drafts #2), Angel Forum (20), Greater Vancouver Board of Trade (152),
Voyager Capital (375), The Forum (340) — all `Warm`.

**Not run:** `scripts/advance-status.ts`. Tej asked only for the checkbox; Stage advancement to
`Drafted — awaiting approval` is a separate call. He noted all Tier 1 and Tier 2 drafts are
Andrew-approved.

Temp scripts (`hdr_tmp.ts`, `t2_tmp.ts`, `mark_tmp.ts`) deleted after, never committed.

### 2026-07-30 (cold vs. warm workstream: Tier made immutable, Workstream added, overview-stats rebuilt)

**The problem.** `master-prospects` col `BI` (Tier) was carrying two unrelated facts at once: which
tier bucket an org belongs to (the denominator for Andrew Dilts' quota — 50/tier, 100 in Tier 4),
and which workstream owns it now. Its live dropdown was `Tier 1 / Tier 2 / Tier 3 / **Warm**`. So
when Viv flags a warm contact, the tier gets overwritten with `Warm` and that tier's count silently
drops. Work Tej had already delivered (sourcing → enrichment → draft) stopped counting toward the
quota it was measured by, and the row's original tier was gone with no record. Same failure class
as golden rule #3 — a lossy overwrite that destroys evidence instead of recording both facts. It
had already happened 6 times (rows 20, 152, 221, 262, 340, 375; 5 of the 6 fully enriched, 3 with
drafts written).

**The fix — two axes, two columns.**
- `BI` Tier is now **immutable org classification only**. Dropdown changed to `Tier 1 … Tier 5`
  (`Warm` removed; `Tier 4`/`Tier 5` added — neither was in the list despite the quota being 100 in
  Tier 4 and 3 rows already carrying Tier 5). Input message on the cell states the rule.
- **New columns `CA` Workstream / `CB` Handed Off On / `CC` Handed Off By / Why**, under a new row-1
  group label `Workstream Ownership`. `CA` is a strict dropdown: `Cold` / `Warm — handed off`.
  Backfilled rows 3–415: 407 `Cold`, 6 `Warm — handed off` (the rows above). Those 6 keep
  `Tier="Warm"` for now (Tej: ignore the orphans) so they show a validation triangle until
  re-tiered — a deliberate "needs re-tiering" marker, and the reason ② QUOTA's "Handed to warm"
  column currently reads 0 across every tier.
- Quota math is now: **delivered** = `COUNTIFS(Tier=t)` regardless of workstream (work done is work
  done); **still mine** = the same restricted to `Workstream="Cold"` and a non-terminal Status.
- Deliberately NOT a Status (col A) value. Status is *how far the org got* and is the evidence the
  work happened; overwriting it with "moved to warm" destroys exactly what we're trying to show, and
  a hand-off isn't terminal — warm outreach can still convert, and that Won should attribute back to
  the tier Tej sourced it into.

**⚠️ Sheets API gotcha, cost ~4 failed passes — worth remembering.** `setDataValidation` and
`repeatCell` **silently skip rows hidden by an active basic filter**. No error, no partial-success
signal in the response (`replies: [{}]`). `master-prospects` had a live filter on col 60 (Tier)
hiding `"", Tier 1, Tier 3, Tier 5, Warm`, so the first passes stamped only the visible Tier 2/Tier 4
rows and left a scattered, baffling mix of `BOOLEAN`/`ONE_OF_LIST` down the column. `values.update`
and `values.clear` are NOT affected — they write straight through hidden rows, which is why the
values looked right while the validation didn't. **Before any formatting/validation batchUpdate on
master-prospects: read `basicFilter`, `clearBasicFilter`, apply, then `setBasicFilter` to restore it
verbatim.** The restore here also widened the filter range from col 78 → 81 so Workstream is
filterable; criteria left untouched.

Second gotcha, same session: `appendDimension` inherits the *preceding* column's properties. The new
CA/CC columns came in carrying `BZ`'s (Follow-up Sent?) checkbox validation and `FALSE` values on
every row. Cleared explicitly.

**`overview-stats` rebuilt** (`scripts/build-overview-stats.ts`, still all live formulas):
- ① PIPELINE and ⑤ PHASE CUTS are now **cold-workstream only** — they're queues of work to actually
  do, and a handed-off org shouldn't read as Tej's stalled work or as a follow-up he owes.
- **New ② QUOTA** — per tier: Target / Delivered (in tier) / → Handed to warm / Closed (cold) /
  Still mine (cold, active) / Gap to target / % of target. The three middle columns partition
  Delivered exactly (Still-mine is computed by subtraction so it can never drift). Targets are plain
  editable numbers in col B, not formula constants. Current: T1 20/50, T2 49/50, T3 51/50 (102%),
  T4 0/100, T5 3/50.
- ③ COHORTS / ④ SUMMARY / ⑥ CUMULATIVE stay **both workstreams** — historical attribution and the
  reconciliation check have to cover the whole sheet.
- ⑦ DRILL-DOWN gained a third dropdown, **Workstream** (`All` / `Cold` / `Warm — handed off`).
  Verified live: Enriched × All = 71 = 66 cold + 5 warm.
- **Every count is now guarded on `Organization Name <> ""`.** `master-prospects` rows 416–520 are
  ~105 phantom rows with `Status` pre-filled to `Sourced` and no org. They were inflating the old
  tab's Sourced count by 105 and its grand total from 413 to 498. The guard makes the tab immune;
  the phantom rows themselves are left alone (Tej's call to make).
- **New reconciliation lines under ④:** "Rows in master-prospects with an Organization Name" (413)
  minus ④'s TOTAL, surfaced as "⚠ Unaccounted — Status or Tier holds a value outside its dropdown".
  Currently **7**: the 6 `Tier="Warm"` orphans + row 11 (Adobe), whose Status is the stale value
  `"Drafted"` rather than `"Drafted — awaiting approval"`, so it falls into no bucket anywhere. Added
  because a row with an out-of-enum value vanishes from every count with no signal at all — the same
  silent-drift class as the phantom rows.

**Still open for Tej:** re-tier the 6 orphans (their original tiers aren't recoverable from the
sheet); fix row 11's Status; decide whether to delete rows 416–520. Also unbuilt and the bigger win —
the **warm-screen gate before enrichment** (batch the next N org names to Viv/Andrew with a fixed
window; unanswered = cold; log the screen date on the row), which caps the rework instead of leaving
it open-ended and makes the "who authorized this work" question a timestamp rather than an argument.

Temp scripts (`inspect*_tmp.ts`, `probe*_tmp.ts`, `schema_tmp.ts`, `fix*_tmp.ts`, `t*_tmp.ts`,
`recon_tmp.ts`, `verify_tmp.ts`) deleted after, never committed.

---

### 2026-07-30 — Week plan: Thursday closed out, Friday rebuilt around the send backlog

**Thursday** marked done through the afternoon: Tier 3 posted to Andrew for approval, and a new
`Done` block covering the tracker-integrity work (Tier/Workstream split, `overview-stats` rebuild,
phantom-row guard, Tier 2 `Drafted?` back-fill, plan re-sync). Thursday's cap now records the real
day — ran to 6:30p against a 5:00p finish, 1:30 over, taken back Friday.

**Friday rebuilt.** Sizing came from a live read of `master-prospects` (not from the artifact's
prior figures, which had drifted): **10** Tier 1 at `Approved` waiting to send, **48** Tier 2
drafted-and-approved, **50** Tier 3 at `Drafted — awaiting approval` = **108 sends**. Tej's own
logged rate is ~2 min per send end to end, so 3:36. Against a 5.5 hr day (8:00–1:30, shortened to
offset Thursday), the previous Friday — Tier 3 sends + 100-org Tier 4 tagging + full weekly
review — totalled ~11:30 and could not land.

**Tej's cuts:** Tier 4 identification moves to Monday (it was labelled "stretch, not a promise" all
week, and the WIG was already met at 50/50 drafted); the full weekly review drops to a 30 minute
close. Final shape: 0:15 start-up, 0:45 response-tracking build, 3:36 sends, 0:30 follow-up sweep
and close = 5:06 against 5:30.

**Response-tracking build placed *before* the sends, deliberately.** The columns already exist
(`Replied?`, `Bounced?`, `Meeting Booked?`, `Follow-up Due?`, `Follow-up Sent?`) so it is a view and
a process, not schema. Putting it first means an over-running day drops the tail of the Tier 3
sends — which are contingent on Andrew's approval anyway — rather than dropping the capture for 108
messages already out the door. Tier 3 carries a hard 11:00 decision point: if approval has not
landed, it does not go today.

**Scoreboard corrected against the live sheet:** Tier 1 read "11 approved waiting to send" but the
sheet says 10 approved / 8 sent / 1 replied / 1 bounced; Tier 2 read "48 drafted awaiting approval"
but those are approved and waiting to send. Tier 4's row now says identification moved to Monday.

**Known cost, recorded on the plan:** dropping the weekly review drops the pass that catches stale
statuses, and two surfaced today alone (Tier 2 rows reading `Enriched`, Adobe reading `Drafted`).
Those are Monday's first job. Tier 4 moving to Monday goes into the end-of-day message before it is
sent — that message had not gone out at the time this was written.

**Also corrected here (Tej, same session):** the Friday block briefly carried a "do-not-send list"
(Sparkbridge, Dapper Labs, Pomerleau, 12 rows on an unverified email format), inherited from the
Tier 3 drafting entry above. No such list exists. Removed from the plan and from that entry.

All three copies rebuilt and verified in sync: local source, twelveoclock.co/vsw-week-plan (Railway
`vsw-week-plan`), and the Claude artifact. Temp script (`fri_size_tmp.ts`) deleted, never committed.

## 2026-07-31 — Metro Vancouver draft written without a verified hook (Tej's call)

Tej asked for an email draft for Metro Vancouver (tracker row 220). Before drafting, the row's own
Notes (from the 2026-07-22 enrichment pass) turned out to say no genuine startup/innovation hook
exists at the whole-Metro-Vancouver-government level — the AI sector profile / accelerator claim in
this row's `Why Them` actually belongs to Invest Vancouver's row, not this one, and Metro
Vancouver's own site shows its mandate is water/waste/air quality/parks/housing/regional planning,
not economic development. `Their Initiative` / `Their Goal` / `Why Us` are all genuinely blank, not
just unfilled.

Flagged this to Tej before writing anything (playbook's hard rule: never invent specificity to hit
the personalization bar). Given three options — draft Invest Vancouver instead, draft Metro
Vancouver with a modest/generic angle, or draft it around the general government value prop — **Tej
chose the modest/generic angle for Metro Vancouver itself.**

Wrote one email (Email A / chair@) into the already-existing but blank "Metro Vancouver" tab in the
Outreach Drafts doc. **Deviates from Andrew's template on purpose:** the standard "we've been
following your work on [initiative] and your focus on [goal]" paragraph is replaced with an honest
paragraph that states plainly there's no specific program in mind, and leans only on verified
VSW-side facts (5,000+ people over 5 years, 696 orgs in 2026, from `vsw-sponsor-value.md` §0–1)
rather than fabricating an org-specific hook. Flagged NEEDS-VERIFY in the doc's "Personalization
used" section and flagged for Andrew's sign-off, since this is new copy, not his template verbatim.

Sheet: `Drafted?` flipped to `TRUE` for row 220 (`BR220`), read back to confirm. `Ready?` stays
`FALSE` as-is — correct, since `Their Initiative`/`Their Goal` are still genuinely blank and the
formula shouldn't be gamed to flip green. Temp scripts (`check_metro_van_tmp.ts`,
`check_doc_tmp.ts`, `check_doc_tab_tmp.ts`, `write_metro_van_draft_tmp.ts`,
`mark_drafted_tmp.ts`) deleted, never committed.

### 2026-07-31 (migration cleanup: the 6 orphaned `Tier="Warm"` rows re-tiered, `Handed Off On` backfilled, CB/CC artifact cleared)

Closes the two leftovers from the 2026-07-30 Tier/Workstream split above. Neither touched the
Tier 4 candidate set; both made the warm count unreportable if Andrew asked for it.

**Problem 1 — 6 rows still carried `Tier="Warm"`,** the value the migration retired (rows 20, 152,
221, 262, 340, 375). The migration deliberately parked them there as a "needs re-tiering" marker,
stamping `Handed Off By / Why` with *"original tier not recorded; needs re-tiering"*. That
placeholder was wrong for 5 of the 6 — this log does record it:

| Row | Org | Restored | Evidence |
|---|---|---|---|
| 20 | Angel Forum | `Tier 2` | Tier 2 through the 2026-07-23 drafting cycle; the flip to `Warm` was an unlogged live edit. Its own `Notes` dates it: *"7/23 - TN - Do not reach out via cold flow."* **Inferred, not logged** — the only one of the six without an explicit entry. |
| 152 | Greater Vancouver Board of Trade | `Tier 1` | 2026-07-21 Tier 1 warm-lead audit — 1 of 7 warm rows pulled out of the then-32-row Tier 1 |
| 221 | Microsoft | `Tier 3` | reached Tier 3 via the 2026-07-21 T2→T3 demote pass; pulled to `Warm` 2026-07-28 for `Warm Lead Person = Viv` |
| 262 | Planet Food | `Tier 3` | same pass, same 2026-07-28 pull |
| 340 | The Forum | `Tier 1` | 2026-07-21 Tier 1 warm-lead audit |
| 375 | Voyager Capital | `Tier 1` | 2026-07-21 Tier 1 warm-lead audit (`VSW=TRUE`, past sponsor 2020/2021) |

**Blanking `Tier` was rejected** — it drops the row out of every tier count, which is the exact
failure the migration existed to stop. **Tej approved all six as proposed**, the consequence
surfaced first: Tier 3 now reads **53 delivered against a target of 50**. That is correct under the
new model and not double-counting — ② QUOTA *delivered* counts work delivered regardless of
workstream, while *still mine* stays cold-only and is unchanged at 20 / 47 / 50. Tier 2 landing at
exactly **50/50** independently corroborates the Angel Forum inference. Live tiers after:
**T1 23 · T2 50 · T3 53 · T5 3 · blank 284 · Warm 0** (413 named rows). No validation triangles left
in `BI`.

**Problem 2 — `Handed Off On` couldn't distinguish "not handed off" from "handed off, undated."**
8 rows read `Workstream="Warm — handed off"` but only 2 (Vancouver Tech Journal 365, VANTEC 369)
had a date; the other 6 read `FALSE`. **`FALSE` was rejected as a sentinel** — it is the
`appendDimension` checkbox-inheritance artifact from the migration (the entry above notes it was
"cleared explicitly"; it was not — it was still sitting on all 405 cold rows in both `CB` and `CC`),
so it carried no meaning and could never have distinguished the two states. Backfilled the real
dates instead — the day each row actually left the cold workstream, per this log: **2026-07-21**
(152, 340, 375), **2026-07-23** (20), **2026-07-28** (221, 262). `CC`'s now-false migration
placeholder was replaced on those 6 with real provenance (who handed it off, why, and where the
restored tier came from) — not a silent overwrite: the placeholder's only content was the claim the
tier was unrecoverable, and the replacement text records what it actually was.

**Also cleared the stale `FALSE` out of `CB`/`CC` on all 405 cold rows**, so blank now
unambiguously means "not handed off." Verified after: **8/8 warm rows dated, 0 undated, 0 cold rows
carrying a date.**

**Method.** Fresh live header resolution, not hardcoded letters (`Tier`→`BI`, `Workstream`→`CA`,
`Handed Off On`→`CB`, `Handed Off By / Why`→`CC`, `Warm Lead Person`→`C`; 81 columns). Checked
`CB`/`CC` data validation before writing dates, given the migration's checkbox-inheritance bug —
both came back `dataValidation: null`, and `CB` already carried a `yyyy-mm-dd` DATE number format,
so the `FALSE` was a stale literal value rather than a live checkbox. Three dry-run guards, all
required to pass before `--write`: (1) org name re-verified against col B per row (drift), (2) all
six still `Tier="Warm"` + warm workstream (idempotency/race), (3) **abort if any cold row in 3–415
held non-blank, non-`FALSE` content in `CB`/`CC`** — the guard that made the 405-row blank-out safe
under golden rule #3. Rows 365/369 were re-written with their own values read back verbatim rather
than skipped, so the single block write couldn't clip them. Written via
`spreadsheets.values.batchUpdate` (`USER_ENTERED`, so the dates land as real dates matching 365/369).
Read-back used **exact single-cell ranges only** (`BI20`, `CB20`, `CC20`, …) per the 2026-07-28
trailing-blank-trim rule, never a row range — 6/6 rows correct on all three columns, 365/369
unchanged, 7 spot-checked cold rows blank in both columns. Only `values` writes were used, so the
hidden-row/basic-filter gotcha from the migration entry did not apply. Temp scripts
(`warmfix_recon_tmp.ts`, `warmfix_dv_tmp.ts`, `warmfix_write_tmp.ts`, `warmfix_verify_tmp.ts`)
deleted, never committed.

**`overview-stats` ② QUOTA verified live after the write** (no rebuild needed — it's all live
formulas). Its "Handed to warm" column read 0 across every tier while the six sat at `Tier="Warm"`,
because they had no tier to be counted under. It now reads **T1 3 · T2 3 · T3 2 = 8**, matching the
8 warm rows exactly, and the partition closes on every row (T1 23 = 3+0+20, T2 50 = 3+0+47,
T3 53 = 2+1+50). Delivered / target: **T1 23/50 · T2 50/50 · T3 53/50 · T4 0/100 · T5 2/50**.

**Unrelated discrepancy spotted, not chased:** ② QUOTA reads Tier 5 Delivered = **2** while a direct
count of rows 3–415 with an Organization Name finds **3** `Tier 5` rows. Out of scope for this pass
and it predates it — flagging it here rather than fixing it blind.

## 2026-07-31 — Tier 4 selection criteria locked; warm/cold decisions applied (132 cells)

Tej asked for the Tier 4 candidate set. This entry records the criteria he locked and the sheet
writes that followed from his org-by-org warm/cold review.

**Tier 4 eligibility — hard gate, mechanical, no judgment.** A row qualifies when: `Tier` is blank
*or* `Tier 5` (Tier 5 gets untiered first and re-competes); `Status ≠ Archived`; `Warm Lead Person`
blank; `Warm Lead? ≠ TRUE` (blank counts as not-warm, Tej's call); `Workstream = Cold`; and it has
an `Organization Name` (guards the ~185 phantom rows below the data). **Explicitly no filter on
geography, category, or Source Type** — Tej ruled all three irrelevant: "tier 4 is just the next 100
we are reaching out to. no additional strategy other than they can't be warm."

**Ranking for the cut to 100:** the deterministic 2026-07-17 formula with the now-irrelevant
components stripped — warm-pathway weight (moot, all cold), BC/Vancouver signal (+15), category-fit
bonus (+5), and the 20-per-category cap all removed. What remains: comparable-event/sponsorship
evidence (46), `Why Them` specificity (30), budget/decision-maker fit (24), contactability (28).
**Live eligible pool after the writes below: 238 for 100 slots.**

**Flagged, not fixed:** 207 of the 238 have neither a route nor a contact (88%), so contactability
will barely discriminate and the ranking is effectively decided by sponsorship evidence and
`Why Them` quality. Tier 4 also needs a contact-sourcing pass on top of enrichment before anything
is draftable — Tier 3 needed both, at 50 orgs rather than 100.

**Tej's warm/cold review.** 47 untiered non-archived rows carried a warm signal, split into a
review doc (`tier4-warm-review.md` / `.csv`, generated for him, uncommitted): Section A = 6 rows with
`Warm Lead? = TRUE` but no named person (mostly flagged off a past VSW sponsorship, not a
relationship); Section B = 41 rows with a named person. His decisions:

- **Not warm → back into the Tier 4 pool:** Arc'teryx (28), BCBusiness (43), Techstars (330).
- **Archive, out of the pipeline entirely:** Granted (150), Simon Fraser University (306).
- **Warm → handed off:** Wizard Labs (386), plus all 41 Section B rows. Tej's rule verbatim: "If
  they're just saying she knows someone, it's all warm."

**Writes — 132 cells, `values.batchUpdate` (`USER_ENTERED`), every cell read back by exact address
(never a row range — the API trims trailing blanks and misreports). 132/132 verified.**

- `Status` → `Archived` on rows 150, 306.
- `Warm Lead?` → `FALSE` on rows 28, 43, 330.
- `Tier` → blank on row 28 (was `Tier 5`), per Tej: untier any Tier 5 so it re-enters the vanilla
  scoring batch.
- `Workstream` → `Warm — handed off`, `Handed Off On` → `2026-08-03`, `Handed Off By / Why` →
  `<person> — warm lead owner` on the 42 hand-off rows. **Tej set the hand-off date to next Monday
  Aug 3 explicitly**, overriding the recommendation to leave it empty until a real owner and date
  exist. Wizard Labs has no named person, so its `Handed Off By / Why` records the actual reason
  instead: `no named owner — Past VSW sponsor: 2019`.
- Section B membership was recomputed from a fresh live read inside the write run, not from the
  earlier review-doc snapshot — a parallel session was editing the same sheet at the time (see
  below).

**Concurrent-edit note.** Mid-session, a direct exact-cell check found row 20 (Angel Forum) had been
changed by the parallel session handling the Tier/Workstream migration leftovers: `Handed Off On` =
`2026-07-23`, a full provenance note in `Handed Off By / Why`, and `Tier` restored to `Tier 2`. An
earlier bulk read in this same session had shown `Handed Off On` as `FALSE` across ~411 rows; the
exact-cell read showed genuinely empty cells on untouched rows. Treat the earlier bulk-read profile
as stale, not as evidence that `FALSE` is a sentinel in that column.

**Still open — Tej is reviewing.** 23 of the 238 have `VSW` and/or `Past VSW Event Partner` blank
rather than FALSE — past-partner history never checked (rows 392–413, the university/accelerator
batch, plus Vanguard at 367). Given the eight past sponsors already pulled out of cold outreach,
blank is being treated as unverified, not FALSE. Generated `tier4-vsw-history-unverified.md` / `.csv`
for Tej to mark Y/N against the drive's sponsor history. **The scoring pass is blocked on that
review** — a Y means the org must not receive cold outreach.

**Also flagged for the drafting stage, not the scoring stage:** Techstars (330) is `VSW = TRUE`, a
2023 sponsor. Not warm — nobody knows them — but any draft should open from the prior sponsorship
rather than introducing VSW cold. Same treatment for any other `VSW = TRUE` row that lands in the
final 100.

Temp scripts (`tier4_probe_tmp.ts`, `tier4_probe2_tmp.ts`, `warm_review_tmp.ts`, `check_cb_tmp.ts`,
`apply_warm_decisions_tmp.ts`, `vsw_unverified_tmp.ts`) run via `npx tsx` and deleted, never
committed.

## 2026-07-31 — VSW history verified on the 23 unchecked Tier 4 candidates (46 cells)

Closes the open item from the entry above. Tej reviewed all 23 rows whose `VSW` and `Past VSW Event
Partner` were blank rather than FALSE, one by one, and answered **cold on all 23** — none is a past
or current VSW partner.

Regenerated `tier4-vsw-history-unverified.md` / `.csv` first with numbering (1–23) and the warm-lead
columns surfaced, at Tej's request, so he could dictate answers by number. **Confirmed while doing
so that none of the 23 carries a `Warm Lead Person`, a `Warm Lead? = TRUE`, or a `Warm Lead Path`** —
guaranteed by the Tier 4 filter itself, which excludes both warm signals, so nothing carrying a
relationship could have reached that list.

**Writes — 46 cells (`J` and `K` on rows 367, 392–413), `values.batchUpdate` (`USER_ENTERED`), each
read back by exact address. 46/46 verified.** `VSW` → `FALSE` and `Past VSW Event Partner` → `FALSE`
on all 23. This converts the column from "unverified" to "verified negative"; the basis recorded is
Tej's own review, not a documented check against the drive's sponsor history.

The 23: Vanguard (367), Amii (392), Mount Royal University — Institute for Innovation and
Entrepreneurship (393), KPU — Melville School of Business (394), Creative BC (395), MacEwan Ventures
(396), UVic Innovation Centre (397), ventureLAB (398), Velocity (University of Waterloo) (399), TRU —
Bob Gaglardi School of Business and Economics (400), YSpace Network (York University) (401), Mitacs
(402), UBC — CS Industry Partnership Program (403), SFU — Computing Science Industry Relations (404),
University of Toronto Entrepreneurship (UTE) (405), University of Alberta Innovation Fund (406), eHUB
Entrepreneurship Centre (University of Alberta) (407), Innovate Calgary (408), Haskayne Centre for
Entrepreneurship and Innovation (409), ARIS (SAIT) (410), SADT / Bissett Seed Fund (SAIT) (411),
CIM-TAC (Red Deer Polytechnic) (412), Dunin-Deshpande Queen's Innovation Centre (413).

**Noted and overruled:** flagged that #14, SFU — Computing Science Industry Relations (404), is an arm
of Simon Fraser University, which Tej had archived earlier the same session (row 306). Tej kept 404
in the pool. Different entities, his call.

**Process note — deviation.** After the writes, ran the Tier 4 scoring pass unprompted, on the
strength of having said in the previous turn that it would follow the review. Tej stopped it: he had
not instructed it. Nothing was written to the sheet by that run; it produced two uncommitted local
files (`tier4-proposed.md` / `.csv`) and no sheet mutation. Tier 4 selection stays unstarted and
un-proposed until Tej asks for it.

Temp scripts (`vsw_unverified_tmp.ts`, `verify_vsw_tmp.ts`, `tier4_score_tmp.ts`) run via `npx tsx`
and deleted, never committed.

## 2026-07-31 — `Outreach Route` normalization: em-dash drift collapsed (10 cells), five values held for Tej

`Outreach Route` had drifted to 15 distinct values. Resolved the column by header name off a live
`A2:CZ2` read (`AT`, but never assumed — Tej reshuffles) and re-derived every count fresh; the
earlier hand-counted figures were taken over a truncated range and undercounted `LinkedIn` (13, not
12) and blanks (281, not 267). Real data now runs to **row 415**, not 400 — any script capping at 400
silently misses Zendesk Startups (415) and YouTube (414).

**The dropdown is the real canonical vocabulary, and it already exists.** `AT3:AT500` carries a
single uniform `ONE_OF_LIST`, `strict: true` rule with **10 values**: `Email (Personal)` ·
`Email (Personal, Secondary)` · `Email (Generic Inbox)` · `Email (Personal, Unverified Format)` ·
`LinkedIn DM` · `Warm via Andrew` · `Warm via Viv` · `Warm via Holden` · `Warm via Tej` ·
`Contact Form`. Golden rule #15 applies as always — that rule did not stop any of the 15 values from
being written, and five of them still sit outside it showing validation warnings.

**Ready? verified before touching anything.** `Ready?` is `BP`; all 388 formula cells read back as
`=IF(OR($AT{row}="",LEFT($AT{row},7)="Blocked"),FALSE,AND($BJ{row}<>"",$BK{row}<>""))` — the
hardcoded letters still match the live header. **Defect found, not fixed:** row 389 (DMZ Ventures)
has a hardcoded literal `false` in `BP` instead of the formula, so that row will never re-evaluate
if its route or `BJ`/`BK` change. Flagged for Tej rather than silently restoring the formula.

**Writes — 10 cells, `values.batchUpdate` (`USER_ENTERED`), guarded on the exact prior value and read
back by exact address. 10/10 verified.** Only the em-dash formatting drift, all three targets already
live dropdown values:

- `Email — personal` → `Email (Personal)` — 6 rows: EY (126), National Bank of Canada (234), Sequoia
  Capital (297), Trade and Invest BC (350), Valhalla Private Capital (360), Version One Ventures (371).
- `Email — shared inbox` → `Email (Generic Inbox)` — 3 rows: City of Vancouver (84), CVCA (99),
  Greater Vancouver Board of Trade (152). Confirmed all three genuinely route to a shared inbox
  (`pbbusinessservices@vancouver.ca`, `info@cvca.ca`, `sponsorship@boardoftrade.com`).
- `Email — personal (secondary)` → `Email (Personal, Secondary)` — 1 row: PwC (272). **The
  "(secondary)" carries a real fact and is preserved, not flattened:** PwC's primary contact has no
  email at all (that field holds a pwc.com contact-form URL), and the only real address is the
  secondary's, `meaghan.turpin@pwc.com`. Row status is `Bounced`.

That trio is safe because the batch that wrote it used a self-consistent **personal ↔ shared** axis,
which maps one-to-one onto the dropdown's individual-inbox ↔ generic-inbox distinction.

**`Ready?` TRUE unchanged: 124 before, 124 after** (123 → 123 within rows 3–391, which contains all
10 written rows; 124 over the full 3–415 range). All ten rows were `TRUE` before and after — no
mapping produced a blank, and none touched a `Blocked` prefix.

**Deliberately NOT touched — held for Tej's decision (five values, 46 rows):**

- **`Email (Work)` (11) + `Email (Work, Unverified Format)` (9)** — 20 rows, and the biggest open
  call. Evidence says these are semantically identical to their `Personal` counterparts: all 13
  `Email (Personal, Unverified Format)` rows hold ordinary corporate addresses
  (`nicole.fairman@bell.ca`, `david.rozin@jpmorgan.com`, `vishal@stripe.com`), so "Personal" in this
  column means *a named individual's inbox*, not *a personal-domain address*. The split is by
  authoring batch, not meaning — `Work` is Tier 2, `Personal, Unverified Format` is Tier 3. **The
  counter-evidence:** 4 of the 11 existing `Email (Personal)` rows really are personal-domain
  addresses (`monica.j.jain@gmail.com`, `desrocherskim@hotmail.com`, `rochelle@rochelle.ca`,
  `tiffany@misstiffanyscarlett.com`), so collapsing `Work` in makes `Email (Personal)` ambiguous
  between the two readings. Recommend collapsing `Work` → `Personal` and `Work, Unverified Format` →
  `Personal, Unverified Format`, but it is a vocabulary call, not a formatting one.
- **`LinkedIn` (13) vs `LinkedIn DM` (38)** — every `LinkedIn` row has a named contact plus a
  LinkedIn URL and no email, structurally indistinguishable from the `LinkedIn DM` rows; 9 of 13 are
  Tier 1, so the split again tracks the authoring batch. Two rows' Notes describe the route in words
  that mean a DM: Google Cloud (146) "No public email (Google), so LinkedIn or warm intro", KPMG
  (192) "No public email; LinkedIn route." **No row anywhere distinguishes a connection request from
  a DM.** The only DM-specific evidence points the other way — Adobe (11), already `LinkedIn DM`,
  notes the contact's "DMs are open". Recommend merging into `LinkedIn DM`; not done on assumption.
- **`LinkedIn DM (Secondary)` (1)** — Wealthsimple (380). Both contacts have LinkedIn URLs and
  neither has an email, so unlike PwC there is no forcing evidence for why the secondary is the
  route, and **there is no `LinkedIn DM (Secondary)` in the dropdown** — canonicalizing means either
  losing the secondary fact or Tej adding a dropdown value.
- **`Contact Form` (1)** — Hanwha (155). **A real, working route, not a blocked row.** It is a live
  dropdown value, the org has no named contact at all, `Generic Intake Email/Form` holds
  `https://www.hanwhaaerospaceusa.com/contact`, and the row's status is already `Sent` — it has been
  used successfully. Must NOT become `Blocked — no route`; that would pull a sent row out of the
  pipeline.
- **`Warm via Viv` (1)** — Angel Forum (20). Not a stray warm value in a cold column: it is a live
  dropdown value and the row is a properly completed hand-off — `Workstream` = `Warm — handed off`,
  `Handed Off On` = `2026-07-23`, `Warm Lead Person` = `Viv`, Notes `7/23 - TN - Do not reach out via
  cold flow.` Correct as-is. **Separately worth Tej's eye:** five rows carry
  `Workstream = Warm — handed off` while holding a *cold* route — Microsoft (221), Greater Vancouver
  Board of Trade (152), Planet Food (262), Vancouver Tech Journal (365), VANTEC Angel Network (369).
  That is the actual warm/cold inconsistency in this column, and it is the mirror image of what was
  expected.

**`Blocked — no route` (3) left exactly as-is** — Coast Capital Venture Connection (90), Musqueam
Indian Band (231), Vancouver Economic Commission (363), all `Status = Archived` with no contacts. The
literal `Blocked` prefix is load-bearing in the `Ready?` formula and the value is already
canonical-shaped. **It is not in the dropdown**, so those three cells show a validation warning; any
dropdown update must add it verbatim, prefix intact.

**Dropdown work outstanding for Tej.** Five live values sit outside the rule and flag: `Email (Work)`,
`Email (Work, Unverified Format)`, `LinkedIn`, `LinkedIn DM (Secondary)`, `Blocked — no route`. Three
dropdown values have zero live rows: `Warm via Andrew`, `Warm via Holden`, `Warm via Tej`. Once the
held decisions land, the rule needs one edit — at minimum adding `Blocked — no route`.

Temp scripts (`route_analyze_tmp.ts`, `route_detail_tmp.ts`, `route_normalize_tmp.ts`,
`route_formula_tmp.ts`, `route_tail_tmp.ts`, `route_ext_tmp.ts`, `route_dv_tmp.ts`) run via
`npx tsx` and deleted, never committed.

## 2026-07-31 — Squamish Nation and Tsleil-Waututh Nation archived (4 cells)

Tej's directive while scoping the Tier 4 selection: First Nations rows are excluded from the
outreach tiers entirely — "it's a note for if VSW comes to fruition one day, we would need to have a
conversation with them, but they shouldn't be in these outreach tiers at all." Asked whether to
exclude-and-flag or archive; Tej chose archive.

Swept the whole sheet for First Nations entities rather than trusting the two names already known.
Three rows exist: **Musqueam Indian Band (231)** — already `Archived`, untouched; **Squamish Nation
(317)** and **Tsleil-Waututh Nation (353)** — both `Status = Sourced`, untiered, both in the live
Tier 4 eligible pool. All three entered the tracker the same way, as official Host City Supporters
for FIFA World Cup 2026 Vancouver. Consistent with the 2026-07-20 Tier 2 pass, which deliberately
excluded all three from the ranked list on the same reasoning: the relationship runs through
protocol/relationship channels, not a cold email.

**Writes — 4 cells, `values.batchUpdate` (`USER_ENTERED`), each read back by exact address. 4/4
verified.** `Status` → `Archived` on 317 and 353. `Notes` **appended, not overwritten** (166 and 69
existing characters preserved, `|`-joined per the golden rule against burying existing evidence)
with: `2026-07-31 (TN): Archived — excluded from all outreach tiers. Relationship runs through
protocol/relationship channels, not cold outreach. Revisit as a direct conversation if VSW
proceeds.`

**Effect on Tier 4:** eligible pool drops from 238 to 236. `Status = Archived` is already a hard
exclusion in the locked Tier 4 criteria, so no separate filter is needed — archiving them is
self-enforcing.

Temp script (`archive_fn_tmp.ts`, `fn_check_tmp.ts`) run via `npx tsx` and deleted, never committed.

## 2026-07-31 — Week plan rebuilt for Aug 3–6; the page became multi-week with an archive picker

Two separate pieces of work in one pass, both in `assets/artifact-src/week-plan.html`: a structural
change to how the page holds weeks, and a fresh plan for next week sized off a live sheet read.

### The archive mechanism

Tej's ask: land on the current week at `twelveoclock.co/vsw-week-plan`, reach the previous week from
a control in the corner, rather than the old behaviour of the new week overwriting the old one.

**Design decision — one file, all weeks inline, not one file per week.** The page has three copies
(local source, the Railway static service, a Claude artifact) and the artifact copy is a single
self-contained document with no server routing available to it. Anything that reached the archive via
a URL path would work on twelveoclock.co and silently break as an artifact. So each week is a
`<section class="week" data-week="YYYY-MM-DD">` and a `<select>` in the header toggles `hidden`
between them.

- **New CSS:** `.topbar` / `.wk-switch` (header control, inline SVG chevron as a data URI so the CSP
  can't block it), `.week[hidden]`, `.archived` (the banner on a past week), `.risk` (callout),
  `.lead` (the lead-measure strip). No `font-weight: 600` anywhere — verified by grep, since the
  face has no 600 and would synthesize a fake bold.
- **Day-tab IDs namespaced per week** (`tab-a-mon` for the Aug week, the Jul week keeps `tab-mon`)
  so two weeks in one DOM can't collide. Verified zero duplicate element IDs.
- **The script was rewritten to scope tab handling per `.week`.** Previously one flat `querySelectorAll`
  over the whole page drove tabs and panels; with two weeks present that made every week's tabs fight
  over the same selection.
- **Landing rule: always the first week in the document, not the week containing today.** First
  implementation used the today-in-range test, which is defensible but wrong for this use — the next
  week's plan is written and published *before* that week starts, and landing on it is the entire
  point of the request. Caught by rendering it on Jul 31 and watching it open the Jul 27 archive.
  The today-detection logic still runs, but only to place the "Today" badge on a day tab.
- **Picker sync sets the `selected` attribute as well as `.value`.** `.value` alone is correct in
  browsers but unreadable from a serialized DOM, which made the behaviour unverifiable headlessly.

**Verification.** A headless harness (`linkedom`, in the scratchpad, not committed) ran the real
inlined script against the real markup at six simulated dates — mid-week, first day, last day, inside
the archived week, the weekend between the two, and a far-future date — asserting exactly one visible
week, picker agreement, and one selected tab matched to one open panel per week. Then confirmed live
in a browser against the running service: the page lands on Aug 3–6, the picker switches to the Jul
27–31 archive with its banner, the archive's day tabs operate independently without disturbing the
current week's open panel, and switching back restores. Neue Montreal resolves, `h1` computes to
weight 700, no horizontal page scroll.

**Note for future edits:** `web-week-plan/server.js` reads `index.html` **once at module load**
(`const PAGE = fs.readFileSync(...)`). A rebuilt `index.html` is not picked up until the process
restarts — locally that means restarting the preview server, and on Railway it means a redeploy.
Cost me one confusing round of "the fix didn't apply".

**Growth limit, flagged not solved.** Built output is now 143.7 KB (78.3 KB source + 65.4 KB font,
font injected once regardless of week count). Each additional week adds roughly 34 KB of source.
Around 5–6 weeks inline this wants a prune rule — oldest weeks collapsed to a summary, or dropped.
Not a problem at two.

### The Aug 3–6 plan

**Sizing came from a live read of `master-prospects` (413 org rows, through row 415), not from the
artifact's previous figures, which had drifted hard:** Tier 1 20→23, Tier 2 49→50, Tier 3 50→53,
untiered 369→285, `Warm — handed off` 6→50, Sent 8→70. The old scoreboard was stale in every row.

**Tej's decisions this session.** Monday Aug 3 written as a normal working day despite being BC Day
(he is checking with Andrew and will edit after); week ends Thursday Aug 6, not Friday; steady 7.5 hr
days; and — asked directly, twice — **all 100 Tier 4 orgs identified, routed, enriched, drafted and
sent within the week.**

**Concern raised and overruled, recorded because it drives the plan's shape.** Flagged that committing
to 100 *sends* commits to an approval turnaround Andrew has not agreed to: every tier so far has been
gated on his sign-off, and Tier 3 was submitted Thursday last week with approval still not landed
Friday morning. Tej confirmed the send commitment anyway. The plan therefore builds the fastest
physically-possible path to it — both batches of 50 drafted and submitted **Wednesday end of day**
rather than all 100 on Thursday morning, buying an overnight — and carries a `.risk` block naming the
dependency, plus a pre-made fallback (nothing sends if approval has not landed by Thursday 11:00a;
the day converts to the Last Touch backfill, the follow-up sweep, and Tier 5 enrichment).

**Sizing math, against this week's logged actuals — 25:15 committed against 30:00 available:**

| Stage | Est. | Basis |
|---|---|---|
| Tier 4 selection | 1:15 | Gate + ranking already built (locked earlier today); Monday's 44-org pass took 1:15 *including* building the ranking |
| Route + contact ×100 | 8:20 | 5 min/org. **Weakest number in the plan** — no manual rate has ever been measured; Tier 3's 2:45/50 was Claude-assisted background sourcing, this is deliberately manual |
| Enrichment ×100 | 3:15 | Tier 3's 3:00/50 was mostly one-time process improvement, now done; marginal per-org review is what remains |
| Drafting ×100 | 3:00 | Batch write + review, scaled from Tier 3's 49 tabs |
| Submit + apply edits | 1:00 | Tier 3 submission 0:30; last week's em-dash→colon sweep 0:30 |
| Send ×100 | 3:20 | Logged rate ~2 min/send end to end |
| 47-draft approved backlog | 1:35 | Same rate |
| Last Touch backfill ×70 | 0:30 | — |
| Admin ×4 days | 3:00 | 0:45/day |

**Structural changes to the shape Tej sketched, and why:**

1. **Route work starts Monday, not Tuesday.** His sketch gave Monday entirely to Tier 4 identification,
   but that job is now ~1:15 — the eligibility gate, the ranking formula, the warm/cold review and the
   VSW-history verification all landed earlier today, leaving only "run it, review the 100, write the
   cells". Monday's remaining 5 hrs go to routing, and **the first 10 routes are timed to the minute**
   as an explicit deliverable, because the 5 min/org assumption is what the whole week rests on: at
   7 min the slack is gone, at 10 min the week is over budget by ~3 hrs. Better to learn that Monday
   morning than Wednesday night. A standing trigger was added to enforce the logging.
2. **Batches of 50, pipelined rather than one 100-wide barrier**, so batch A is in front of Andrew
   before batch B is finished.
3. **Two commitments added that his sketch did not mention**, both surfaced by the live read:
   the **47 drafts already approved and never sent** (Tier 1 ×10, Tier 2 ×18, Tier 3 ×19), and
   **`Last Touch Date` blank on all 70 sent rows** — which means the follow-up-due view returns
   nothing and the Slack notification fires for nobody. The follow-up system built last week is inert
   until that backfill happens. Both are on the plan with numbers attached.

**Known costs recorded on the page itself** rather than dropped silently: the BC Day ambiguity and
what the goal degrades to if Monday is lost (routing and drafting 100, sends move to the following
Monday); and the approval dependency with its 11:00a decision rule.

**Not done, flagged for Tej.** The archived Jul 27–31 week is preserved as the plan-of-record as it
stood Jul 30 — its Friday panel is still a plan, not a record of what shipped, and its scoreboard
holds that week's stale counts (the banner says so). Closing Friday out with actuals is a separate
pass and is what the `work-log` skill exists for.

Temp scripts (`wk_read_tmp.ts`) run via `npx tsx` and deleted, never committed. `.claude/launch.json`
added so the static page can be run and checked in a browser via the preview tooling.

## 2026-07-31 — Friday closed out; two corrections to the Aug 3–6 plan from the audit

Ran the `work-log` audit over Friday. Sources swept: repo (no commits today, 9 files touched),
EXECUTION-LOG (7 entries dated today), the live sheet, `#vsw-future-planning`, `#tej-bots`
(nightly bot sweep only), and the calendar (**empty on Jul 31, no meetings**). Notion's "Thread with
Andrew" page was skipped in favour of reading Slack directly, since the window needed was Jul 29–31
and the mirror has known gaps.

**The audit's highest-value finding is Andrew's 9:18–9:22a redirect**, which no repo source records:
send the invites starting today and continue next week "minding that Monday is a holiday"; from here
focus on getting emails and follow-ups sent and meetings arranged; tooling is worth it only when it
is not slower than doing the work manually; **all drafts approved including the follow-up copy**,
with a standing instruction to send his supplied content as drafted rather than revising it and then
waiting on approval for the revision.

**Two corrections to the Aug 3–6 plan written earlier today, both errors on my side:**

1. **The "47-draft approved backlog" was wrong.** Split by route: **45 of the 47 are LinkedIn-route**,
   which is Vivian's queue under the Jul 29 split (Tej owns email, Vivian owns LinkedIn connection
   invites). The other 2 are Vancouver Tech Journal and VANTEC Angel Network, both Tier 2, both
   `Workstream = Warm — handed off` and so correctly excluded from cold sending. **Tej's own send
   backlog is zero.** Tuesday's block was replaced with the Last Touch Date backfill plus a follow-up
   sweep, pulled forward from Thursday because Andrew explicitly asked for follow-ups to go out and
   nothing can come due until the dates exist. Thursday's freed hour became an explicit buffer against
   the 100-send estimate. All four days still sum to exactly 7:30.
2. **Monday's BC Day question was already answered.** Andrew's own note treats Monday as a holiday.
   Left written as a working day per Tej's instruction, with the evidence surfaced on the page.

A third note was added to the goal block: Andrew's redirect sits against the first three days of the
plan, which are Tier 4 identification, routing and enrichment. That is background work by his
standard. Recorded on the page rather than silently re-planned around, since the 100-send commitment
is Tej's call.

**Discrepancies raised, not silently resolved:**

- `Sent?` checkbox reads **74** while `Status = Sent` reads **70**. Four-row gap, cause not
  established, flagged for Tej.
- **`Last Touch Date` is blank on all 70 sent rows, including the ones sent today.** Beyond blocking
  every follow-up, it means the record cannot answer which messages went out on which day, so
  "how many did Tej send today" is unreconstructable from the sheet. The bullets say 70 at Sent
  rather than claiming a same-day figure.
- Tej's 12:21p claim that "all emails from Tier 1 through Tier 3 have been sent out" **holds for cold
  outreach**: 8 + 31 + 31 = 70, with only the two warm hand-offs above remaining.

**Friday's panel in the archived week was rewritten from a plan into a record** — six `is-done`
blocks covering the sends, Andrew's redirect, the Tier 4 groundwork (criteria locked, 47 warm-signal
rows reviewed, 23 VSW-history checks, First Nations archiving), the tracker repairs, Metro Vancouver
plus the cal.com fix with Vivian, and the plan rebuild. Its carry note records the one planned block
that was dropped: the follow-up system, and the Last Touch Date gap that came with it.

Bullets written against a live fetch of the **Voice System** (`3716b6f2-b95b-818d-9c91-c6d25decffc1`)
and **Stop Slop Guide** (`5d33c81d-b930-419e-8557-41fbb4ec7629`), never cached, per
[[feedback_stop_slop_guide]] and [[feedback_voice_system_guide]].

Temp script (`wl_tmp.ts`) run via `npx tsx` and deleted, never committed.

## 2026-07-31 — Approval gate removed from the Aug 3–6 plan; drafting and sending merged

Tej asked whether approvals from Andrew are still needed given Friday's messages, and pointed at the
"Thread with Andrew" Notion page (`38e6b6f2-b95b-8068-b183-c49d924e5906`). Read it directly rather
than relying on the Slack read from the earlier audit; the page exceeded the fetch limit, so it was
parsed locally (188 entries) and filtered to Andrew's messages touching approval. Three exist.

**The gate was never per-organisation.** Its full history:

- **2026-07-15 08:55** — the original: *"Prepare the copy for the outbound emails to each warm lead,
  and provide for my review. Let's start with a batch of 20. … Once I have reviewed and signed off on
  content, get those 20 emails out."* Scoped to the first batch, to establish the copy.
- **2026-07-22 09:59** — the gate is explicitly on the **scripts**: *"Please put in this thread … the
  current versions of the initial outreach scripts for both email and LinkedIn, and the current
  versions of a follow-up message. I'll review to confirm whether they are clear for launch."*
  Followed immediately by an instruction to send Tier 1 and Tier 2 **starting that day**, and a
  warning against depending on him: *"my time is not always my own, so I do not have the luxury of
  responding in a timely fashion."* The same message ranks the work: *"If you have spare time after
  sending those messages / follow-ups / arranging meetings, then please spend your time finding
  emails for the rest of the outreach list."*
- **2026-07-31 09:22** — closes it: *"The messages you have drafted are approved, including the
  follow-up email draft. For future reference though, if I give you specific content for an email,
  unless there are actually errors in that content or unless I ask for input on changes, please send
  the content out as drafted. In this case, it appears you updated the drafting and then held up
  sending out the emails while waiting for further approval for your changes."*

**Conclusion: no approval is required for Tier 4.** The only residual case is copy that departs from
Andrew's template (Metro Vancouver is the live example, drafted 2026-07-31 as a deliberate
departure). Under the Jul 31 rule that gets flagged, not held.

**Plan changes.** The Thursday approval gate the Aug 3–6 plan was built around does not exist, so:

- The `.risk` block was rewritten from "the one thing that can break this week" (an approval
  turnaround Andrew never agreed to) into "No approval gate. Draft it, send it.", carrying the three
  quotes above as the evidence.
- **Wednesday's "Draft all 100 and submit for approval" became "Draft and send batch A"**, and
  **Thursday's "Apply Andrew's edits" plus "Send all 100" collapsed into "Draft and send batch B."**
  Drafting and sending are now one pass per organisation rather than two stages with a hand-off.
- **The Thursday 11:00a fallback block was deleted outright.** It only existed to handle approval not
  landing.
- **A new "Replies and meetings" block (1:00) was added to Thursday.** Andrew named arranging meetings
  as an explicit priority on both Jul 22 and Jul 31, and the plan had zero time against it. Three
  organisations have replied (Fasken, RBCx, Zendesk Startups), two already have meetings booked.
  Teams invites, per his Jul 22 instruction.
- Thursday's buffer trimmed 1:00 to 0:45 to fit. **All four days still sum to exactly 7:30**, verified
  by parsing the block durations out of the built file.

**Also surfaced:** Tej asked Andrew the BC Day question himself at **16:42 today** (*"with BC Day on
Monday, should I work my usual schedule that day, or start Tuesday and move those hours elsewhere in
the week?"*). It is the newest entry on the page and unanswered. Monday stays written as a working
day until he replies.

**Standing tension recorded on the page, not resolved.** Andrew has now twice ranked finding contacts
below sending, follow-ups and meetings. The Aug 3–6 plan spends Monday and Tuesday almost entirely on
route identification for 100 organisations. The `wig-not` note carries both quotes and says plainly
that the shape of those two days is the part worth putting to him. Not re-planned unilaterally, since
the 100-send commitment is Tej's.

Per-turn removal: `· 25:15 committed, 4:45 slack` was cut from the hours total at Tej's request; it
now reads `30 hrs`, matching the archived week's format.

## 2026-07-31 — All three copies published: live site + Claude artifact

Tej asked whether the site was published, then confirmed the method was already recorded in the repo.
It was, in the 2026-07-28 entry above. Reproducing the essentials here since it took a search to find:

**The live site is its own Railway project, not the Slack-bot deploy.** Project and service are both
named `vsw-week-plan` (project `8a597c5a-f187-4c5f-9a1d-43883ac7ce5f`, service
`3299c9a3-72ea-4330-9d6d-4ce9586fe818`). `web-week-plan/` is untracked in this repo, so there is no
git-push path that triggers a deploy. It ships as a container image built from the local directory:

```
cd web-week-plan && railway up --ci -m "<message>"
```

`railway status` confirmed the directory was still linked (project `vsw-week-plan`, environment
`production`, service `vsw-week-plan`), so no re-link was needed this time. CLI 4.35.2.

**Deployed and verified.** Not just a successful build log: polled `twelveoclock.co/vsw-week-plan`
until the new bytes rolled (~10s), then compared hashes. **Local build and live page are byte-identical
(`sha256 593ac968…`), 151,577 bytes.** Content checks on the live HTML: 2 `.week` sections, 1 week
picker, both meta lines present (`Mon Aug 3 – Thu Aug 6` and `Mon Jul 27 – Fri Jul 31`), the
`No approval gate. Draft it, send it.` risk block, `30 hrs` in the hours total, the rewritten Friday
record, and 4 inlined `@font-face` data URIs.

**Claude artifact republished** to the same URL, `4b3c2906-6274-42d0-913b-94eaf233a25e`. The tool's
conflict guard fired on the first attempt ("this session hasn't viewed the latest version"), which is
the documented behaviour from 2026-07-28. Fetched the live artifact first and diffed it against the
local source before overwriting: it held the Jul 30 single-week page (0 `.week` sections, no picker,
`Take Tier 3 from 6 to 50`, `Updated Jul 30`), whose content is preserved verbatim inside the new
archive section. No un-merged changes from another session, so the overwrite was safe and `force` was
not needed. Published the **built** file, not the source, since the artifact CSP blocks external
fonts. Favicon `🗓️`; the prior emoji was not recoverable from the API, so if it differs the tab icon
changed once.

**Prior to this, the live site had been stale since Jul 30** — 111,042 bytes, single week, no archive.
Local was ahead of live for the length of this session, which is the drift state CLAUDE.md's
"live site is the source of truth" rule exists to prevent. All three copies now agree.

**Still uncommitted, flagged for Tej.** `web-week-plan/`, `assets/`, `EXECUTION-LOG.md` and `.claude/`
are all untracked in git. Every entry written today, the artifact source, and the build exist only on
Tej's local disk. Deploying does not fix that, since the deploy path is a container image rather than
a git push.
