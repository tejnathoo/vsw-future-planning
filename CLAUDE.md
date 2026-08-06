# Claude Code — VSW Future Planning

## Quick orientation

This is the **VSW Sponsor Sourcing pipeline** — a Slack-triggered intake service (Node/TypeScript on Railway) plus a suite of outreach/enrichment workflows managed through a Google Sheet and Notion.

**Read order for code work:** [AGENTS.md](AGENTS.md) (hard rules + dedup engine) → [PRD.md](PRD.md) (what/why) → [PLAN.md](PLAN.md) (build phases, ~260 lines). The detailed decision log lives in [EXECUTION-LOG.md](EXECUTION-LOG.md) — read it only when you need historical context on a specific past decision, not on every session start.

**Read order for outreach work:** [docs/vsw/vsw-sponsor-value.md](docs/vsw/vsw-sponsor-value.md) (what we're actually offering, and the attendee-figure caveat), then [docs/outreach-copy-playbook.md](docs/outreach-copy-playbook.md) — the playbook is mandatory, not reference. It carries hard rules earned by getting them wrong: research by **deep-scraping each org's own site** (not open-web search), a **write-time gate** (`scripts/enrichment-gate.ts` — it refuses the write, it doesn't just report), a **Stop Slop tone pass**, and a **read-the-doc-back Definition of Done**. Skipping it reproduces exact defects from the 2026-07-15 run.

**At the start of every session**, read [assets/artifact-src/week-plan.html](assets/artifact-src/week-plan.html) — the current week's plan (the one goal, the scoreboard, and each day's deliverable-sized blocks). It's the source of truth for what Tej is working toward this week and what today's must-ship is; use it to orient before answering anything about priorities, scheduling, or "what should I be doing." It's also published at [twelveoclock.co/vsw-week-plan](https://twelveoclock.co/vsw-week-plan) and as a Claude artifact. **The live site (twelveoclock.co) is the source of truth between the three copies** — local and published should always match it; if they ever disagree, treat the live site as correct and update the local source to match, not the other way around. After any edit, rebuild and republish both (`npx tsx scripts/build-artifact.ts assets/artifact-src/week-plan.html <output>`, see [docs/design-system.md](docs/design-system.md)) so nothing drifts.

**Publishing the live site is a CLI deploy, not a git push.** The `vsw-week-plan` Railway project is its own service, separate from this repo's `vsw-future-planning` service, and it has **no git auto-deploy** — every deployment in its history was pushed with `railway up`. Committing or merging to `main` does nothing to twelveoclock.co. The full sequence after editing `assets/artifact-src/week-plan.html`:

```bash
npx tsx scripts/build-artifact.ts assets/artifact-src/week-plan.html web-week-plan/index.html
cd web-week-plan && railway up --ci -m "<what changed>"
```

`web-week-plan/` is already linked to project `vsw-week-plan`, service `vsw-week-plan`, env `production` (re-link with `railway link --project vsw-week-plan --service vsw-week-plan --environment production`). [server.js](web-week-plan/server.js) reads `index.html` once at boot, so a restart is not enough — it needs a real deploy. Verify with `curl -s https://twelveoclock.co/vsw-week-plan | grep ...` before calling it published. Before editing, also read [docs/week-plan-operating-principles.md](docs/week-plan-operating-principles.md) — the standing principles and frameworks (Deep Work, GTD, 4DX) the plan's structure is built on.

## File map — what to read when

| When you're doing... | Read these |
|---|---|
| Any code change to `src/` | AGENTS.md (golden rules), PRD.md (spec) |
| **Anything that makes a claim about VSW itself** | [docs/vsw/vsw-sponsor-value.md](docs/vsw/vsw-sponsor-value.md) — audience numbers, differentiators, proof, and what we *cannot* claim |
| Outreach copy (emails/LinkedIn) | [docs/outreach-copy-playbook.md](docs/outreach-copy-playbook.md) + [docs/vsw/vsw-sponsor-value.md](docs/vsw/vsw-sponsor-value.md) |
| VSW voice / tone on anything published | [docs/vsw/brand-messaging-framework.md](docs/vsw/brand-messaging-framework.md), [docs/vsw/editing-rules.md](docs/vsw/editing-rules.md) |
| Handling a prospect's pushback | [docs/vsw/objection-handling.md](docs/vsw/objection-handling.md) |
| Enrichment / re-enrichment of prospects | [docs/enrichment-pass-a-playbook.md](docs/enrichment-pass-a-playbook.md) (first-pass batch runs), [docs/tier2-reenrichment-playbook.md](docs/tier2-reenrichment-playbook.md) (deep re-enrichment), [docs/org-goals-enrichment-model.md](docs/org-goals-enrichment-model.md) (schema) |
| Tier rebalancing or status changes | [docs/tier1-to-tier2-handoff.md](docs/tier1-to-tier2-handoff.md) |
| Re-engagement drafts (past partners) | [docs/reengagement-drafts-for-approval.md](docs/reengagement-drafts-for-approval.md) |
| Slack bot message formatting | [docs/slack-formatting-reference.md](docs/slack-formatting-reference.md), [docs/slack-communication-style.md](docs/slack-communication-style.md) |
| Breaking down broad orgs into departments | [docs/broad-org-breakdown-candidates.md](docs/broad-org-breakdown-candidates.md), [docs/broad-org-department-research-v2.md](docs/broad-org-department-research-v2.md) |
| Past fit-research for a specific org | `docs/archive/fit-research/<org>-vsw-fit-research.md` (44 completed research docs) |
| Any artifact, HTML doc, report or deck | [docs/design-system.md](docs/design-system.md) — typeface, colour tokens, build step |
| Editing or planning the week plan | [docs/week-plan-operating-principles.md](docs/week-plan-operating-principles.md) — underpromise/overdeliver, explicit task breakdown, and the Deep Work / GTD / 4DX frameworks the structure is built on |
| Editing one org's tab in an Outreach Drafts doc | [.claude/skills/outreach-doc-edit/SKILL.md](.claude/skills/outreach-doc-edit/SKILL.md) — which doc, how to find the tab (these are real Docs Tabs, not headings), and the Docs API pitfalls already hit once |

## Logging what got done

When Tej asks for time-tracking bullets, says "here's what I got done", or asks you to audit a day or a week, invoke the **`work-log` skill** ([.claude/skills/work-log/SKILL.md](.claude/skills/work-log/SKILL.md)). It runs collect → corroborate → write: sweeps every source the work lives in (repo + EXECUTION-LOG, the live sheet, both Outreach Drafts docs, the Thread with Andrew page, Slack, the week plan, calendar), reconciles them against Tej's own recollection, then writes the bullets in his voice. Don't write the bullets straight from his rundown; the audit's whole value is the work he forgot to mention.

## Editing a single org's outreach draft

When Tej asks to re-route a bounced org to LinkedIn, add/update a LinkedIn draft for a specific company, or otherwise edit one org's tab in an Outreach Drafts doc, invoke the **`outreach-doc-edit` skill** ([.claude/skills/outreach-doc-edit/SKILL.md](.claude/skills/outreach-doc-edit/SKILL.md)) rather than rediscovering the doc structure from scratch. The short version: the sheet's `Draft Link` column has the exact doc+tab URL per org; each org is a real Google Docs Tab (`includeTabsContent: true`, walk `childTabs`), not a heading in a flat body — a plain `body.content` read silently returns nothing and looks like an empty doc.

## Visual work: use the project typeface

Anything visual this project produces (published artifacts, HTML docs, reports) uses **Neue Montreal**, not a default system stack. Full details in [docs/design-system.md](docs/design-system.md); the short version:

- Font files live in `assets/fonts/` (WOFF2, Latin subset). Weights are **400, 500, 700 only** — there is no 600, so never write `font-weight: 600` or it will synthesize a fake bold.
- Artifacts run under a CSP that blocks external fonts, so the face must be inlined. Keep artifact sources in `assets/artifact-src/` with the marker `/* @font-face:neue-montreal */` as the first line of the stylesheet, then build:
  ```bash
  npx tsx scripts/build-artifact.ts assets/artifact-src/<name>.html <output>.html
  ```
  Publish the built output, edit the source. That keeps the 65 KB of base64 out of the file you are editing.
- Stack: `"Neue Montreal", "Helvetica Neue", Helvetica, Arial, sans-serif`.

## Non-negotiables

Full list in AGENTS.md. The short version: never write `master-prospects` (except via Promotion Agent or contact attribution); `Contact` always blank; never drop a duplicate silently; this service does not scrape URLs (forward them to n8n); secrets only in `.env`/Railway; use the corrected Category enum. Log every deviation in [EXECUTION-LOG.md](EXECUTION-LOG.md) (living doc; Notion Build Brief is the ultimate source of truth).

**Note:** those non-negotiables constrain the *deployed service's* code paths (`src/`) — they are not a ban on you, in a Claude Code session, directly reading/writing the live sheet via the pattern below when Tej asks for research, cleanup, or data changes.

## Notion source-of-truth pages

These Notion pages are the canonical references. If this repo and Notion disagree, Notion wins.

- **Build Brief — Slack Intake Service** (this project's spec): `f106a46762d14d7eb5f039dc7cf25f1a`
- **Feature Brief — Staging → Master Promotion**: `6438a38dcd2644f3806d13162c3c2c48`
- **Build Spec — VSW Sponsor Sourcing Pipeline** (schemas, dedup, Slack): `82a3d52821f9494e81816eab1e91817a`
- **Phase 4 Build Guide — n8n vsw-scraper** (battle-tested dedup): `6476139d55fe4bd0b4de7fc6097a9f67`
- **VSW Future Planning** (project hub): `3886b6f2b95b80e7aa38ca1298a768ed`

## Reusable scripts (in `scripts/`, not committed — operational tools)

These are reusable TypeScript scripts run with `npx tsx scripts/<name>.ts`:

- `build-overview-stats.ts` — generates pipeline stats from the live sheet
- `run-report.ts` — generates a run report
- `tracker.ts` / `advance-status.ts` — status tracking and advancement
- `tier1-warm-audit.ts` / `tier1-warm-review-resolution.ts` — Tier 1 warm-lead auditing
- `tier1-tier2-rebalance.ts` — tier rebalancing operations
- `build-reenrichment-brief.ts` — generates briefs for re-enrichment batches
- `apps-script-sticky-milestones.gs` — Google Apps Script for sheet milestones

## Reading/writing the live spreadsheet: always programmatic, never by eye or by guessing

Don't try to "look at" the sheet via a browser, and don't answer questions about its contents from memory/training data or from what an earlier tool call happened to print. The sheet changes constantly and browser access isn't set up in this environment — the only reliable path is the same service-account credentials the deployed service uses, via a throwaway TypeScript file run with `npx tsx`.

**Pattern** (works for both `master-prospects` and `data-staging`, read or write):
1. Write a `.ts` file *inside this repo directory* (not `/tmp` — `tsx`/Node module resolution needs the local `node_modules`), e.g. `./check_tmp.ts`.
2. Auth exactly like `src/sheets.ts` does:
   ```ts
   import "dotenv/config";
   import { google } from "googleapis";
   const auth = new google.auth.GoogleAuth({
     keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // ./secrets/service-account.json
     scopes: ["https://www.googleapis.com/auth/spreadsheets"], // .readonly if you're only reading
   });
   const sheets = google.sheets({ version: "v4", auth });
   const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
   ```
3. Read with `sheets.spreadsheets.values.get({ spreadsheetId: id, range: "master-prospects!A3:AI398" })` (header is row 2, data from row 3 — see AGENTS.md's column map), write with `.values.update(...)`, delete a row with `.batchUpdate({ requestBody: { requests: [{ deleteDimension: {...} }] } })`.
   - **Read-back confirmation after a write must read the exact target cell directly** (e.g. `master-prospects!BI359`), never a row range like `B{row}:BI{row}` with an assumption that the last array element is the last column — the Sheets API trims trailing blank cells from a range read, so if the target column is blank the "last" element silently resolves to whatever the last *non-blank* column actually is, misreporting a successful blank-out as if it wrote something else (hit live 2026-07-28, logged in EXECUTION-LOG.md).
4. Run it (`npx tsx ./check_tmp.ts`), then **delete the temp file** — these are one-off scripts, never committed.
5. **Any write** (new column, edited cell, merged/deleted row) gets logged in [EXECUTION-LOG.md](EXECUTION-LOG.md) the same way code changes are — what changed, why, and what method/scoring/reasoning drove it. Never silently drop or overwrite existing evidence in a cell; when merging duplicate rows, fold both sources' content together (same principle as golden rule #3).

## Self-learning mechanisms

This repo learns from mistakes and encodes corrections so they don't recur:

1. **Playbooks** (`docs/outreach-copy-playbook.md`, `docs/tier2-reenrichment-playbook.md`) — built from real failure modes; each rule traces back to a specific session where doing it wrong caused rework.
2. **Memory files** (`~/.claude/projects/.../memory/`) — persistent cross-session memory for user preferences, feedback, and project context that isn't derivable from code.
3. **EXECUTION-LOG.md** — the full decision history. Every deviation from spec, every Tej directive, every bug found and fixed. Read it when you need to understand *why* something is the way it is.
4. **Golden rules in AGENTS.md** — each one traces to a real production incident or data-plane risk. They are not hypothetical.
5. **Source Type cache** (`src/promote/source-type-cache.json`) — the Promotion Agent's learned mappings, committed so they persist across deploys.
