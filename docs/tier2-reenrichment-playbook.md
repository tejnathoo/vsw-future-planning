# Tier 2 deep re-enrichment — playbook

**Purpose.** The 2026-07-22 Tier 2 batch (PLAN.md's "Tier 2 enrichment batch — 20 orgs" entry,
plus later ad hoc adds) got every Tier 2 row to `Status = Enriched`: `Their Initiative`, `Their
Goal`, `Personalization Source`, and `VSW Alignment` all filled, `Ready? = TRUE`. That pass answered
"is there a clause here." It did not ask "is the clause still true, and is the underlying strategic
logic actually right." Three rows (Absolute Software, Accenture, Ada CX) got a second, deeper pass
that did ask that — and all three turned up real problems: a stale headquarters claim treated as
fact (Absolute), a personalization hook built on the wrong business unit (Accenture Ventures, which
has no local budget authority — Accenture the local office does), and a values in-flight test of
whether the "obvious" audience (VSW's founders) is actually the prospect's real buyer at all (Ada
CX — see its memo for the verdict). **This doc is that second pass, made repeatable.**

**Scope: Tier 2 rows already at `Status = Enriched`.** Rows still below that (not yet enriched at
all) go through the original enrichment workflow (`org-goals-enrichment-model.md` §7) first, not
this one. Rows already at `Drafted — awaiting approval` or later need a judgment call before
touching — see "Rows with a live draft" below.

---

## The recipe (what made the first three good, generalized)

Every deep re-enrichment agent should do all of these, not just the ones that happen to apply — the
value is in not knowing in advance which one will turn something up:

1. **Read the full current row before writing anything.** Every field, not just the enrichment
   columns — checkboxes, Source Link, contacts, Notes. Never rewrite blind.
2. **Try to falsify the current hook, don't just corroborate it.** The instruction to the agent
   should explicitly say "test whether this is still true," not "confirm this is true." All three
   real findings so far came from an agent that went looking for a reason the existing clause might
   be wrong, not one that went looking for supporting evidence.
3. **Verify HQ/ownership/leadership claims are current, not legacy marketing copy.** An org's own
   "About" page is not self-correcting — it can lag an acquisition, a take-private, a headquarters
   move, or a leadership change by years. Cross-check against LinkedIn's own field, Wikipedia's
   infobox, and press-release datelines, which update faster than static About pages (this caught
   Absolute's stale "global headquarters in Vancouver" claim — Seattle in every 2026-dated source).
4. **Verify named contacts independently, and flag thin sourcing.** A title confirmed by one
   third-party aggregator (RocketReach, ZoomInfo) is weaker than one confirmed by an independently
   dated, named activity (a conference appearance, a press quote). Flag personal-domain emails
   (gmail/yahoo/outlook) on a corporate contact — not necessarily wrong, but worth a second look
   before trusting the route.
5. **Cross-check event-partner checkboxes against the row's own prose — in BOTH directions.** A
   checkbox TRUE with nothing in `Why Them`/`Source Link` explaining why is a namesake-mismatch or
   data-entry-error candidate; a checkbox FALSE while the prose asserts that exact sponsorship is
   the same bug mirrored. Two confirmed recurring patterns from waves 1–2 (verify per row, don't
   assume the verdict):
   - **`CANSEC` = TRUE is row-specific, not systemic — audit each, never blanket-clear.** Confirmed
     phantom (zero supporting evidence) on Ada CX, RBC, Alumni Ventures, Aspect Biosystems — Ada's
     is a likely AC-ADA acronym collision. But confirmed *genuinely real* on **Dell** (logo on
     CANSEC's own 2026 sponsor page) and **Airbus** (CADSI Silver Sponsors page). So the fix is a
     per-row check against CANSEC/CADSI's own sponsor list, not a mass uncheck.
   - **`Inventures` = FALSE while `Why Them` claims an Inventures 2025 sponsorship** — confirmed the
     checkbox is the wrong side (should be TRUE) on Aon, Air Canada, ATB Financial, ATCO, and
     Foresight Canada, each verified against `inventurescanada.com/sponsors`' own 2025 list. If a
     row cites Inventures in prose, assume the checkbox is wrong until checked.
6. **Check whether the row is actually a returning VSW partner mislabeled as cold.** The `VSW`
   checkbox (and `Past VSW Event Partner`) drive whether outreach gets cold "we've been following
   you" copy or the playbook's re-engagement opener. Confirmed wrong-and-cold on **Angel Forum**
   (ran a VSW 2025 session) and **Foresight Canada** (`VSW`=FALSE but verified 2019 + 2023 sponsor
   against Tej's own past-sponsors data). If anything in `Why Them`/`Notes`/`Warm Lead Person`
   hints at prior VSW involvement, verify it — a past sponsor getting cold copy is a real
   relationship error, not just a clause nitpick. The `Warm Lead Person` set while `Warm Lead?` =
   FALSE is a related recurring inconsistency (Absolute, Angel Forum, Foresight) — restate it, do
   not resolve it unilaterally.
6. **Identify the org's real buyer/ICP and test whether VSW's founder audience is actually it.**
   This is the single highest-value check across all three memos so far. The "obvious" pitch — a
   company wants brand visibility with VSW's founders — was the *weakest* candidate for Absolute
   (enterprise IT/security buyer) and Accenture (Global 2000 consulting buyer). Don't assume it
   holds for the next org either way; find out. Explicitly weigh alternatives: talent/employer
   brand, community/ecosystem standing, deal-flow/M&A scouting, executive thought-leadership,
   direct pipeline — and for vendors whose product serves *companies* rather than *people*, weigh
   whether VSW's other sponsors (the larger companies who also show up as sponsors) are a more
   plausible buyer pool than the founder attendees themselves.
7. **Apply the substitutability test ruthlessly.** "Real sponsorship budget," "enormous marketing
   budget," "deep innovation budget" are boilerplate — true of any well-funded competitor, and
   explicitly banned by `org-goals-enrichment-model.md`. If a claim doesn't survive asking "would
   this be equally true of three competitors," cut it or make it specific.
8. **Detect parent/sub-entity conflation.** If `Why Them` leans on a fund, venture arm, or business
   unit with a name distinct from the row's own `Organization Name` (the Accenture/Accenture
   Ventures pattern), determine which entity actually holds local sponsorship-decision budget —
   usually the one with a named local contact — and write the row around that entity only.
9. **Test `LI Short Hook` by substituting it into Andrew's actual template, not just eyeballing it.**
   On LinkedIn-routed rows, mentally drop the hook into the real template slot and read the whole
   sentence. ATCO's `LI Short Hook` was "ATCO EdgeWorks caught my eye" — which rendered as a
   double-predicate collision ("...ATCO EdgeWorks caught my eye really stood out"). The hook must be
   a bare noun phrase ("ATCO EdgeWorks"), ≤50 chars, no trailing period, no verb. Also watch the
   stutter the playbook already bans for email ("AWS's work on AWS Activate") — it recurs on
   LinkedIn ("ATCO's work on ATCO EdgeWorks") when the hook repeats the org name; strip the org name
   from the hook.
10. **Watch for wrong-region program examples.** Several rows cite a real program that's the wrong
    geography for a Canada pitch — Aon's "Startup Conclave" (India), Accenture's Founder Institute
    tie (2013 Brussels), Dell's "Entrepreneur Challenge/YourStory" (India). A real program in the
    wrong country is still a substitutability/relevance failure — flag it.
11. **Cite everything, flag what can't be verified, never invent specificity.** Own-domain source
    preferred; third-party only to locate or corroborate. A specifically wrong claim is worse than an
    honest thin one — this project's standing rule.

**Cross-reference note:** several rows are portfolio/parent links to *other* tracker rows — Accelerate
Fund is staffed entirely by **Yaletown Partners** (a separate Tier 2 row, already drafted); Aspect
Biosystems is a **Rhino Ventures** portfolio company (a Tier 1 row). When a row turns out to be the
same organization as, or a portfolio company of, another tracked prospect, flag it so the two aren't
pursued with uncoordinated asks.

---

## The two-step process per org

### Step 1 — generate the org snapshot (mechanical, do this first, every time)

```bash
npx tsx scripts/build-reenrichment-brief.ts "Exact Organization Name"
```

Read-only. Dumps every non-blank field on that org's live row, plus a handful of automated
pre-flight flags (personal-domain contact email, boilerplate phrases in `Why Them`/`VSW Alignment`,
an event-partner checkbox that's TRUE with no textual corroboration nearby, a possible
parent/sub-entity name conflation). **The flags are heuristics, not verdicts** — they tell the
research agent where to look first, they don't replace the agent actually checking. Paste the
script's output into the prompt template below in place of `{{ORG_SNAPSHOT}}`.

### Step 2 — launch one Agent per org with the filled-in template

```
You're doing strategic sponsor-fit research for Vancouver Startup Week (VSW), a founder-facing
event organization. Tej (VSW) wants a deep re-enrichment on one prospect: **{{ORG_NAME}}** — going
well beyond the existing spreadsheet clauses into a real strategic-fit and ROI analysis. This is
research-only: produce a written memo, do NOT touch the live Google Sheet.

## Background you need

**What VSW is:** Vancouver Startup Week — a founder/entrepreneur-facing event series/community in
Vancouver's tech ecosystem. Current site copy: "Five days. 85+ events. Thousands of founders,
builders, and supporters coming together to move the ecosystem forward." VSW's audience includes
founders, investors, operators, and talent-seekers (vanstartupweek.ca/about-us names talent
matchmaking explicitly). VSW's sponsor roster itself includes large, established companies
(Absolute Security, Accenture, RBC, Amazon, TELUS, EA, SAP among others) — the room at a VSW event
contains BD/exec people from those companies too, not only early-stage founders. Keep this in mind
for any prospect whose product/service is sold to companies rather than individuals.

Read `docs/org-goals-enrichment-model.md` and `docs/outreach-copy-playbook.md` in this repo (path:
`/Users/tejnathoo/Desktop/Tej Nathoo/vsw-future-planning/docs/`) for the research method, tone
standards, and the substitutability test. Read `docs/tier2-reenrichment-playbook.md`'s "recipe"
section for the specific checks this pass exists to run. For calibration, skim the memos already
written for other prospects in `docs/*-vsw-fit-research.md` (Absolute Security, Accenture, Ada CX)
— match their structure, rigor, and honesty level. **All three found the "obvious" framing was
wrong or overstated in some way. Go in expecting to find something, not to confirm what's already
in the sheet.**

## Current row (live-read, do not trust beyond this — verify anything load-bearing)

{{ORG_SNAPSHOT}}

## What to actually research

Deep-scrape the org's own domain first (own-domain source required for at least one
`Personalization Source` URL to count as sourced). Work through the numbered recipe in
`docs/tier2-reenrichment-playbook.md` systematically: verify HQ/ownership/leadership currency,
verify named contacts independently, check event-partner-checkbox consistency, identify the real
buyer/ICP and test whether VSW's founder audience (or VSW's other sponsors) is actually it, apply
the substitutability test to every claim in the current `Why Them`/`VSW Alignment`, and check for
parent/sub-entity conflation. Rank whatever ROI candidates you find by evidence, most to least
plausible — don't default to generic "brand visibility."

## Output

Write `docs/{{ORG_SLUG}}-vsw-fit-research.md` in the repo
(`/Users/tejnathoo/Desktop/Tej Nathoo/vsw-future-planning/docs/`), same structure as the three
existing memos: headline finding up front if there's something stale/wrong to flag, dated,
"research only — nothing written to the sheet" stated clearly, every claim cited to a URL, ranked
synthesis section, and a short "if you wanted to act on this" section with 3-5 concrete suggestions
for what could change in the tracker's clauses. Do not write to the Google Sheet, do not create/edit
any other files, do not commit to git.

Report back with a concise summary (under 250 words) of what you found and the file path when done.
```

`{{ORG_SLUG}}` = the org name, lowercased, spaces→hyphens, matching the existing
`absolute-security-vsw-fit-research.md` / `accenture-vsw-fit-research.md` / `ada-cx-vsw-fit-research.md`
naming.

---

## After the memo lands — applying it

**Do not auto-apply.** Every application so far (Absolute, Accenture) happened only after Tej
reviewed the memo and gave an explicit go-ahead, and at least once (Accenture) that review changed
the outcome — Tej decided the row should represent the local office, not the venture arm the memo's
top-ranked hook was built on. Read the memo, decide what actually gets written, *then* apply.

When applying: resolve the same six columns by header name — `Why Them`, `Their Initiative
(→[initiative])`, `Their Goal (→[goal])`, `Personalization Source`, `VSW Alignment`, `LI Short Hook`
(only if `Outreach Route` = LinkedIn) — via a throwaway `.ts` script (the `sheets.spreadsheets.values.update`
pattern already used for Absolute/Accenture), verify every write by reading the cell back, delete
the script, and log the change in `PLAN.md`'s Execution Log at the same level of detail as the
2026-07-22 Absolute/Accenture entries — what changed, why, what evidence drove it, and what was
deliberately left untouched (open flags get restated, not silently resolved).

## Rows with a live draft (`Drafted — awaiting approval` or later)

Five Tier 2 rows are already past `Enriched` and sitting with Andrew for review: **A100, Northleaf
Capital Partners, The Syndicate, Vanedge Capital, Yaletown Partners**. Re-enriching these is higher
stakes than the plain-`Enriched` rows — correcting the tracker clause without also pulling/updating
the live draft leaves the two out of sync (the exact situation the Rhino Ventures correction in
`org-goals-enrichment-model.md` §6 had to fix after the fact: *"Pull it from the drafts doc before
Andrew signs off"*). Research these the same way, but **hold the sheet-write step and flag it to Tej
explicitly** rather than applying automatically, so the drafts doc can be corrected in the same pass
if anything material changed.

## Rows out of scope for this pass

**Metro Vancouver** (row 220, `Status = Route identified`) — deliberately not enriched.
`docs/broad-org-department-research.md` already concluded there's no genuine initiative at the
whole-government level; the real content lives on the separate `Invest Vancouver` row. Re-running
this pass on it would just re-derive the same already-documented conclusion.
