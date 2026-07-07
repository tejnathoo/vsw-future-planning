# PRD — VSW Slack Intake Service

**Status:** Ready to build · **Owner:** Tej Nathoo (tz America/Vancouver)
**Repo:** https://github.com/tejnathoo/vsw-future-planning
**Last updated:** 2026-07-03

> This is a *living document*. Any decision or deviation made while building is written back here and logged in [PLAN.md](PLAN.md) → Execution Log.

---

## 1. Summary

A small always-on service (Node/TypeScript on Railway) that adds a **Slack front door** to the existing VSW Sponsor Sourcing pipeline. A user @mentions a bot in Slack with a **URL, a CSV, a PDF, an image of sponsor logos, or a Markdown/text file**, and the service turns it into deduped, review-ready prospect rows in the shared Google Sheet `data-staging` tab.

**Trigger rule (locked 2026-07-03):** the bot ONLY acts on an explicit **@mention** — for every input type, including file uploads. A file dropped in the channel without a mention is ignored. This is one consistent rule across all 5 paths, chosen over Slack's default `file_shared`-without-mention behavior to avoid accidentally processing files that weren't meant for the bot.

This is **additive**. It does **not** replace the existing n8n pipeline (`vsw-dispatcher` + `vsw-scraper`), which stays live as the engine for URL / Source-Queue scraping.

