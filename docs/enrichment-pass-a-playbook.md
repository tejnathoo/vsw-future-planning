# Pass A enrichment — playbook (batch, 5 at a time)

**This is the first-pass enrichment method** (`org-goals-enrichment-model.md`'s Pass A) as a
standing, repeatable batch operation. Trigger: *"enrich the next batch of Tier N"* /
*"run enrichment on Tier N."*

**Precondition per org:** already tiered, already has a route (`Status` at `Route identified` or
later). This playbook does not select or route orgs — that's upstream, human-decided work.

**Boundary — this playbook stops before drafting.** An agent running this template writes
enrichment fields to `master-prospects` and nothing else. It never touches the Docs API, never
composes a full email, never sets `Status` past what `Ready?` derives. Drafting is
`outreach-copy-playbook.md`'s job, triggered separately, after Andrew/Tej have reviewed the
enrichment output.

**Companion doc:** [tier2-reenrichment-playbook.md](tier2-reenrichment-playbook.md) is Pass B —
heavier, adversarial, one memo per org, for rows that need a second look after Pass A. Don't run
Pass B where Pass A hasn't landed yet.

---

## The batch loop (what to actually do when Tej says "go")

1. **Select.** `npx tsx scripts/next-enrichment-batch.ts "Tier N" 5` — prints the next 5 eligible
   orgs (route identified, not yet enriched) as ready-to-paste snapshots, plus how many remain.
2. **Spawn 5 agents in parallel — one message, five `Agent` tool calls, `subagent_type:
   general-purpose`.** Each call gets the template below with `{{ORG_NAME}}` and `{{ORG_SNAPSHOT}}`
   filled from step 1. Run in parallel, not sequentially — the whole point of batching is that one
   org's Firecrawl call doesn't block another's.
3. **Wait for all 5, read every report.** Each agent returns what it wrote and what it blocked on
   (see "Report back," below).
4. **Verify the batch.** `npx tsx scripts/run-report.ts "Tier N" --blocking` — must be zero
   blocking flags across the whole tier, not just the 5 just-written rows. A gate bug or a
   mis-filled `RowView` in one agent can still slip past that one agent's own self-check.
5. **Let `Status` catch up.** `npx tsx scripts/advance-status.ts --write` — `Ready?` flips
   automatically per row, but `Status` (values 1–4) only advances when this runs.
6. **Report to Tej, short:** N written clean, N blocked (and on what check), N flagged for
   judgment (locality, name↔contact, past-VSW-sponsor), how many rows remain in the tier.
7. **Repeat from step 1** until `next-enrichment-batch.ts --count` returns 0, or Tej says stop.

Five is the batch size because it matches how every prior batch in this project has actually been
run (see EXECUTION-LOG's Tier 1/2 batches — "one agent per org," "10 agents, 2 orgs each") and
keeps a single batch's failures cheap to review. Nothing about the number is load-bearing; say a
different size if a tier calls for it.

---

## The per-org agent prompt

```
You're doing first-pass sponsor-fit enrichment for Vancouver Startup Week (VSW) on one prospect:
**{{ORG_NAME}}**. This is Claude-Code-session work against the live Google Sheet — the src/
non-negotiables in AGENTS.md do not apply (see CLAUDE.md's carve-out) — but the sheet is real and
live, so verify everything before you write to it.

## Read first, in this order

1. `docs/vsw/vsw-sponsor-value.md` — what VSW actually offers. §0 has the correct attendee-figure
   framing (5,000+ per week/year is correct, cite it that way). §5 is the audience-fit table
   you'll match this org against for `Why Us`.
2. `docs/outreach-copy-playbook.md` — the research method (deep-scrape THEIR own domain, never
   open-web search for facts) and the clause grammar gate.
3. `docs/org-goals-enrichment-model.md` — the schema for every field below and the substitutability
   test.

All paths are relative to `/Users/tejnathoo/Desktop/Tej Nathoo/vsw-future-planning`.

## Current row (live-read, do not trust beyond this)

{{ORG_SNAPSHOT}}

## What to produce

Deep-scrape {{ORG_NAME}}'s own domain (Firecrawl `/v2/scrape`, JSON-extract format, per the
playbook's method — API key in `.env` as `FIRECRAWL_API_KEY`). Resolve the domain from a
known-big-org map or the contact email's domain; fix known namesake domains by hand if you
recognize one. From that scrape, author:

1. **`Their Initiative (→[initiative])`** — one named thing (a program/fund/cohort/event), one
   noun phrase, no internal " and ", no "focus on", no dollar figures.
2. **`Their Goal (→[goal])`** — their distinctive stated priority, in their own words, short.
3. **`VSW Alignment`** — 1–3 sentences: why this org fits VSW + a tone directive. Never quoted
   into a message — it's framing for whoever drafts later.
4. **`Why Us (→[why])`** — ONE sentence: what THIS org gets from VSW. Match it to a row in
   `vsw-sponsor-value.md` §5, ground it in a real fact from that doc's §1–§3 (the 45%-principals
   figure, the 696-organizations figure, or a named format). Must fail the substitutability
   test in their favour — if it would be equally true of any prospect, it's boilerplate, cut it.
   Never promise a tier, price, or deliverable (none exist yet, by design). If no honest answer
   exists, leave it blank and say why in `Notes` — that's a valid outcome, not a failure.
5. **`LI Short Hook`** — only if `Outreach Route` is a LinkedIn value. ≤50 chars, bare noun
   phrase, no trailing period, must not repeat {{ORG_NAME}}'s own name (stutters against the
   template: "X's work on X Y").

Apply the substitutability test to all four fields, not just `Why Us`: `Their Initiative` and
`Their Goal` fail it just as easily.

## Tone pass — required, not optional

Fetch the **Stop Slop Guide** live from Notion (page id `5d33c81d-b930-419e-8557-41fbb4ec7629`) —
never from memory or a cached copy. Run it over the composed sentence
(`We've been following {ip} and your focus on {goal}.`) and over `Why Us`. Watch especially for:
no em dashes, no binary contrasts ("not X, it's Y"), no vague declaratives ("the opportunity is
real") — that last one is the most likely failure mode for `Why Us` specifically. If either
sentence scores under 35/50 on the guide's rubric, rewrite it.

## Gate check — before you write, not after

Build the values you're about to write into an object shaped like `RowView` in
`scripts/enrichment-gate.ts` (org, initiative, goal, alignment, whyUs, source, route, liHook,
contactName, email, linkedin, vsw). In your throwaway write script, `import { checkRow,
assertClean } from "./enrichment-gate"` and call `assertClean(checkRow(proposed))` immediately
before the `spreadsheets.values.update` call. If it throws, the values have a real defect — fix
them, don't work around the check. Warnings (not blockers) are fine to write past, but note them
in your report.

## Write

Throwaway `.ts` file in the repo root (not `/tmp`), service-account auth per CLAUDE.md's pattern,
columns resolved by header name, row matched by Organization Name (re-verify immediately before
writing — rows get re-sorted). Write `Their Initiative`, `Their Goal`, `VSW Alignment`, `Why Us`,
and `LI Short Hook` (if applicable) and `Personalization Source`. **Read every written cell back
by its exact address** (e.g. `BO187`), never a row range. Delete the temp script after.

## Boundary — stop here

Do not render a draft. Do not touch the Docs API. Do not hand-set `Status` — `Ready?` derives
automatically from what you just wrote, and `Status` catches up separately via
`scripts/advance-status.ts`, run once per batch, not per org.

## Report back (under 200 words)

Org name. Written or blocked (name the blocking check if blocked). The `Why Us` sentence you
landed on and which audience row it matches. Any warning-level flags left for a human. The
source URL(s).
```

---

## After a tier is fully enriched

Enrichment ends at `Status = Enriched`. Drafting is a separate, explicit step — hand off to
`outreach-copy-playbook.md`'s render process, which Tej triggers when he's ready to have drafts
generated for review, not automatically the moment enrichment finishes.
