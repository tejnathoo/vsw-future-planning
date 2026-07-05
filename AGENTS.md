# AGENTS.md — instructions for coding agents in this repo

You are building the **VSW Slack Intake Service**: a Node/TypeScript service on Railway that adds a Slack front door (URL / CSV / image) to the existing VSW Sponsor Sourcing pipeline. Read [PRD.md](PRD.md) for what/why and [PLAN.md](PLAN.md) for the phased build. This file is the **how** + the non-negotiable rules.

> **Living docs.** When you make a decision or deviate from spec, update the relevant doc AND append a dated entry to PLAN.md → Execution Log. The Notion Build Brief (`f106a46762d14d7eb5f039dc7cf25f1a`) is the ultimate source of truth; this repo mirrors it.

---

## Golden rules (violating these breaks the data plane)

1. **Never write to `master-prospects` outside the Promotion Agent (PRD §11 / PLAN Stage 7).** Everywhere else (all 4 intake paths), append to `data-staging` only — unchanged, still absolute. Within the Promotion Agent, the agent has real discretion over *when and what* to write, driven by context rather than a fixed external script — but every write **tool** it can call is itself structurally restricted in code, not just prompted: `append_master_row` can only ever populate the same 9 columns (PRD §10.5), `update_master_aggregate_row` can only ever touch Why Them + Source Link, and neither can be made to touch a contact/outreach/funding/Stage-tracking column no matter what the agent asks for. Discretion is over sequencing and judgment; the tools themselves define the hard boundary (defense in depth, matching golden rule #15).
2. **Contact fields are opportunistic, never a research target (revised 2026-07-04).** The agent must not go looking for a contact name/email as its own task — filling Contact isn't required for a row to be considered done. But if a name surfaces naturally with strong confidence while researching something else, it should be flagged to Tej in Slack (via `ask_tej_on_slack` or a note in the run summary), never written directly into either sheet. Writing an actual Contact value anywhere is still off-limits to every tool.
3. **Never drop a duplicate silently.** Merge it (append source, +1 Times Seen) or flag it (`Review` / `In Master`) — and for the Promotion Agent specifically, every row's outcome (added/merged/held/skipped/failed) is recorded in that run's Notion log, so "what happened to this row and why" is always reconstructable even when the agent made the call itself, not a script.
4. **On Staging merge (the dedup/intake spine, unaffected by the Promotion Agent), touch only columns G / I / N / P.** Never edit `Source` (F), `Contact` (K), or `Review Status` (R). Col I (`Why Them`) gets an appended note, not a rewrite — see §Dedup step 2.
5. **The intake paths do NOT scrape URLs — unchanged.** URLs still go to n8n's existing webhook; no Firecrawl/Stagehand/URL-extraction code in `paths/url.ts` or the classify/dedup spine. **The Promotion Agent is the one deliberate, scoped exception (Tej, 2026-07-04):** it may use Firecrawl (`/search` + `/scrape`, direct REST calls — see PRD §11) to research an ambiguous Source label or org. This is not a general scraping capability for the service — it's two narrowly-defined tools available to one specific agent, for its own research needs, nothing else.
6. **Use the corrected Category enum** (PRD §6) from day one — not the old Sponsor/Funder/… list. It is `strict` in the live sheet (confirmed via data validation on `master-prospects`); values outside it are rejected. Tier-5 grant sources use a real enum value (e.g. `Gov`) plus a `"Grant: "` prefix in `Why Them` — never write a bare `"Grant"` Category (PRD §8, resolved).
7. **Read fresh Staging immediately before computing dedup.** There are two writers now (n8n + this service); rely on the idempotency guard.
8. **Secrets live only in `.env` (local) and Railway variables (prod).** Never in code, never in committed docs. `.env` is gitignored.
9. **Always reply in the same Slack `thread_ts`** so concurrent mentions don't cross-talk.
10. **Download Slack files with `Authorization: Bearer <BotToken>`** against `url_private` — anonymous fetch 404s.
11. **Every path requires an explicit @mention** (`app_mention`), including file uploads. `file_shared` alone (no mention) is ignored — one consistent trigger rule across URL/CSV/PDF/image/text.
12. **Slack replies should read like a teammate, not a system log** (Tej, 2026-07-04). Send an immediate friendly "got it, working on it" ack for every file-based path before the (slower) processing starts — don't leave the user staring at silence. Keep result/error messages warm and conversational (e.g. "Ran into a snag..." not "ERROR:"), while still including the real counts/Run ID. See `src/index.ts` for the current wording to match. **Expanded 2026-07-05 into two dedicated docs — read these before adding or changing any Slack message in this codebase:** [docs/slack-formatting-reference.md](docs/slack-formatting-reference.md) (mrkdwn syntax + every Block Kit block type this repo uses, with schemas/limits) and [docs/slack-communication-style.md](docs/slack-communication-style.md) (when/why — the 3-line rule, bullets over `·`-joined lines, asides on their own line, links/Run IDs in `context` blocks not the body). `src/slack/reply.ts`'s `bulletMessage` is the shared implementation of both.
13. **React `:wastebasket:` on a bot message to delete it** (Tej, 2026-07-04) — restricted to `SLACK_ADMIN_USER_ID` only (checked against `event.user`, the reactor) and only ever deletes messages the bot itself posted (checked against `event.item_user`, matching this bot's own `auth.test()` id — `chat.delete` can't touch other authors' messages anyway, but we check explicitly). Requires the `reactions:read` scope + a `reaction_added` Event Subscription — human, one-time Slack app config, see §Setup.
14. **The bot reacts, not just replies** (Tej granted `reactions:write` 2026-07-04): 👀 immediately on receiving any mention (before any text — instant visual ack even while a longer path is still processing), then a completion reaction once a path finishes. **`white_check_mark` means the service itself finished the real work** (text/CSV/image/PDF — write to the sheet is done). **The URL path uses `outbox_tray` instead** — it only means the hand-off to n8n succeeded, not that the scrape is done (n8n's own completion message, which can take seconds to minutes, is the real finish; a ✅ before that arrived read as wrong/premature in live testing, 2026-07-04). `x` still means failure for both. Reaction failures (e.g. `already_reacted`) are swallowed, not surfaced as errors — see the `react()` helper in `src/index.ts`.
15. **Google Sheets `strict: true` data validation does NOT protect API writes — only manual UI typing.** Confirmed empirically 2026-07-04: `spreadsheets.values.update` successfully wrote an arbitrary out-of-dropdown string into a `strict: true` ONE_OF_LIST column (tested against `master-prospects`' Source Type column) with no error — the cell just shows a validation-warning triangle in the UI afterward, nothing rejects the write itself. This means every enum-like column this service writes **must validate in code before writing, always** — never assume the sheet's own dropdown will catch an invalid value. `classify.ts`'s Category check already does this correctly; the Promotion Agent (PRD §11 / PLAN Stage 7) must too — this is exactly why adding a Source Type value to the live dropdown is a separate, explicitly-gated tool (`append_source_type_to_dropdown`) rather than something any write just silently attempts.
16. **The Promotion Agent may propose new tools/context/process improvements — it may not build or deploy them itself (Tej, 2026-07-04).** If it identifies a capability gap mid-run, it notes the suggestion in the run's Notion log / Slack summary for a human to act on. Self-modifying code is a different, bigger risk category than deciding which existing tool to call, and is explicitly out of scope for v1.

## Known performance gap (not yet fixed, tracked here so it isn't lost)

`src/pipeline.ts`'s `processItems` calls `classifyItem` **sequentially, one new org at a time**. Combined with `ANTHROPIC_MODEL=claude-opus-4-8` (the slowest/most expensive Claude model), a document with 20-40 new orgs can take several minutes end-to-end. Tej explicitly deferred fixing this (2026-07-04) rather than block on it mid-build. When picked back up: parallelize the classify calls in the "new" branch of the loop (e.g. `Promise.all` over pending new-row candidates before the final append), and/or default to a faster model for classification specifically (it's straightforward categorization, not deep reasoning — Sonnet is a reasonable default with Opus still available via env override).

---

## Tech stack

- **Language:** TypeScript, Node 20+. Strict mode on.
- **Slack:** `@slack/bolt` in **Socket Mode** (no public endpoint; always-on worker on Railway). ACK fast, do work async.
- **Sheets:** `googleapis` (Sheets v4) with a **service account** that has edit access to the spreadsheet.
- **Vision + PDF:** Google Gemini (`@google/genai` / Generative Language API) handles both sponsor-logo images and PDFs (native document understanding; large files via the Gemini File API). Confirm the current GA model id at build time.
- **Classification:** Anthropic (`@anthropic-ai/sdk`).
- **CSV:** a small parser (`csv-parse`) — no LLM needed for CSV extraction.
- **Config:** all via env (see `.env.example`); validate on boot and fail fast if required vars are missing.

Suggested layout:
```
src/
  index.ts            # boot Bolt app (Socket Mode), env validation
  router.ts           # app_mention/file_shared → URL | CSV | image
  slack/              # ack, file download (Bearer), reply formatting
  paths/
    url.ts            # forward to n8n webhook
    csv.ts            # parse + map (Viv shape + general)
    image.ts          # Gemini vision → items[]
    pdf.ts            # Gemini document understanding (File API for large files) → items[]
    text.ts           # Anthropic text extraction (md/txt) + D12 substring post-check → items[]
  classify.ts         # Anthropic Category/Sector/Why Them
  dedup.ts            # ported §7 engine (see below) — 1:1, tested
  sheets.ts           # googleapis read/append/merge
  types.ts            # Item, StagingRow, etc.
```

---

## Key facts / constants (verify against Notion before trusting)

- Spreadsheet id: `1GZ0dvzz_ODdJ3Cd9jKfmPZtOjI-_w5f-LEDvT-ecDaQ`
- `data-staging` gid: `186943567` · `master-prospects` header row: `2`
- n8n webhook: `POST https://primary-production-9c98.up.railway.app/webhook/vsw/scrape-url` body `{"urls":[...],"note":"..."}`
- Slack channel: `#tej-bots` (`C0BEUTEDAF4`)
- Staging columns A–R and the merge/hard rules: PRD §5.
- `master-prospects` columns A–AF (header row 2, data from row 3; confirmed live 2026-07-04, real data through row 176): `A Prospect ID · B Organization Name · C Category · D Subsector · E HQ / Geography · F Why Them · G Potential Mutual Value · H Programming Angle · I Source Type · J Source Link · K Warm Lead? · L Warm Lead Person · M Warm Lead Path · N Primary Contact Name · O Title · P Email · Q LinkedIn URL · R Secondary Contact Name · S Secondary Contact LinkedIn · T Generic Intake Email · U Stage · V Last Touch Date · W Last Touch Channel · X Next Step · Y Next Follow-up Date · Z Owner · AA Funding Type · AB Estimated Capacity · AC Target Ask Range · AD Exclusivity Play? (Y/N/Unknown) · AE Budget Window · AF Notes`. The Promotion feature (PRD §10) only ever writes B/C/D/F/I/J/K/M/AF on append, and only F/J on aggregation (§10.4) — see PLAN Stage 6.
- **`master-prospects` Source Type dropdown (col I) — confirmed live via its data validation rule, 2026-07-04: only 3 values exist today — `Past VSW sponsor`, `Past VSW event partner`, `Comparable event sponsor`.** `BC ecosystem directory` (discussed earlier the same day) is NOT actually in the live dropdown — it was a verbal agreement to add it, not yet done in the sheet. Same `strict: true` ONE_OF_LIST validation as Category — golden rule #15 applies.
- Run ID format: `YYYYMMDD-HHmm-<source-slug>`. All dates/times America/Vancouver.

---

## Dedup / merge engine (§7) — port this VERBATIM

This exact logic passed the Phase 6 verification gate in n8n (VIATEC run merged 5 orgs correctly). Port to TypeScript **1:1**. Do **not** tune the matcher without re-running an overlap test (two sources with known overlapping orgs → confirm single row + Times Seen increments, no false merges on distinct orgs).

```javascript
const LEGAL = /\b(inc|incorporated|ltd|limited|llc|llp|corp|corporation|co|company|society|foundation|assn|association)\b/g;
const orgKey = n => (n||"").toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g," ").replace(LEGAL," ").replace(/\s+/g," ").trim();
const domainOf = u => { try { const h=new URL(u).hostname.replace(/^www\./,""); const p=h.split("."); return p.length>2?p.slice(-2).join("."):h; } catch { return ""; } };
const toks = k => new Set(k.split(" ").filter(Boolean));
const jac = (a,b)=>{const A=toks(a),B=toks(b);const i=[...A].filter(x=>B.has(x)).length;const u=new Set([...A,...B]).size;return u?i/u:0;};
const pref = (a,b)=> a&&b&&(a.startsWith(b)||b.startsWith(a));

// same-org variant tolerance (Phase 6): treat () as delimiters, drop trailing ", <location>",
// strip legal suffixes, then match on sorted-token key OR tight-key OR >=12-char prefix.
function sameOrg(a, b) {
  const clean = s => (s||"").replace(/\(([^)]*)\)/g, " $1 ").split(",")[0];
  const kA = orgKey(clean(a)), kB = orgKey(clean(b));
  const sortedTok = k => toks(k).size ? [...toks(k)].sort().join(" ") : k;
  const tight = k => k.replace(/\s+/g, "");
  if (sortedTok(kA) === sortedTok(kB)) return true;
  if (tight(kA) === tight(kB)) return true;
  const tA = tight(kA), tB = tight(kB);
  if (tA.length >= 12 && tB.length >= 12 && (tA.startsWith(tB) || tB.startsWith(tA))) return true;
  return false;
}
```

**Algorithm (per item):**
1. Same-run dupe check.
2. Exact Staging match (Domain first, else `sameOrg`) → **MERGE**: append Source URL to col G if not already present (pipe-split check), `Times Seen += 1`, update Scraped At (P), and append a note to `Why Them` (col I): `"<existing text> (Nth: <source label>)"` where N is the new `Times Seen` value and `<source label>` is this run's col F value (2026-07-04, Tej — makes the sighting history visible without cross-referencing G/N). Never touch F itself.
3. Exact Master match (Org Key only — Master has no Domain col) → new Staging row, `Duplicate? = "In Master"`.
4. Fuzzy (Jaccard ≥ 0.8 or prefix) → new Staging row, `Duplicate? = "Review"`, `Matched Org` = best candidate.
5. Else → clean new row, `Times Seen = 1`.

**Idempotency guard:** before appending a Source URL, split col G on `" | "` and trim; if the (Org Key | Source URL) pair already exists, skip — re-running an identical source must add 0 rows and increment nothing.

**Known matcher pitfalls (from the n8n build):** genuinely-distinct orgs like `entrepreneurship@UBC` vs `Innovation UBC`, `Foresight Canada` vs `Foresight Cleantech Accelerator`, bare `UBC` must stay separate — validate against these when you port. Default Category must be `""` (not `"Other"`, which isn't in the enum).

---

## Vision + PDF paths (Gemini) — details

Decision (2026-07-03): **Google Gemini** is the vision + document provider for both the image and PDF paths.

- **Prompt** (strict JSON): identify every distinct company/organisation logo; return `{"items":[{"organization":"","evidence":"logo visible in image"}]}`; only orgs identifiable with reasonable confidence from the logo/wordmark; skip illegible/generic marks.
- **Model:** use the current GA Gemini vision model (`gemini-2.5-pro` for accuracy, `gemini-2.5-flash` for cost). **Confirm the live model id before shipping** — don't hard-code a model that may have rolled.
- **Confidence gate:** any brand-new org (not matched in Staging/Master) from the vision engine defaults to `Duplicate? = "Review"` so a human verifies logo-only extractions. Recognized orgs still merge normally. (Whether a single clear banner should skip Review is PRD Open Question #2 — don't decide silently.)
- **Optional logo → company → website enhancement:** vision often yields just a name (or a symbol with no wordmark). To fill `Domain`/`org_url` (which makes domain-based dedup far more reliable than name-only), resolve each extracted org:
  - **Option A — Gemini with Google Search grounding:** one grounded call returns the real company + official website. Best for obscure/symbol-only logos. Requires enabling the grounding/search tool on the Gemini request.
  - **Option B — Firecrawl search** (`FIRECRAWL_API_KEY`, optional): search the org name, take the top official result's domain.
  - Keep this behind a flag for v1; the `Review` gate already covers residual misses. Start without it, add if testing shows too many unresolved/symbol-only logos.
- **PDF path:** send the PDF to Gemini's document understanding (not a text-only parser — sponsor decks have logo-only pages a text parser misses). Small PDFs can be inlined; **large PDFs must go through the Gemini File API** — respect the model's page/size limits, and if a document is truncated, note it in Run Notes and warn in-thread. Brand-new orgs from the PDF engine also default to `Review` (same rationale as vision). Extractor (col Q) = `PDF`.

## Markdown / plain-text path (Anthropic) — details

A 5th intake type: `.md`/`.txt` files (e.g. a typed/pasted list of org names). **Provider: Anthropic, not Gemini** — there's no visual content, so this is a text-extraction task like classification, not a vision task.

- Read the file as UTF-8 text. One call: extract every distinct org name → strict JSON `{items:[{organization, evidence}]}`.
- **The D12 anti-hallucination substring check applies here** (unlike vision/PDF, where there's no fetched text to check against) — drop any org name that isn't actually a substring of the file's text; count drops. Because this check applies, brand-new orgs from this path do **not** get the forced `Review` treatment — treat like the CSV path.
- Extractor (col Q) = `Text`.

## User-note context (all paths)

Added 2026-07-04: whatever the user types alongside the @mention, besides the URL/mention itself, is captured as a free-text `userNote` (`src/router.ts` `stripUrls` for the URL path, raw leftover `text` for file paths) and threaded through:
- Text path (`extractOrgsFromText`): included in the extraction prompt so it can steer which orgs get pulled (e.g. "these are the CVCA 50 — attribute to CVCA").
- All paths via `classifyItem`/`RunContext.userNote`: included in the classification prompt so it can ground Sector/Why Them and follow attribution instructions.
- URL path: forwarded to n8n as a separate `userNote` field on the webhook payload (n8n's own pipeline decides whether to use it — this service doesn't classify URL-path items).

The note is user-provided (trusted), so it is NOT subject to the D12 substring check — it's context, not a source of new org names by itself (the text-extraction prompt explicitly says not to pull org names only mentioned in the note).

---

## Setup (human, one-time)

1. **Slack app** (api.slack.com/apps): bot scopes `chat:write`, `files:read`, `app_mentions:read`, `reactions:read` (for wastebasket-delete), `reactions:write` (bot reacts 👀 on receipt, ✅/❌ on completion); Socket Mode **must be explicitly toggled on** in the app's settings — generating the App-Level Token alone does NOT enable it (real gotcha hit 2026-07-04: Bolt logs `Socket Mode is not turned on` until this toggle is flipped, separately from having an `xapp-` token); Event Subscriptions `app_mention` + `reaction_added` (+ optional `file_shared`, unused — every path requires an explicit mention, see golden rule #11); install (or reinstall after adding scopes/events — Slack requires this); copy tokens into `.env`, plus `SLACK_ADMIN_USER_ID` (your own Slack user ID — the only one allowed to trigger wastebasket-delete).
   - **⛔ Not yet granted (2026-07-04), needed before Promotion Agent §11.5 resume-after-timeout works:** add scope `channels:history` + Event Subscription `message.channels`, then reinstall. Without this, a reply to a held `ask_tej_on_slack` question only resumes the row if it arrives within that run's own 5-minute wait — a later reply won't be picked up by `index.ts`'s `app.message()` listener.
2. **Google service account** with edit access to the spreadsheet; download the JSON key to `./secrets/service-account.json` (gitignored); share the sheet with the SA email.
3. **API keys:** `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (rotate the one that sat in the deploy-kit doc), optional `FIRECRAWL_API_KEY`.
4. `cp .env.example .env` and fill it. `npm install`. `npm run dev`.

---

## Testing / verification

- Unit-test `dedup.ts` against the overlap fixtures before wiring sheets (Phase 4 gate).
- End-to-end gates: PRD §7 / PLAN Phase 10. The must-pass proof is that **"New Ventures BC" MERGES** across the CSV (service) and the earlier n8n scrape — a live cross-writer dedup check.
- Confirm file download fails without the Bearer header (don't ship without it).

## Style
- Match surrounding code; keep functions small and pure where possible (esp. dedup — it must be unit-testable without network).
- No secrets in logs. Log Run IDs + counts, not tokens or PII.