### Source-of-truth documents (Notion)
- **Build Brief — Slack Intake Service** (this project's spec): `f106a46762d14d7eb5f039dc7cf25f1a`
- **Feature Brief — Staging → Master Promotion** (§10 of this doc): `6438a38dcd2644f3806d13162c3c2c48`
- **Build Spec — VSW Sponsor Sourcing Pipeline** (schemas §5, extraction §6, dedup §7, Slack §8): `82a3d52821f9494e81816eab1e91817a`
- **Phase 4 Build Guide — n8n vsw-scraper** (battle-tested dedup code + bug classes): `6476139d55fe4bd0b4de7fc6097a9f67`
- **VSW Future Planning** (project hub, related meetings/tasks/contacts): `3886b6f2b95b80e7aa38ca1298a768ed`

If this PRD and the Notion Build Brief ever disagree, the **Notion Build Brief wins** — update this doc to match.

---

## 2. Goals / Non-goals

### Goals
- One Slack action (mention + link/CSV/image) produces deduped prospect rows with minimal human effort.
- Reuse everything already built: the `data-staging` schema, the dedup/merge contract, the classification contract, and every existing credential.
- Keep `data-staging` clean when there are now **two writers** (n8n + this service) — both use the identical dedup contract and read fresh Staging immediately before writing.

### Non-goals
- **No URL scraping in this service.** URLs are forwarded to n8n's existing webhook; n8n owns Firecrawl/Stagehand/extract/dedup/write for that path.
- Not decommissioning n8n.
- **No writing to the Master tab (`master-prospects`) — except via the two sanctioned, structurally-scoped features: Promotion (§10/§11) and contact attribution (§13).** Outside those, this rule is absolute.
- No contact *sourcing* (the service never goes looking for a name/email as its own research task — AGENTS.md golden rule #2) — the `data-staging` `Contact` column (K) stays blank, human-owned, always. This is separate from §13's contact-*attribution* feature, which writes master-prospects' own Primary/Secondary Contact columns (N-T) directly, but only when Tej explicitly provides the contact via Slack — never inferred/researched.
- No LinkedIn / auth-gated / personal-email scraping.

---

## 3. Users & primary flow

**User:** Tej (and teammates) in the VSW Slack workspace, channel `#tej-bots` (`C0BEUTEDAF4`).

**Flow:** @mention the bot with one of:
1. a **URL/website** in the message text,
2. a **CSV file** attached (e.g. Viv's sponsor-history CSV),
3. an **image** of sponsor logos (e.g. a sponsor wall / partner grid),
4. a **PDF** (e.g. a sponsor deck / prospectus / event program),
5. a **Markdown or plain-text file** (e.g. a pasted/typed list of org names).

The bot acks fast, does the work async, and replies **in the same thread** with a summary.

---

## 4. Functional requirements — the three intake paths

### 4.1 URL path (forward to n8n — the service does NOT scrape)
- Detect an `http(s)://` URL in the mention text.
- `POST` to `N8N_SCRAPE_URL_WEBHOOK` with body `{"urls":[...], "note":"via Slack — <user>, <ISO date America/Vancouver>"}`. Multiple URLs → all in the `urls[]` array.
- Reply immediately in-thread: *"🔗 Sent to the scraper — new/merged rows will land in data-staging and the Source Queue; watch #tej-bots for the run summary."*
- n8n auto-creates the Source Queue row and posts its own per-source notice (unchanged). This service writes **nothing** to the sheet for URLs.

### 4.2 CSV path (handled end-to-end in this service)
- Download the file via Slack `files.info` → `url_private` **with `Authorization: Bearer <BotToken>`** (anonymous fetch 404s).
- No LLM extraction needed — the CSV already names the orgs. Map columns → `items[]`.
- **Viv-CSV shape** (org name + free-text note + one boolean column per year):
  - `organization` = trimmed name column.
  - `warm_lead` = built from TRUE year columns, e.g. `"Past VSW sponsor: 2019, 2023, 2026"`.
  - `why_them` = ≤20 words citing years + any cash/VIK note; prefix known upgrade candidates with `"⭐ Upgrade candidate — "`.
  - `Category` comes from the corrected enum (§6), **not** from cash/VIK — cash/VIK belongs in `why_them`/`warm_lead`.
  - `Source = "Viv sponsor CSV"`, `Tier = "1"`, `Source URL = internal://viv-sponsor-csv` (stable non-http audit id; works with the dedup idempotency guard).
- **General (non-Viv) CSVs:** heuristically detect an org-name column, or **ask in-thread** to confirm which column is the org name before importing. Default `Tier = "—"`.
- Then: classify (§6) → dedup/merge (§7) → write `data-staging` → threaded reply (§7 of Build Brief reply template, Engine label `CSV import`).

### 4.3 Image path (vision → org names, handled end-to-end)
- Download the image (same Bearer-token method).
- **Vision = Google Gemini** (decision 2026-07-03). One call: *"Identify every distinct company/organisation logo visible… Return STRICT JSON `{items:[{organization, evidence}]}`. Only include orgs identifiable with reasonable confidence; skip illegible/generic marks."*
- **Post-check:** there's no page text to substring-check against, so treat vision extractions as lower-confidence — set `Duplicate? = "Review"` for any **brand-new** org (not matched in Staging/Master) from this engine, so a human eyeballs logo-only extractions. Orgs it already recognizes still merge normally.
- Optional enhancement (see AGENTS.md §Vision): resolve each org name → website/domain (Gemini Search grounding or Firecrawl) so domain-based dedup can fire.
- `Source = "Screenshot via Slack (<user>, <date>)"`, `Source URL =` the Slack file permalink (a real dereferenceable URL).
- Then: classify → dedup/merge → write → threaded reply (Engine label `Vision`).

### 4.4 PDF path (Gemini document understanding, handled end-to-end)
- Download the PDF (same Bearer-token method). For large files, upload via Gemini's **File API** before the model call (respect the model's page/size limits; note the limit in Run Notes and warn in-thread if truncated).
- **Vision/document = Google Gemini.** One call over the PDF (Gemini reads both the text and any embedded logos): *"Identify every distinct company/organisation named or shown as a logo in this document… Return STRICT JSON `{items:[{organization, evidence}]}`. Only include orgs identifiable with reasonable confidence; skip generic mentions."*
- **Post-check:** sponsor-deck PDFs mix reliable text names with logo-only pages, so treat like the image path — any **brand-new** org (not matched in Staging/Master) defaults to `Duplicate? = "Review"`. (Whether clearly text-based PDFs can skip Review is folded into Open Question #2.)
- `Source = "PDF via Slack (<user>, <date>)"`, `Source URL =` the Slack file permalink.
- Then: classify → dedup/merge → write → threaded reply (Engine label `PDF`).

### 4.5 Markdown / plain-text path (Anthropic text extraction, handled end-to-end)
- Download the file (same Bearer-token method); read as UTF-8 text.
- **Provider: Anthropic** (not Gemini) — this is a text task, not a vision task. Gemini stays scoped to genuinely visual work (image/PDF).
- One call: *"Extract every distinct company/organisation name mentioned in this document. Return STRICT JSON `{items:[{organization, evidence}]}`. Only include organisations, not people."*
- **Post-check (D12 applies — unlike vision/PDF):** because we have the full source text, run the same anti-hallucination substring check the URL/CSV paths use — drop any extracted org name that isn't actually a substring of the file's text, count drops. Since this check applies, brand-new orgs do **not** need the forced `Review` treatment vision/PDF get — treat like the CSV path.
- `Source = "Markdown/Text via Slack (<user>, <date>)"`, `Source URL =` the Slack file permalink.
- Then: classify → dedup/merge → write → threaded reply (Engine label `Text`).

### 4.6 Routing
On `app_mention` (file uploads are only processed if attached to a message that @mentions the bot — see the trigger rule above; `file_shared` alone is ignored):
1. ACK within 3s; do real work async.
2. `files[]` present → `text/csv`/`*.csv` → CSV engine; `application/pdf`/`*.pdf` → PDF engine; `image/*` → Vision engine; `text/markdown`/`text/plain`/`*.md`/`*.txt` → Text engine.
3. No file but a URL in text → URL forwarder.
4. Neither → reply asking for a link/CSV/PDF/image/text file; stop.
5. Always reply in the same `thread_ts` (no cross-talk between concurrent mentions).

---

## 5. Data contract — `data-staging` (columns A–R, exact order)

| Col | Field | Notes |
|-----|-------|-------|
| A | Organization | display casing |
| B | Org Key | normalized dedup key (see §7 in AGENTS.md) |
| C | Domain | eTLD+1 if found, else blank |
| D | Category | **corrected enum** (§6) |
| E | Sector | short label |
| F | Source | first-seen human-readable label; **never edited on merge** |
| G | Source URL | audit trail; on merge append with `" | "` |
| H | Tier | `1`–`10` or `—` |
| I | Why Them | ≤20 words, grounded; on merge, gets `" (Nth: <source label>)"` appended (AGENTS.md §Dedup) |
| J | Warm Lead | usually filled for CSV, blank otherwise |
| K | Contact | **ALWAYS BLANK** (human-owned, D3) |
| L | Duplicate? | `""` \| `Review` \| `In Master` |
| M | Matched Org | existing row's Organization when Duplicate? set |
| N | Times Seen | int; starts 1; +1 per merged source |
| O | Run ID | `YYYYMMDD-HHmm-<source-slug>` |
| P | Scraped At | ISO datetime, America/Vancouver |
| Q | Extractor | `CSV import` \| `Vision` \| `PDF` \| `Text` (for this service) |
| R | Review Status | `New` (human-edited thereafter) |

**Hard rules:** Contact always blank · never write `master-prospects` · never drop a duplicate silently · on merge touch only columns **G / I / N / P** (I gets an appended note, not a rewrite).

---

## 6. Classification contract (corrected enum — use from day one)

`Category` enum (matches the real `master-prospects` dropdown):
```
[Tech, Bank, Law firm, Gov, Crown corp, Accelerator, VC, BIA, University,
 Media, Consumer brand, Real estate, Recruiting, Finance,
 Professional services, Defense & aerospace]
```
- Do **not** use the old §6 example list (Sponsor/Funder/Investor/…). It does not match the real dropdown.
- `Sector` = short label (Cleantech, SaaS, Legal, Banking, Life Sciences…).
- `Why Them` = ≤20 words, grounded in evidence.
- **Provider:** Anthropic (kept as classification provider so rows match n8n's output).

---

## 7. Success criteria (verification gates — see PLAN.md §Gates)

- URL mention → n8n Source Queue row created + `data-staging` row via the existing scraper; service writes nothing; thread reply confirms hand-off.
- CSV (Viv's) → orgs processed; **"New Ventures BC" must MERGE** (it's already in Staging from a Tier-3 scrape) — a live cross-writer dedup proof.
- Vision → real sponsor-wall screenshot returns plausible orgs, flagged `Review`, no confident hallucinations.
- Cross-path dedup: org added via CSV (service) then found via URL scrape (n8n) → ONE row, Times Seen 2, two Source URLs.
- File download works only with the Bearer header (anonymous fetch 404s).
- Concurrent mentions reply in the correct threads.

---

## 8. Open questions (resolve with Tej before the affected run — don't guess)

1. ~~**Tier-5 "Grant" category conflict**~~ — **RESOLVED 2026-07-03.** `Grant` is not in the real 16-value enum (confirmed live via the `master-prospects` Category dropdown, `strict: true` — anything outside the list is rejected). Tier-5 rows use a real enum value chosen per-source (typically `Gov` for government-run grant/funding programs like PacifiCan), and `Why Them` is prefixed `"Grant: "` (plain colon, no emoji, no em-dash) so grant rows stay filterable via text search without violating the dropdown. Example: `"Grant: PacifiCan Strategic Response Fund, federal funding for BC tech events."` Align n8n to the same convention if it still forces `Category = "Grant"`.
2. **Vision/PDF confidence bar:** is "flag every new logo-sourced org as Review" right, or should a single big clear sponsor banner (image) / clearly text-based PDF skip Review?
3. **Concurrency / double-write:** read-fresh + shared idempotency guard for v1, or a single-writer lock between n8n and this service from day one?
4. **General (non-Viv) CSVs:** auto-detect the org-name column, or always confirm in-thread?

---

## 9. Dependencies the human must provide (see AGENTS.md §Setup)

- A **Slack App** with a bot user + tokens (the current setup is an outbound incoming-webhook only).
- **Google** credential (service account recommended) with edit access to the sheet.
- **Gemini** API key (vision + PDF document understanding — same key covers both; large PDFs use Gemini's File API, no extra key) and **Anthropic** API key (classification).
- **Notion** integration token is only needed if this service reads/writes Notion (it currently does not — URL audit trail lives in n8n's Source Queue).

---

## 10. Feature: Staging → Master Promotion

**Notion Feature Brief:** `6438a38dcd2644f3806d13162c3c2c48` (child page of the same VSW Sponsor Sourcing Pipeline HQ as the main Build Brief). Not a full spec — a tight feature addition on top of everything in §1–9. If this section and the Notion brief ever disagree, **the Notion brief wins** — update this section to match. Source-of-truth schemas/dedup still live in the Build Spec (`82a3d52821f9494e81816eab1e91817a`, §5.1 data-staging) and this PRD's own §5/AGENTS.md §Dedup — this feature only *adds* a promotion path and Master-side aggregation; it does not change the intake paths in §4.

### 10.1 Why
`data-staging` is past 700 rows. The manual step (copy + reformat each approved row into `master-prospects` by hand) doesn't scale. The human approval checkpoint stays (D2/D9 — never auto-write Master without a human decision per row); everything **after** that decision — schema mapping, formatting, the write itself, and duplicate aggregation — gets automated.

### 10.2 Trigger (human gate stays, friction drops)
- **Human action:** in `data-staging`, set `Review Status = "Approved"` on rows ready to go (bulk-select; existing dropdown, no new UI).
- **Two ways a run fires:**
  1. **On-demand:** @mention the bot with `promote` (e.g. `@bot promote`). This fits the existing `app_mention` router as a new recognized command — **no new Slack scopes or slash-command registration needed.**
  2. **Safety net:** a scheduled nightly sweep runs the same job automatically, so nothing Approved sits forgotten if no one triggers it manually.
- **Run behavior:** read all `data-staging` rows where `Review Status == "Approved"` → process each per §10.3/§10.4 → on success, flip that row's `Review Status` to `"Merged-to-Master"` (existing enum value, no new one needed) → reply in Slack with a batch summary (added / merged-into-existing / failed counts + Sheet link — same style as the existing intake-path replies).
- **Never promote:** rows where `Review Status` is anything other than `"Approved"` (i.e. never touch `New`, `Rejected`, or already-`Merged-to-Master` rows).

### 10.3 Two promotion paths
- **Path A — net new:** Staging row's `Duplicate?` is blank (or Tej already resolved it to not-a-dup) → §10.5 append one new `master-prospects` row.
- **Path B — existing duplicate:** `Duplicate?` = `"In Master"` (or `"Review"` that Tej confirmed is the same org) → §10.4 append onto the matched existing Master row instead of creating a new one.
- **Match key:** Org Key only — `master-prospects` has no Domain column. Match Staging's Org Key against Master's `Organization Name` using the same variant-tolerant `sameOrg()` matcher already ported in [dedup.ts](src/dedup.ts). **Do not re-derive a new matcher.**

### 10.4 Path B — the aggregation logic (the new part)
1. Find the matching `master-prospects` row via the §10.3 match key.
2. Append onto that row's existing `Why Them` cell: if the Staging row's Why Them text isn't already a substring, append `" | " + newText`.
3. Append onto that row's existing `Source Link` cell: if the Staging row's Source URL isn't already present in the pipe-split list, append `" | " + newUrl`.
4. Touch **nothing else** on that Master row — contact/outreach/funding/Stage-tracking columns stay exactly as a human left them, new or duplicate.
5. **Idempotency:** before appending, split the existing cell on `" | "` and skip the append if the value is already present — safe to re-run.
6. On success, flip the Staging row's `Review Status` to `"Merged-to-Master"` (same as Path A).

### 10.5 Column mapping — `data-staging` → `master-prospects`

| master-prospects column | from data-staging | rule |
|---|---|---|
| Prospect ID | — | leave blank; no generation scheme defined yet (§10.6 Q1) |
| Organization Name | Organization | direct copy |
| Category | Category | direct copy — Staging already classifies against the corrected enum (PRD §6) |
| Subsector | Sector | direct copy |
| HQ / Geography | — | leave blank; not captured by the scraper today |
| Why Them | Why Them | direct copy (Path A); Path B appends — §10.4 |
| Potential Mutual Value | — | leave blank; human-drafted at outreach time |
| Programming Angle | — | leave blank; human-drafted at outreach time |
| Source Type | Source (col F) | **classified from the actual Source label by an LLM (Claude Sonnet 5), not a hardcoded keyword table** (Tej, 2026-07-04 — a dry run against real Approved rows showed hand-written keyword matching throws on almost everything real; see §10.6 Q3 for the full design) |
| Source Link | Source URL | direct copy (Path A); Path B appends — §10.4 |
| Warm Lead? (Y/N/Unknown) | Warm Lead | `"Y"` if Warm Lead is non-empty, else `"Unknown"` (never assume `"N"`) |
| Warm Lead Person | — | leave blank; Staging never captures a person name |
| Warm Lead Path | Warm Lead | copy the free-text rationale (closest fit for Staging's one Warm Lead field) |
| Primary/Secondary Contact Name, Title, Email, LinkedIn URL, Secondary LinkedIn, Generic Intake Email | — | always leave blank on Path A/B promotion — human-owned (D3); the ONE exception is the contact-attribution feature (§13), which writes these columns directly via `updateMasterContactFields`, never through `append_master_row`/`update_master_aggregate_row` |
| Stage | — | leave blank; no `Stage` dropdown exists yet — outreach pipeline isn't designed (§10.6 Q2, resolved) |
| Last Touch Date, Last Touch Channel, Next Step, Next Follow-up Date, Owner | — | leave blank; human fills in once a prospect enters active work |
| Funding Type, Estimated Capacity, Target Ask Range, Exclusivity Play? (Y/N/Unknown), Budget Window | — | leave blank; not collected by the scraper |
| Notes | — | write a traceability line: `Promoted from data-staging · Tier {Tier} · {Extractor} · Run {Run ID} · {Scraped At}` |

### 10.6 Open questions

- **Q1 — Prospect ID: RESOLVED (Tej, 2026-07-04).** Leave blank. No generation scheme — matches the existing convention on every current Master row.
- **Q2 — Stage default: RESOLVED (Tej, 2026-07-04).** There is no `Stage` dropdown yet — the outreach pipeline itself hasn't been designed. Leave `Stage` blank on every promoted row (no default to pick); revisit once outreach stages exist.
- **Q3 — Source Type mapping: RESOLVED, redesigned (Tej, 2026-07-04, after a live dry run against real Approved rows).** Not a Tier→label lookup (rejected first — Tiers 6–10 are too mixed to bucket by number alone). The next attempt — a hardcoded keyword-matching table (`.includes("viv")`, `.includes("comparable event")`, etc.) — was built, then dry-run tested against 4 real Approved rows and **failed on 2 of them** (`"Startup TNT Summit"`, a real Tier-2 comparable-event source, and `"VSW_Future_Planning_-_Past_Sponsors_csv.csv"`, literally Viv's own CSV filename — neither contains the literal keywords the table was matching on). Confirmed this would fail on most of the ~850 real Staging rows; keyword matching can't generalize over free-text human-authored Source labels. **Final design:**
  1. **Classification is an LLM call (Claude Sonnet 5, not Opus — this is simple categorization, and Opus is already flagged elsewhere as too slow for this kind of task), batched ~12-15 distinct Source strings per call** (not one call per row — most of the ~850 Staging rows likely share a much smaller set of distinct Source strings). Given Tier + Organization as extra context (Tier isn't used by any hardcoded rule, just handed to the model as a signal). Same JSON-in/JSON-out + code-side validation posture as `classify.ts`.
  2. **A persistent Source→Source Type mapping cache (a JSON file in the repo)** — before calling the LLM, check the cache for an already-decided mapping; only classify genuinely new Source strings. This is both an efficiency win (fewer calls, since Source strings repeat heavily across rows) and a consistency win (the same Source string always gets the same answer across runs, rather than the model re-deciding fresh every time).
  3. **The LLM may propose Source Type values beyond the current live set** (Tej's call) — but **critically, a proposed value is never written to Master unless it's already confirmed-live in the sheet's actual dropdown.** This matters because of a safety discovery made the same day (AGENTS.md golden rule #15): Google Sheets' `strict: true` dropdown validation does **not** protect API writes, only manual typing in the UI — so the code, not the sheet, is the only thing standing between a bad value and production data. Any row whose Source Type comes back as "proposed-new" (not yet on the confirmed-live list) is held out of the write entirely and surfaced in the run summary for Tej to review/approve — the same posture as the `Review`-blocked rows in Q4, just for a different reason.
  4. **Live dropdown today has only 3 confirmed values** (re-verified via the sheet's actual data validation rule, 2026-07-04): `Past VSW sponsor`, `Past VSW event partner`, `Comparable event sponsor`. `BC ecosystem directory` was discussed earlier the same day but **is not actually in the live dropdown** — treat it as proposed-new, not confirmed, until Tej adds it to the sheet.
- **Q4 — Review-flagged rows: RESOLVED (Tej, 2026-07-04).** Block Path B for `Approved` + `Duplicate? = "Review"` rows until Tej manually confirms the match (flip `Duplicate?` to `"In Master"` or clear it) — `Review` alone is not sufficient signal to aggregate onto a Master row.
- **Q5 — nightly sweep mechanism: RESOLVED (Tej, 2026-07-04).** In-process scheduler (e.g. `node-cron`) inside the same always-on Socket Mode worker — no new infra/endpoint.

### 10.7 Hard-rule amendment — made 2026-07-04, Tej approved
This feature is the **one sanctioned exception** to the standing rule "never write `master-prospects`" (PRD §2 non-goals, AGENTS.md golden rule #1). The exception is narrow and stays human-gated: writes only happen (a) per-row, (b) only after a human has explicitly set `Review Status = Approved` on that Staging row, and (c) only ever touch the columns in §10.5/§10.4 — every contact/outreach/funding/Stage-tracking column on Master remains 100% human-owned, on new rows and duplicates alike. AGENTS.md golden rule #1 updated with this carve-out.

### 10.8 New build surface
- Extend `sheets.ts`: a fuller Master read (today's `readMasterIndex` only pulls col B — this needs row numbers plus `Why Them`/`Source Link` for Path B matching) + two new write ops (append a new Master row; update-in-place `Why Them` + `Source Link` only on an existing row).
- New column mapper (§10.5) + Tier→Source Type table (only Tier 2 confirmed — §10.6 Q3).
- New promotion job: read Approved Staging rows → Path A/B → flip `Review Status` → Slack summary. Reuses the existing `sameOrg()` dedup matcher and Sheets read/write patterns — **no new provider or credential needed.**
- Router: recognize a `promote` command on `app_mention` (no new Slack scopes).
- A scheduler for the nightly sweep (§10.6 Q5).

### 10.9 Success criteria / verification gates
- Approved net-new Staging row → correct new Master row per §10.5; Prospect ID/Stage/HQ/contact fields blank or per the resolved Q1/Q2 default; Staging row flips to `Merged-to-Master`.
- Approved duplicate Staging row (`In Master`) → matched Master row's `Why Them` and `Source Link` get appended (never overwritten); every other column on that Master row unchanged; Staging row flips to `Merged-to-Master`.
- Re-running an already-`Merged-to-Master` row is a true no-op (nothing re-appended, nothing re-flipped).
- A row that isn't `Approved` is never touched by the sweep.
- Both the on-demand `promote` mention and the nightly sweep produce the same summary format (added / merged / failed + Sheet link).

### 10.10 Where this lives
Built as an addition to this same Claude Code Slack Intake Service (not n8n) — reuses its ported dedup matcher and Google Sheets read/write pattern. Everything upstream of `data-staging` (Source Queue, n8n scraper/dispatcher, dedup-into-Staging) stays exactly as-is; this feature only starts from an Approved Staging row.

---

## 11. Promotion Agent — tool-using architecture (supersedes §10.6 Q3's classifier design)

**Decided with Tej, 2026-07-04, after a live dry run against real Approved rows exposed that a hardcoded Source Type keyword table doesn't generalize** (see PLAN Stage 6 Execution Log for the exact failures). Rather than patch that one classifier, §10's whole per-row decision (Path A vs. B vs. hold vs. skip, plus the write itself) becomes the job of a real tool-using agent, not a fixed for-loop. This section is the **how**; §10 (why/trigger/paths/mapping/hard rules) still holds — the change is in what *decides* and *executes* each step.

### 11.1 Why an agent, not a bigger script
A dry run against 4 real Approved rows showed keyword matching failing on 2 of them (real Source labels don't generalize from a handwritten pattern list). The fix isn't a bigger table — it's judgment with real context, the ability to go find more context when unsure, and a way to record *how* confident a decision was so a human can spot-check it. That's what turns "Startup TNT Summit" from an unrecognized string into a correctly-classified Comparable event sponsor: research, not a longer if/else chain.

### 11.2 The core design principle: hands vs. nervous system
- **Hands = tools.** Each individual action (read a range, append a row, post to Slack, search the web) is its own small, deterministic, individually-tested function — exactly the standard the rest of this codebase already holds itself to. A tool's own code enforces its boundary (e.g. `append_master_row` physically cannot populate a column outside the sanctioned 9, no matter what it's asked) — this doesn't get *less* rigorous just because an agent is calling it, if anything it matters more.
- **Nervous system = the agent loop.** What used to be a hardcoded per-row branch (`if Duplicate?==""... else if =="In Master"...`) is now the model's own judgment call, informed by the same rules (PRD §10, AGENTS.md golden rules) given as context rather than enforced as external control flow.
- Golden rule #15 (Sheets' `strict` validation doesn't protect API writes) is *why* this split matters: nothing stops a bad write except the tool's own code, so the tools carry the safety, not the sheet and not the agent's good judgment alone.

### 11.3 Implementation: hand-rolled loop against `@anthropic-ai/sdk`, not the Claude Agent SDK
Researched 2026-07-04: the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is optimized for filesystem/coding-agent operations (Read/Write/Edit/Bash/Grep) — a poor fit for domain-specific tools (Sheets cells, Slack messages, Notion pages). Using it here would mean wrapping every tool as a custom MCP server just to get its loop, for no real benefit over hand-rolling. Instead: a loop against the same `@anthropic-ai/sdk` package `anthropicClient.ts` already wraps — send a message with `tools`, check `stop_reason === "tool_use"`, run our own TypeScript function, feed the `tool_result` back, repeat until a final answer or a step/time budget is hit. Runs inside the existing always-on Socket Mode worker process — no new service, no new hosting (Railway deploy explicitly deferred, Tej 2026-07-04 — not needed to build this).

### 11.4 Tool belt (v1)

| Tool | Read/Write | Notes |
|---|---|---|
| `read_approved_staging_rows` | Read | Full A:R shape of `Review Status="Approved"` rows |
| `read_master_index` | Read | Row #, Org Key, Why Them, Source Link per Master row |
| `read_source_type_dropdown` | Read | Live `ONE_OF_LIST` values, re-read fresh every run (not hardcoded) — this is *why* an approval "just works" with no code change: the next run sees the dropdown has changed |
| `lookup_source_type_cache` | Read | Persistent JSON file (Tej's choice over a Sheet tab) mapping Source strings → past decisions — avoids re-classifying repeats, keeps answers consistent run over run |
| `firecrawl_search` | Read (external) | Firecrawl `/search`, direct REST call, `FIRECRAWL_API_KEY` already in `.env` |
| `firecrawl_scrape` | Read (external) | Firecrawl `/scrape`, direct REST call — clean markdown from a URL found via search or already in context |
| `append_master_row` | Write | Only B/C/D/F/I/J/K/M/AF, ever (PRD §10.5) |
| `update_master_aggregate_row` | Write | Only Why Them (F) + Source Link (J), ever (PRD §10.4), idempotent pipe-join append |
| `flip_staging_review_status` | Write | Only sets `"Merged-to-Master"`, only after a real write succeeded |
| `ask_tej_on_slack` | Write, low-risk | See §11.5 — posts + persists as resumable, not a blocking dead-end |
| `append_source_type_to_dropdown` | Write, **gated** | Only runs after Tej's explicit `@bot approve <value>` — never offered as something the reasoning loop can decide to call on its own initiative |

**Deliberately not given to the Promotion Agent:** any tool that writes a Contact field (AGENTS.md golden rule #2 — opportunistic surfacing via Slack only, never a direct write *from this agent*; §13's separate contact-attribution feature is the one place Contact columns ARE written directly, but only from an explicit human-provided Slack message, never from this agent's own research); `firecrawl_interact` (no click/form/login need for this task); anything resembling "modify this repo's own code" (golden rule #16 — suggest, don't self-build).

### 11.5 Human-in-the-loop: `ask_tej_on_slack`, timeout, and resuming later
1. Agent posts the question in-thread and the pending question is **persisted immediately** (not just held in memory) — recorded with the thread_ts, the question, and enough context to resume that one item specifically.
2. The run waits synchronously up to **5 minutes** for a reply in that thread. If Tej answers within the window, that item finishes in the same run.
3. If the window elapses, nothing is lost — the run finishes/reports everything else, and that one item is left marked pending.
4. A Slack `message` event listener watches threads with a pending record. Whenever Tej replies — 5 minutes or 5 days later — the system resumes **just that held item** (not the whole original batch) using the persisted context, and reports the outcome in the same thread.
5. Tej never needs to re-trigger `@bot promote` or come back to the codebase to continue a stalled item — replying in the thread is the entire "reopen" action.

### 11.6 Confidence + audit trail: the Notion run log
- **A Notion database, one row (= one Notion page) per run** — not a flat pile of sibling pages, and not one running log. Decided 2026-07-04: a database gives real filter/sort views as the log grows (e.g. "every run with a failure," "tokens spent last week") and lets the agent query its own history by property cheaply, rather than reading through every page body to find something.
- **Already created and live:** "Promotion Agent — Run Log" database under the "VSW Future Planning" page, `NOTION_PROMOTION_LOG_DATABASE_ID` in `.env`. Schema: `Run` (title), `Date`, `Trigger` (`on-demand`/`nightly`), `Status` (`success`/`partial`/`failed`), `Added`, `Merged`, `Skipped - Review`, `Skipped - Source Type`, `Failed`, `Tokens spent`, `Firecrawl calls`, `Slack thread` (url).
- Linked from the Slack summary the same way Sheet links already are (e.g. "📋 Open Data Staging" / "📝 Open Log Entry").
- Written automatically by the code wrapping the loop, after every single run, regardless of outcome — not something the agent has to remember to trigger. The row's properties carry the queryable summary; the row's **page body** carries the full detail — every prompt/tool call/tool result/error, the final outcome per row processed, any citations from `firecrawl_search`/`firecrawl_scrape` research, and any suggestions the agent made (golden rule #16).
- Page body kept token-optimized (terse, YAML-ish, matching this repo's own doc style) so the agent can cheaply read its own history back later (e.g. "have I seen this Source before, what did I decide, why").

### 11.7 Guardrails (built into v1, not bolted on after)
- **Tool allowlist:** exactly the list in §11.4 — nothing else callable.
- **Max iterations:** a bounded number of tool calls per row/item (default 6) and a wall-clock budget per batch (default 90s) — hitting either fails that item cleanly (same "leave it untouched, retry later" posture already in the promotion job), never silently truncates or corrupts a partial write.
- **Idempotency:** cache-check before classifying; `append_master_row`/`update_master_aggregate_row` unchanged from their existing idempotent behavior; `ask_tej_on_slack` deduped so a retry doesn't re-post an identical pending question; `append_source_type_to_dropdown` checked-then-applied (read current values, append, read back to confirm) since it's a schema-level write, not a cell write.
- **Failure in Slack:** reuses the existing ❌-reaction-plus-"ran into a snag" pattern (AGENTS.md golden rule #12) — no new failure UX to design.
- **Cost tracking:** every run's Notion log records tokens spent (Anthropic) and calls made (Firecrawl), so spend is visible without a separate dashboard.

### 11.8 First real test
The 4 real Approved rows already sitting in `data-staging` (RBCx, BDC Capital, TELUS Pollinator Fund, BC Tech — see PLAN Stage 6 Execution Log for the dry-run findings) are the first live proof of this architecture once built, not a synthetic follow-up test.

## 12. Conversational chat (plain-mention Q&A about the spreadsheet/build)

A separate, lighter feature from the Promotion Agent (§11) — a plain `@bot` mention with free text and no file/URL/`promote`/`approve` command now gets a real conversational answer instead of the generic "mention me with a URL/file" prompt. This is a read-only Q&A surface, not another write-capable agent.

- **Scope:** answer questions about what's in `data-staging`/`master-prospects` (counts, whether an org is present, its Why Them/Source Link) and about how the service itself works. No write tools at all — this loop can never touch either sheet, run promote/approve, or scrape a URL; if asked to do one of those, it tells the user to just do it directly (mention with the URL/file, or say `promote`/`approve <value>`).
- **Implementation:** `src/chat/answerQuestion.ts` — a small bounded tool loop (max 4 tool calls / 30s wall clock, far smaller than the Promotion Agent's 6/90s) against the same `@anthropic-ai/sdk` client, with its own system prompt (`src/chat/systemPrompt.ts`) and two read-only tools (`src/chat/tools.ts`): `read_master_snapshot`, `read_staging_snapshot`.
- **Easter egg (`src/chat/easterEggs.ts`):** checked before the model is ever called — "will you be my friend" gets a fixed, free, instant reply. Not a real requirement, just a fun one Katty asked for during the build.
- **Routing:** `router.ts`'s `detectRoute` — a mention with no file, no URL, and no `promote`/`approve` command, but some other text, now routes to `{ kind: "chat" }` instead of falling through to `none`. A bare mention with no text at all still gets the `none` help prompt.

## 13. Contact attribution (plain-mention, writes master-prospects directly)

A plain `@bot` mention attributing a contact/generic inbox to a company **already in `master-prospects`** — e.g. `"Aritzia — Jane Doe, VP Marketing, jane@aritzia.ca"` or `"generic inbox for Aritzia is service@aritzia.ca"`. Unlike chat (§12), this DOES write — but only through one structurally-scoped function, the second sanctioned exception to "never write master-prospects outside the Promotion Agent" (golden rule #1), and a deliberate carve-out to golden rule #2's "Contact fields... off-limits to every tool."

- **Routing:** `router.ts`'s `detectRoute` — checked before URL-forwarding. An email address anywhere in the text routes to `{kind:"contact"}` unconditionally; a LinkedIn profile URL (`linkedin.com/in/`) only counts when accompanied by other text, so a bare pasted LinkedIn URL still forwards to n8n exactly as before.
- **Parsing:** `src/paths/contact.ts`'s `parseContactMessage` — one Anthropic call, no D12 substring check (the user is typing directly, not extracting from a fetched document). Returns the org-name guess, one or more contacts (name/title/email/linkedin, or a generic-inbox flag), and optionally a Why Them addition (ONLY when the message explicitly frames something as a reason to approach the org) or a Notes addition (everything else).
- **Org matching:** `src/contact/matchOrg.ts`'s `matchMasterOrg` — deterministic `sameOrg()` first (same matcher the dedup engine and the Promotion Agent's `match_master_org` tool use), falling back to one Anthropic call over the live Master org-name list only when nothing matches deterministically. Ambiguous (0 or 2+ candidates) → asks Tej.
- **Writing:** `src/sheets.ts`'s `updateMasterContactFields` — the ONLY function allowed to touch Primary Contact Name/Title/Email/LinkedIn (N/O/P/Q), Secondary Contact Name/LinkedIn (R/S), or Generic Intake Email (T); also does append-only writes to Why Them (F, via `appendAggregate`) and Notes (AF). Structurally cannot touch any other column, same defense-in-depth as `append_master_row`/`update_master_aggregate_row` (golden rule #15).
- **Primary vs. secondary:** `src/contact/contactSlot.ts`'s `decideContactSlot` (pure, unit-tested) — primary if N/O/P/Q are all blank, else secondary if R/S are blank, else ambiguous (asks Tej whether to overwrite primary, overwrite secondary, or just log in Notes). Secondary has no Title/Email column — if given, it's appended to Notes instead.
- **Org not found:** asks Tej, and the reply can go three ways (`src/contact/runContactAgent.ts`'s `resumePendingContact`): confirms new → staged via the existing `processItems`/`classifyItem` pipeline like any other intake path (Source: "Manual (Slack contact)"), never a direct Master write for a net-new org; corrects with a row number → re-reads that row fresh and writes directly; names a different org without a row number → re-runs the match against the correction.
- **Ambiguity/hold-resume:** reuses the Promotion Agent's existing `PendingQuestion` persistence + `app.message()` late-reply listener (`kind: "contact"` discriminator, `pendingQuestions.ts`) rather than a parallel mechanism — `index.ts`'s `tryResumePendingQuestion` branches on `kind` to call `resumePendingContact` instead of `resumePendingRow`.
- **Not in v1:** auto-requeuing the original contact payload after a net-new org gets promoted — Tej is asked to re-send the contact message once it's live in Master.
