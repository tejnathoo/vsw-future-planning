# Organizational-goals enrichment model

**Scope:** how organizational goals get researched, stored, and turned into outreach copy.
Answers Andrew's 2026-07-09 11:00 ask ("use some A.I. to prepare those goals and add them to
the spreadsheet, in a way that can be easily added to the messaging").

**Companion doc:** [outreach-copy-playbook.md](outreach-copy-playbook.md) owns the research
method and the clause grammar gate. This doc owns the *schema* and the *definition of done*.
Neither replaces the other.

**Revised 2026-07-20** per Tej: no confidence-status column (accuracy is the baseline, not a
tracked state), no date column, add VSW Alignment, add draft linkage.

---

## 0. The finding that shapes everything below

**The enrichment model already exists and is proven.** Columns `Their Initiative (→[initiative])`,
`Their Goal (→[goal])`, and `Personalization Source` were built 2026-07-15 and are populated on
**29 rows** — 29 of 32 Tier 1. Those 29 rows already produced the Tier 1 drafts sitting with
Andrew for sign-off.

So the answer to "what format should we use" is not a new schema. It is: **keep the format, add
four columns, and run the Tier 2 batch.**

Verified against the live sheet 2026-07-20: 393 org rows, 73 columns, header row 2.
Tier 1 = 32, Tier 2 = 53, Tier 5 = 3, untiered = 305.

### Gaps found in the live sheet

| # | Gap | Evidence |
|---|-----|----------|
| 1 | **The agent has no stored reason-for-reaching-out, so it invents one.** | Nothing in the sheet tells a drafting agent *why this org fits VSW*. `Why Them` is a budget-qualification note and is unverified. → `VSW Alignment`. |
| 2 | **No LinkedIn-length variant is stored.** | Email clauses overflow the 300-char connection note, so the render script improvises a hook each run — unreviewed, unsourced, different every time. 12 of 53 Tier 2 rows route to LinkedIn. → `LI Short Hook`. |
| 3 | **Drafts are unlinked from the rows that produced them.** | No way to get from a tracker row to its draft, and no record of which template/sender a row was assigned — the A/B data Andrew asked for on July 9. → `Draft Link`, `Draft Variant`. |
| 4 | **Formula gaps on late-added rows.** | **Planet Food** (row 135, blank), **Osler** (row 244, `#REF!`), **AngelList** (row 371, blank) have broken `Outreach Route` and can never go Ready. |
| 5 | **A wrong-domain clause is live in Tier 1.** | Rhino Ventures was researched against `rhinoventures.com` (an unrelated healthcare-leadership org). The real site is **`rhinovc.com`**. Corrected in §6. |

---

## 1. Recommended columns

**Four new columns, two of them machine-written.** Insert the two hand-authored ones
(`VSW Alignment`, `LI Short Hook`) next to the existing personalization block; put the two
render-written ones (`Draft Link`, `Draft Variant`) after `Ready?`. Resolve everything by header
name at run time — never by letter.

### `VSW Alignment`
- **Purpose:** the *anti-hallucination* field. Gives a drafting agent the stored, human-approved
  reason this org fits VSW so it doesn't improvise one. **Its text is never pasted into a message** —
  it sets theme and tone. Andrew's templates already contain the fixed alignment sentence
  (*"those priorities line up strongly with the community that participates in our events each
  year"*); this column tells the writer what to make that sentence *mean* for this org, and how to
  pitch the relationship.
- **Type:** free text, 1–3 sentences. End with a tone directive.
- **Example** (Rhino Ventures): `Vancouver-based, 10 years and 3 funds, portfolio includes Thinkific, Klue, Article and Aspect Biosystems — deep local roots and their next Producer-business operators come from exactly VSW's founder audience. Tone: peer-to-peer with an established local investor, not an introductory pitch.`
- **Required:** yes for Tier 1–2. Optional below.
- **Excluded:** VSW's own boilerplate, anything already in the template, and sponsorship-ask
  language. If a sentence would be equally true of every prospect, it doesn't belong here.

> This is the column that makes AI drafting safe to scale. Everything else constrains *facts about
> them*; this constrains *what we claim the connection is*.

### `LI Short Hook`
- **Purpose:** the ≤50-char phrase filling Andrew's LinkedIn `[specific initiative/campaign]` or
  `[goal]` slot inside a 300-char connection note. Stored and reviewed, not improvised at render.
- **Type:** short text, ≤50 chars, no trailing period.
- **Example:** `your Producer Businesses thesis` (Rhino) · `AI Ascent` (Sequoia) · `Fund V` (Version One)
- **Required:** only when `Outreach Route` = `LinkedIn`.
- **A/B rule:** when the hook is a **named program**, the row takes LinkedIn variant **A** (which asks
  for an initiative); when it's a **goal phrase**, variant **B**. Balance A/B across the LinkedIn
  cohort as a whole rather than forcing it per row — preserves Andrew's A/B test with one column.

### `Why Us (→[why])` *(added 2026-07-29)*

- **Purpose:** the *reciprocity* field. Every other column in this model constrains facts about
  **them**; this one states what **they get**. The 2026-07-29 audit found the emails make no
  specific claim of value to the recipient anywhere — they say who we are, that we noticed the
  prospect, and ask for twenty minutes. Eight sends, zero replies.
- **Why it belongs in the sheet rather than being improvised at render:** it is a claim about
  what VSW will deliver, made to a real company. It gets reviewed once and reused, exactly like
  the clauses. Improvising it per render is how an unreviewed promise reaches a prospect.
- **Type:** one sentence, ≤45 words, intended for the message body (unlike `VSW Alignment`,
  which is never quoted).
- **Authored from:** the fit memo's **top-ranked ROI candidate**, matched to an audience row in
  [vsw/vsw-sponsor-value.md](vsw/vsw-sponsor-value.md) §5, grounded in a fact from its §1–§3.
  The memos have always ranked these candidates by evidence quality. That ranking was the single
  most valuable output of the whole research process and it had nowhere to go.
- **Example** (Accenture): `You're hiring across engineering and delivery in Vancouver right now,
  and the room is 45% founders and company principals with talent matchmaking built into the week.`
- **Excluded:** generic exposure claims, any attendee figure without its timeframe (§0 of the
  value doc), and any promise of a tier, price, or deliverable — no tier structure exists yet,
  by design.
- **Required:** Tier 1–2. Strongly wanted on Tier 3.
- **Blank is a valid answer.** If no honest reason exists, leave it blank and put why in `Notes`.
  A prospect with no real reason to sponsor is a tiering problem, not a copywriting problem.

### `Draft Link` *(written by the render script — never by hand)*
- **Purpose:** row → its draft, in one click.
- **Type:** URL. Google Docs deep link to that draft's heading:
  `https://docs.google.com/document/d/1Op9…/edit#heading=h.<headingId>`. The Docs API returns
  `headingId` on each `HEADING_1` paragraph the render creates, so this is captured during the
  existing render pass — no extra work.
- **Required:** auto.

### `Draft Variant` *(written by the render script — never by hand)*
- **Purpose:** records what was actually assigned, which is the A/B data Andrew asked for on
  July 9 and Tej committed to on July 10 ("template A/B, from account"). **Currently missing from
  the sheet entirely.**
- **Type:** short text, `<template> · <sender>`.
- **Example:** `Email A · chair@` · `Email B · community@` · `LinkedIn A · Viv`
- **Required:** auto.

### On storing draft body text — don't

The draft body stays **derived**, composed at render time from the columns. Reasons: a
multi-paragraph email in a spreadsheet cell is unreadable; stored copy silently goes stale the
moment a clause is corrected; and it breaks the property that fixing one clause fixes every draft
using it. The link plus the variant give full traceability without the duplication.

### Retired

`Potential Mutual Value` (H) and `Programming Angle` (I) are **0 % populated across all 393 rows**.
`VSW Alignment` is what they were reaching for. Leave them or delete them, but stop counting them
as part of enrichment.

### Final field set

| Column | Earns its place by | Authored by |
|---|---|---|
| `Their Initiative (→[initiative])` | feeding template slot 1 | human |
| `Their Goal (→[goal])` | feeding template slot 2 | human |
| `Why Us (→[why])` | stating what they get — the reciprocity slot | human |
| `LI Short Hook` | feeding a slot at LinkedIn length | human |
| `VSW Alignment` | constraining the agent's framing | human |
| `Personalization Source` | traceability | human |
| `Outreach Route` | routing | **human (dropdown)** — see 2026-07-21 update below |
| `Ready?` / `Named Contact?` | routing | formula |
| `Draft Link` / `Draft Variant` | draft traceability + A/B | render script |

`Ready?` is unchanged in spirit but now also guards against a blank route:
`=IF(OR($BT3="",LEFT($BT3,7)="Blocked"),FALSE,AND($BO3<>"",$BP3<>""))`.

### 2026-07-21 update: `Outreach Route` is now manual, not a formula

Per Tej: he wants the route to be a deliberate, visible decision he (or a delegated agent) makes
per row — both a personal checklist ("this is ready to draft against") and a guarantee to anyone
else reading the sheet ("this is the route we chose," not "the route a formula picked" when a row
had more than one workable option. The formula's classification logic didn't go away — it's now
the human's checklist instead of an opaque IFS.

- Converted to a **strict dropdown**. ⚠️ **Corrected 2026-07-29** — the enum originally written
  here (`Email — personal`, `Email — shared inbox`, `LinkedIn`, `Blocked — no route`…) **was
  never applied to the live column** and its presence in this doc generated a batch of false
  "invalid route value" findings across the Tier 2 memos on 2026-07-22. Read against the live
  data validation, the real values are: `Email (Personal)`, `Email (Work)`, `Email (Work,
  Secondary)`, `Email (Generic Inbox)`, `Email (Work, Unverified Format)`, `LinkedIn DM`,
  `LinkedIn DM (Secondary)`, `Warm via Andrew`, `Warm via Viv`, `Warm via Holden`, `Warm via
  Tej`, `Contact Form`. **The live validation is the authority; this list is a convenience copy
  and can go stale again — re-read it before relying on it.**
- **Seeding:** rows already at `Drafted — awaiting approval` or later (30 rows — a real draft
  already exists against that route) kept their formula-computed value as the starting manual
  value. Every other row (363) was left **blank** — Tej chooses each one deliberately rather than
  inheriting the formula's pick.
- The "a script advances `Status` for values 1–5 on every run" mechanic described below was never
  actually a live/scheduled process — `scripts/advance-status.ts` already existed as an on-demand
  script (dry run by default, `--write` to apply). Nothing changed there; it reads `Outreach Route`
  by header name and doesn't care whether the column is a formula or typed text.

---

## 2. Accuracy: enforced by the run report, not a column

**Accuracy is the baseline, not a tracked state.** There is no confidence or verification column.
Every row that carries a clause is expected to be right; rows that aren't get **flagged in the run
output** for Tej to fix by hand.

The critical property: **the report is recomputed from the data on every run, never stored.** A
flag can't be missed once and lost forever — if a row still trips a check, it appears again next
run. Nothing to maintain, nothing to go stale.

### What every enrichment run must flag

| Check | Trips when |
|---|---|
| **No named initiative** | the scrape returned null for `signatureProgram` — the clause risks being boilerplate |
| **Entity mismatch** | the scraped page's title/description doesn't reference the org name — the Rhino failure, caught automatically |
| **Locality claim** | the clause asserts a company/office is Vancouver/BC — never trust the extractor on this |
| **Non-own-domain source** | `Personalization Source` host ≠ the org's domain |
| **Dated claim** | clause contains a year or month — re-confirm before sending |
| **Grammar gate** | the playbook's run-on / double-your / "focus on" checks |
| **Name↔contact mismatch** | contact name inconsistent with the email or LinkedIn URL on the row |
| **Past VSW sponsor** | the `VSW` column is checked — must not get cold "we've been following you" copy |
| **Blank clauses on a tiered row** | researched but no hook found, or not yet researched |
| **No `Why Us`** | a row at `Enriched`+ with no stored ROI thesis — the message can only say "we noticed you" |
| **`Why Us` boilerplate** | a short generic exposure/visibility claim that would fit any prospect |
| **LI hook repeats the org name** | stutters against the template ("ATCO's work on ATCO EdgeWorks") |
| **LI hook trailing period / verb** | must be a bare noun phrase to drop into the template slot |

Each check now carries a **severity**. `block` means a documented hard rule was violated and
`assertClean()` refuses the write outright; `warn` means a human has to look, and covers the
heuristics with real false-positive rates (locality, name↔contact mismatch) plus facts that change
the *strategy* rather than the copy (past VSW sponsor). Full definitions in
`scripts/enrichment-gate.ts`.

**Tradeoff, stated plainly:** dropping the date column means the sheet cannot answer "how old is
this research." Freshness becomes a per-run check on *dated claims only*. That's fine at Tier 1–2
scale where research and sending happen within days. It gets weaker if drafts sit for months —
if that happens, revisit.

**The "no hook exists" case** (e.g. ENTAX, where the site yields nothing specific): leave the
clauses blank so `Ready?` stays FALSE, and put the reason in `Notes` — a column that already
exists and is populated on 133 rows. That stops it being re-researched every run without adding a
status field.

### Research standard

Method is [the playbook's](outreach-copy-playbook.md) deep-scrape section — mandatory, not
restated here. Acceptance bar:

**Source hierarchy** (stop at the first tier yielding a specific named thing):
1. The org's own **program / fund / initiative page** — the target.
2. The org's own **newsroom or press release** — good for recency; check the date.
3. The org's own **strategy page or annual report** — good for goals, weak for initiatives.
4. The org's **homepage** — fine for `[goal]`, rarely enough for `[initiative]`.
5. Third-party coverage — **only** to locate something, never as the cited source of a fact.

**How many sources:** **one** is enough if it's on their own domain and names the thing. Depth beats
breadth — the failure mode here is vagueness, not insufficient corroboration. Add a second only when
the first is third-party or the org is a namesake risk.

**Strategic priority vs. boilerplate** — the *substitutability test*: if the sentence would be equally
true of three competitors, it's boilerplate. `supporting early-stage entrepreneurs across their whole
business lifecycle` is banned. `Focused exclusively on efficiently scaling Producer businesses` is
not substitutable and is exactly right.

**Never invent specificity to hit the bar.** A specifically wrong fact in a cold email is worse than
a generic one. Live examples: `Why Them` claims KPMG runs a Startup Innovation Lab (that lab is in
**Cyprus**); the extractor claimed Version One's portfolio company Ada is Vancouver-based (Ada is
**Toronto**); Rhino was researched against an unrelated org's website.

### Definition of `Enriched`

> A row is **Enriched** when `Their Initiative`, `Their Goal`, `VSW Alignment` and `Why Us` are
> filled, `Personalization Source` holds at least one URL on the organization's **own domain**, the
> composed sentence passes the grammar gate, and the row raises **zero blocking flags** in
> `scripts/run-report.ts` (warnings may remain, but each must have been looked at).
>
> `Ready?` flips TRUE on its own, provided a route exists.

`Enriched` is also a value in the single `Status` lifecycle (§8), and it is **auto-advanced** off
`Ready?` — never hand-typed. `Ready?` stays the one enrichment gate; the status just reflects it.

⚠️ **Amended 2026-07-30, Tej's explicit call, not yet reconciled with the rest of this section.**
The `Status → Enriched` auto-advance (both `scripts/advance-status.ts` and the live Apps Script
trigger in `scripts/apps-script-sticky-milestones.gs`) now checks **only** `Their Initiative` +
`Their Goal` filled — it no longer consults `Ready?` or `VSW Alignment` at all. The bar stated
above (Route + `VSW Alignment` + `Why Us` + on-domain source + grammar gate + clean run-report)
is still the real definition of *quality* enrichment and still what `scripts/run-report.ts`
checks — it's just no longer what flips `Status`. Consequence: a row can now show `Status =
Enriched` while `Ready?` still reads FALSE (no route yet, or `VSW Alignment` blank). Treat
`Status = Enriched` as "the two template slots exist," not as "ready to draft" — check `Ready?`
directly for the latter. Full incident writeup: EXECUTION-LOG.md, 2026-07-30.

---

## 3. Message-personalization workflow

| Stage | Where it lives | Rule |
|---|---|---|
| **1. Raw evidence** | scratch JSON (never the sheet) | Firecrawl JSON-extract off the org's own domain: signatureProgram, localHighlight, recentMilestone, distinctiveLine, focusAreas. |
| **2. Concise goal** | `Their Goal` | Their distinctive stated priority, **in their own words**, short. A plain noun-list "and" is fine. |
| **3. Initiative / proof point** | `Their Initiative` | **One noun phrase. No internal " and ".** A specific named thing. No "focus on". No dollar figures. |
| **4. Alignment rationale** | `VSW Alignment` | Why this org fits VSW + a tone directive. Context for the writer; never quoted into a message. |
| **4b. ROI thesis** | `Why Us` | What *they* get, in one sentence, **intended for the message**. From the memo's top-ranked ROI candidate + a fact in `docs/vsw/vsw-sponsor-value.md`. |
| **5. Traceability** | `Personalization Source` | URL(s) on their own domain, `\|`-separated. Never write a clause you can't put a source next to. |
| **6. Email sentence** | *composed at render, not stored* | `We've been following {ip} and your focus on {goal}.` where `ip = init.startsWith("your") ? init : "your work on " + init`. |
| **7. LinkedIn phrase** | `LI Short Hook` | ≤50 chars, fills the LinkedIn slot inside the ≤300-char note. |
| **8. Draft record** | `Draft Link`, `Draft Variant` | Written back by the render script. |

**The factual/persuasive boundary is the render step.** Steps 2–5 are research and live in the
sheet. Step 6 is copy and is *never* stored — recomputed every run. That's what lets a reviewer read
`Their Initiative` next to `Personalization Source` and verify a message against its source at a
glance. `VSW Alignment` sits deliberately on the research side of that line: it's an approved
editorial constraint, not copy.

---

## 4. Broad organizations — already solved, formalize it

The sheet's existing answer is right: **the sub-entity gets its own row.** Live today — SFU appears
as four rows (`Simon Fraser University`, `SFU Beedie School of Business`, `SFU Innovates`,
`SFU VentureLabs`), UBC as two, BC's government as several.

**Do not add a `Parent Org` column.** Outreach goes to a person in a unit; the unit has the goal and
the budget, the parent has neither. The dedup engine's known pitfalls confirm the units must stay
distinct — `entrepreneurship@UBC`, `Innovation UBC`, and bare `UBC` are different targets and must
never merge.

**Rule:** if the goal belongs to a department, program, or business unit, **split the row** and
enrich the unit. Enrich the parent only if the parent itself is the sponsor.

This is the standing instruction on the three blocked Tier 1 rows. `Province of British Columbia`
carries Andrew's own note: *"Province of BC is too broad, you'll need to find multiple contacts /
ministries / departments that might be relevant."* Same for `Vancouver Economic Commission` and
`Coast Capital Venture Connection`. All three are blocked on **routing**, not enrichment.

---

## 5. Enrichment depth by tier

| Tier | Depth | Fields |
|---|---|---|
| **Tier 1** (32) | Full deep scrape, hand-authored clauses. | All five human fields. |
| **Tier 2** (53) | Same standard — current batch, sends next. | All five. |
| **Tier 3** (50) | ⚠️ **"Spot-review ~20%" was tried and rejected.** See the correction below. Full standard, same as Tier 1–2. | Initiative, Goal, Source, Alignment, `Why Us`. `LI Short Hook` once routed. |
| **Tier 4** (next 100) | Batch scrape + AI-drafted clauses, then the run report over 100% of rows. Hand-authoring only where the report flags. | Initiative, Goal, Source, Alignment. Skip `LI Short Hook` until routed. |
| **Tier 5 / untiered** (~160) | **Nothing until tiered.** | — |

**Do not enrich the long tail.** By the time Tier 3 is reached, A/B results will have changed what a
good hook looks like, and research done now will be stale and possibly aimed at the wrong thing.
Andrew's own framing supports this — the A/B test is meant to inform the next 200 messages.

### 2026-07-29 correction — the Tier 3 "spot-review 20%" plan did not survive contact

A background batch run against Tier 3 on 2026-07-27 produced enrichment on **8 of 50 rows**, and
Tej's spot-check on 07-28 rejected the output as "not clean enough to draft from" — the same gaps
Tier 1 and Tier 2 had. The visible failure was **WorkSafe BC**: an initiative containing two
`" and "`s (a guaranteed run-on), no `Personalization Source` at all, and no `VSW Alignment`.
Three documented hard rules, violated, and written to the sheet anyway.

Two root causes, both now fixed, and neither of them was "the model wasn't careful enough":

1. **The gate was advisory.** The grammar and sourcing checks lived only in the after-the-fact run
   report. Nothing refused a bad write. They now live in `scripts/enrichment-gate.ts` and every
   write script must call `assertClean()` before the API call.
2. **The run report had been blind for about a week.** It scoped rows on a column named
   `Outreach Tier`, which had been renamed to `Tier`; the filter matched nothing and it printed
   *"0 rows — every row clean."* 76 real flags were sitting on the sheet at the time. It now
   throws rather than reporting clean on an empty scope.

**The lesson generalizes past this tier:** sampling-based QA (review 20%, ship the rest) only
works when the 80% is produced by a process that cannot emit an invalid row. Put the invariants in
the write path, then sample for *judgment* — tone, strategic fit, whether the hook is the right
one — which is the thing a human actually adds and a regex never will.

**How Pass A actually runs now:** [enrichment-pass-a-playbook.md](enrichment-pass-a-playbook.md) —
a standing 5-at-a-time batch operation (`scripts/next-enrichment-batch.ts` selects the next
eligible orgs, 5 parallel agents enrich them against this gate, `run-report.ts` verifies the whole
tier, `advance-status.ts` lets `Status` catch up). Trigger with "enrich the next batch of Tier N."

---

## 6. Worked example — Rhino Ventures (corrected)

**This one is real.** Deep-scraped from `rhinovc.com` on 2026-07-20, replacing the Tier 1 row that
was researched against the wrong domain.

**What the real site says:** *"Scaling Producer Businesses."* 10 years, 3 funds, 35 companies,
$700M+ portfolio revenue, 12 exits. Producer businesses = healthcare, wealth & planning, advisory
& brokerage. Explicit differentiator: *"Long-term partners, not exit manufacturers."* Footer:
*"Investing out of Vancouver in exceptional companies across Canada."*

| Field | Value |
|---|---|
| **Their Initiative** | `your Producer Businesses thesis` |
| **Their Goal** | `being a long-term partner rather than an exit manufacturer` |
| **VSW Alignment** | `Vancouver-based, 10 years and 3 funds, portfolio includes Thinkific, Klue, Article and Aspect Biosystems — deep local roots and their next Producer-business operators come from exactly VSW's founder audience. Tone: peer-to-peer with an established local investor, not an introductory pitch.` |
| **Personalization Source** | `https://rhinovc.com/` |
| **LI Short Hook** | `your Producer Businesses thesis` (30 chars → LinkedIn variant **A**) |

**Composed sentence:** *"We've been following your Producer Businesses thesis and your focus on
being a long-term partner rather than an exit manufacturer."*

Gate: no " and " in the initiative ✓ · no "focus on" in the initiative ✓ · starts with "your" so no
double-your ✓ · "Producer Businesses" is their own proprietary term, fully non-substitutable ✓ · no
dollar figures ✓

**Two things the corrected research turned up that aren't clause material:**

1. **Candace Hobin** runs *"portfolio-wide initiatives including founder events, resources, and
   partnerships"* — that is precisely the sponsorship contact, and the row currently has no named
   contact. LinkedIn is on the site. **Recommend adding her as Primary Contact.**
2. **Aspect Biosystems is in Rhino's portfolio and is itself a Tier 2 target.** A live cross-reference
   worth noting on both rows.

⚠️ **The existing clauses on that row are wrong and should be replaced**, not just re-sourced. They
read `your early-stage Western Canada funds` / `backing founders building in Western Canada` — a
generic VC framing that misses the Producer-businesses thesis entirely and doesn't match what the
firm actually says about itself. Pull Rhino from the drafts doc before Andrew signs off.

### The other archetypes

> Format shown; **not researched in this session** — do not paste. The material available was
> `Why Them`, which is unverified. The 29 Tier 1 rows are the real calibration set.

- **Straightforward private company — `Ada CX`:** one company, one domain, one named program off
  `ada.cx`. The $130M Series C is a milestone, not an initiative. ~10 minutes.
- **University — `SFU`:** don't enrich `Simon Fraser University`. Enrich `SFU VentureLabs` (Tier 2,
  writes real cheques as an NVBC Bronze sponsor) off the VentureLabs site, not sfu.ca. Parent row
  stays blank with a note — SFU-the-university isn't the sponsor.
- **Government / Crown — `WorkSafe BC`:** initiative = the named funding stream; goal = mandate
  language, which for public bodies is genuinely stated and stable. Easiest category to source well,
  easiest to make sound generic — insist on the named program. ⚠️ Past VSW sponsor (2019) → needs a
  re-engagement opener, not cold copy. Same for DVBIA, Sparkbridge, ENTAX, Alacrity, BC Tech,
  TransLink, Boast.
- **Large company, several priorities — `Amazon`:** apply the tiebreak — pick the priority closest to
  founders/startups/Vancouver → AWS startup programs, not retail or logistics. Two cautions: a
  **separate `AWS` row in Tier 1 already uses `AWS Activate`**, so check for collision; and that AWS
  row has a known **name↔contact mismatch** (listed "Tara Wallace", LinkedIn URL is Olga Kuzina's).
  Runner-up priority goes in `Notes`.
- **No verifiable goal — `ENTAX`:** `Why Them` says plainly that research surfaced nothing beyond
  generic content. Clauses stay blank, reason goes in `Notes`, `Ready?` stays FALSE, and it routes to
  a **renewal ask on the existing relationship** (sponsor in 2020 and 2021) instead of cold copy. The
  right outcome isn't a weaker clause; it's a different message.

---

## 7. Implementation plan

> **Status as of 2026-07-20: Steps 0–3 and 5's tooling are DONE and live in the sheet.**
> See PLAN.md's 2026-07-20 Execution Log entry for exactly what was written.
> **Step 4 — the Tier 2 research batch — has not been started.** 52 of 53 Tier 2 rows are
> unenriched.
>
> **Tooling now in `scripts/`** (run with `npx tsx`):
> - `scripts/run-report.ts [tier]` — the §2 accuracy checks. Recomputed every run, never stored.
> - `scripts/advance-status.ts [--write]` — derives Status 1–5. Dry-run by default.
> - `scripts/tracker.ts` — shared helpers; resolves columns by header name and rows by org name.

**Step 0 — fix the three broken rows (5 min).** ✅ **DONE** — AngelList, Osler, Planet Food repaired;
zero broken routes remain. Fill `Outreach Route` / `Ready?` / `Named Contact?`
down over Planet Food (135), Osler (244), AngelList (371). Until this is done those Tier 2 rows
can't go Ready no matter how well they're enriched. AngelList is also missing Category and
`Why Them` entirely.

**Step 1 — schema (30 min).** ✅ **DONE.** Add `VSW Alignment` and `LI Short Hook` after `Personalization
Source`; add `Draft Link` and `Draft Variant` after `Ready?`. Apply the §8 dropdown to `Status`
(col A), move the one stray `Stage` value into `Notes`, and delete `Stage` (col BC). No formula
changes. Verify the route formulas still resolve after the inserts.

**Step 2 — fix and backfill Tier 1 (~45 min).** ✅ **DONE** — Rhino corrected from `rhinovc.com` (old clauses preserved in `Notes`); `VSW Alignment` on all 29; `LI Short Hook` on all 12 LinkedIn rows. Candace Hobin surfaced as the likely Rhino contact but **not written** — awaiting Tej.
1. **Rhino Ventures: replace both clauses** with the corrected §6 values, update the source to
   `rhinovc.com`, and add Candace Hobin as Primary Contact. Pull it from the drafts doc.
2. Write `VSW Alignment` for the other 28 enriched rows — the fastest path is a batch AI pass
   proposing one per row from the existing clause + `Why Them`, then Tej edits. This is the one
   backfill with real volume.
3. Add `LI Short Hook` for the 11 LinkedIn-routed Tier 1 rows.

**Step 3 — `Why Them` stays put.** ✅ Untouched, as intended. Untouched by all of this. It remains the qualification note it is
(388 of 393 rows) and feeds tiering, not messaging. **Do not migrate it into the clause columns** —
it's unverified and sometimes wrong. There's no migration to perform, which is the point: the new
columns sit alongside the old rather than replacing them.

**Step 4 — Tier 2 batch (~1 day).** ⬅️ **NEXT — not started.** 52 of 53 rows unenriched.
1. Resolve domains for all 53. Hand-check the namesake traps — `Accelerate Fund`, `Angel Forum`,
   `Planet Food`, `TECHTO`. The sheet has already been burned by Kensington, Valhalla, **Rhino**,
   City of Vancouver, and TransLink; assume more.
2. One batch Firecrawl JSON-extract, results to scratch JSON. **Surface API errors loudly** — never
   collapse a 400 into "0 results."
3. Hand-author `Their Initiative` / `Their Goal` / `VSW Alignment` from that JSON. Not automatable
   to a shippable standard; this is where the quality comes from.
4. Run the enrichment run report (§2) over all 53. Fix what it flags.
5. Write to the sheet keyed by **Organization Name**, never row number.
6. Flag past-VSW-sponsor rows for re-engagement copy rather than cold.

**Step 5 — render, write back, review.** Regenerate the drafts doc; capture each draft's `headingId`
and write `Draft Link` + `Draft Variant` back to the sheet in the same pass. Then run the playbook's
Definition of Done — read the doc back, count drafts against `Ready?=TRUE`, assert zero run-ons,
assert every LinkedIn note ≤300 chars, check each opener's name against its `To:` line, and confirm
every rendered row got a link written back.

**Step 6 — defer.** Tier 3+ enrichment, broad-org splits beyond the three blocked Tier 1 rows, and
the fate of `Potential Mutual Value` / `Programming Angle`.

---

## 8. The single `Status` lifecycle

One column, one dropdown, every row. **Use `Status` (column A)** — leftmost, already holds
`Archived` on 3 rows, and is where the eye lands. **Retire `Stage` (column BC)**: it holds exactly
one value across 393 rows, and that value (`Emailed July 15 to be scheduled out next week
post-Fifa`) is a note, not a stage — move it to `Notes` and delete the column. Two half-used
lifecycle columns is the problem; this fixes it.

### The 16 values

| # | Value | Means | Set by |
|---|---|---|---|
| 1 | `Sourced` | Org is in the sheet. Nothing else done. | auto |
| 2 | `Contact identified` | A named person found. | **auto** — `Named Contact?` |
| 3 | `Route identified` | A usable email or LinkedIn path exists. | **auto** — `Outreach Route` |
| 4 | `Enriched` | Clauses + alignment + source, run report clean. | **auto** — `Their Initiative` + `Their Goal` filled (⚠️ narrowed 2026-07-30 from `Ready?`, see the amendment above §2's Definition of `Enriched`) |
| 5 | `Drafted — awaiting approval` | Draft rendered into the doc, sitting with Andrew. | render script |
| 6 | `Revisions requested` | Andrew commented; ball is back with Tej. | human |
| 7 | `Approved` | Signed off, cleared to send. | human |
| 8 | `Sent` | Message went out. | human |
| 9 | `Bounced` | Undeliverable — needs a new address, not a follow-up. | human |
| 10 | `Reply received` | They responded. | human |
| 11 | `In conversation` | Active back-and-forth. | human |
| 12 | `Meeting booked` | The 20-minute call is on the calendar. | human |
| 13 | `Won — sponsor confirmed` | Terminal. The point of all of this. | human |
| 14 | `Declined` | They said no. Terminal. | human |
| 15 | `No response — closed` | Follow-ups exhausted. Terminal. | human |
| 16 | `Archived` | We decided not to pursue. Terminal. Already in use. | human |

### The mechanic that makes this work: states 1–5 advance on request

**As of 2026-07-21, `Outreach Route` is a manual dropdown, not a formula** — see the update above.
`Named Contact?` and `Ready?` are still live formulas.

`scripts/advance-status.ts` derives `Status` for values 1–5 from whatever's currently in the sheet
(`Named Contact?`, `Outreach Route`, `Ready?`, `VSW Alignment`, `Draft Link`) — it reads by header
name, so it works the same whether `Outreach Route` is a formula or typed text. It is **not**
scheduled or live; run it by hand (`npx tsx scripts/advance-status.ts --write`) whenever you want
`Status` to catch up. From `Revisions requested` onward the states depend on human judgment or an
external event, so those are typed and the script never touches them.

The script only ever advances a row **forward through 1–5**, and never touches a row already at 6+.
That way a human decision downstream is never overwritten by a re-run.

⚠️ **Validate the value in code before writing** — Google Sheets `strict` validation does *not*
block API writes (confirmed empirically; the cell just gets a warning triangle). Same rule that
governs Category and Source Type.

### Stages I'd add beyond your list — and why

- **`Revisions requested`** — without it, a draft Andrew commented on is indistinguishable from one
  he hasn't opened. Different person is blocked in each case.
- **`Bounced`** — a bounce isn't "waiting for a response," and the fix is a new address, not a
  follow-up. On cold outreach at this volume you will hit these.
- **`Meeting booked`** — Andrew's entire call-to-action is the 20-minute conversation, and his
  July 9 note lists meeting-booked as a tracked outcome. It's the real conversion event.
- **`Won — sponsor confirmed` / `Declined` / `No response — closed`** — your list stops at "in
  conversation," which leaves no way to answer *how many sponsors did we land*. Three distinct
  terminal states, because "no" and "silence" need different retrospectives.

### Stages I deliberately left out

- **`Follow-up sent`** — ambiguous at the second follow-up, and `Last Touch Date` +
  `Next Follow-up Date` already carry it. A row stays `Sent` until something changes.
- **`Blocked — no route`** — exactly duplicates the `Outreach Route` formula. Filter on the route
  instead; the row just sits at `Contact identified`.
- **`Not a fit`** — overlaps `Archived`, which is already in use. One terminal "we passed" is enough.

### One open branch: warm routes

Rows routed `Warm — via <person>` don't fit cleanly. Andrew's instruction is that warm messages get
handwritten in the relationship-holder's own voice, so those rows skip the draft/approve path and
wait on Viv, Andrew, or Holden — an internal person, not the prospect. Between `Enriched` and `Sent`
there's a real state the enum can't express.

**Recommendation: don't add a value yet.** Only a handful of rows are affected (2 in Tier 2), and
`Owner` + `Notes` cover it for now. If warm outreach becomes a meaningful share, add
`Handed to warm contact` as #17 — but earn it with volume first.

### Automatable vs. manual

| Automatable | Manual (Tej) |
|---|---|
| Domain resolution, batch scrape, JSON extract | Namesake adjudication |
| The full run report (§2) — every check | Clause and alignment authoring |
| Grammar gate, `Ready?`, route formulas | Acting on flagged rows |
| Doc render, `Draft Link`/`Draft Variant` write-back | Canadian-relevance check on global brands |
| Read-back assertions, char counts | Name↔contact mismatch adjudication |
| `Status` advance through values 1–5 (§8) | `Status` from `Revisions requested` onward |

AI does the **gathering** — where the leverage is across 53 orgs, and what Andrew actually asked for.
A human does the **choosing**. Inverting that is what produced the first pass Tej rejected.

---

## 9. `overview-stats` — the pipeline metrics tab

Built 2026-07-20. All **live formulas** against `master-prospects`, so it is always current
and never needs refreshing. Re-run `scripts/build-overview-stats.ts` only to change the layout.

### Layout (rebuilt 2026-07-20 for stage/phase legibility)

| Block | What it answers |
|---|---|
| ① **PIPELINE** | Vertical. Stage on the left, its phases as indented sub-rows, counts by tier across. The at-a-glance view. |
| ② **COHORT OUTCOMES** | *What happened to everyone who ever reached a stage.* The key analytical block — see below. |
| ③ **SUMMARY BY TIER** | Compact partition grid. **The reconciliation check.** |
| ④ **PHASE CUTS** | Overlapping views (Sent & waiting, Response received, Conversation active). Deliberately do NOT sum. |
| ⑤ **CUMULATIVE** | Ever-sent / ever-replied / ever-met, plus reply and meeting rates. |
| ⑥ **DRILL-DOWN** | Two dropdowns (status + tier) and the organizations themselves list out beneath. |

### The model: 5 stages, 4 exits, and phases that cut across

The **5 macro stages are the forward path** an organization walks:

| Stage | Statuses |
|---|---|
| 1. Sourcing | Sourced · Contact identified · Route identified · Enriched |
| 2. Writing | Drafted — awaiting approval · Revisions requested |
| 3. Initial outreach | Approved · Sent · **Bounced** |
| 4. In conversation | Reply received · In conversation |
| 5. Initial meeting | Meeting booked |

The **4 terminal outcomes are exits from that path**, not stages on it, because a row can
drop out at any stage: `Won` · `Declined` · `Ghosted` · `Archived`.

Together these are a strict **partition** — every org counted exactly once, always summing to
the full list. That is blocks ① and ③, and the number to trust when things look off.

**Phases are overlapping cuts** and deliberately do *not* sum. They answer deliverability
questions: of what we sent, how much bounced, how much came back, how much went through and
stayed silent. Block ④, kept in its own table precisely so the overlap can't corrupt ①.

### Cohort outcomes — attributing a result back to the stage it came from

The question "of the deals that reached an initial meeting, how many did we win, how many fell
back to conversation, how many terminated?" cannot be answered from `Status`, because a meeting
that later declined now reads only as `Declined`.

**The sticky checkboxes encode furthest-stage-reached**, which is what makes this computable:
`Sent?` = reached Initial outreach · `Replied?` = reached In conversation ·
`Meeting Booked?` = reached Initial meeting. Block ② crosses each cohort against current status:

```
REACHED STAGE 5 · INITIAL MEETING          ← cohort = Meeting Booked? TRUE
      · Still at meeting booked
      · Back in active conversation
      · → Won / → Declined / → Ghosted / → Archived
```

Each cohort's sub-rows **partition** that cohort — every member lands in exactly one bucket, so
they sum to the cohort total. That is the invariant to check if the numbers ever look wrong.

### The sticky-milestone mechanic

`Status` is a **current state**, so it cannot answer "how many meetings have we booked." A row
that books a meeting and then wins sits at `Won`, and the meeting vanishes from the count.
Cumulative "reached ≥ stage N" logic does not fix it either — a row that was sent, replied, then
declined sits at `Declined`, and the path it took is gone.

So four **sticky checkbox columns** on `master-prospects` — `Sent?`, `Bounced?`, `Replied?`,
`Meeting Booked?` — are set once and never cleared. Block ③ counts these, so every cumulative
figure stays correct as rows move on, and reply/meeting rates come out for free.

Why four rather than just `Meeting Booked?`: the deliverability questions in block ② cannot be
computed without `Sent?`, `Bounced?`, and `Replied?`. "How many emails went out" is the
denominator of every rate on the tab, and it is exactly the number `Status` loses first.

**Automation:** `scripts/apps-script-sticky-milestones.gs` is an installable onEdit trigger that
ticks the right boxes whenever `Status` changes. **Tej must paste it in** (Extensions → Apps
Script) — a service account cannot install Apps Script. Instructions are in the file header. It
resolves columns by header name, never by letter, and includes a `backfillFlags()` for rows whose
status predates the trigger. Until it is installed the checkboxes work fine by hand; nothing
else breaks.

One deliberate conservatism: `Won` does **not** infer `Meeting Booked?`. If the row passed
through `Meeting booked` the flag is already set; inferring it from `Won` would invent meetings
for any row jumped straight to the end.

### Follow-up due / issued — added 2026-07-28, without touching `Status`

Tej wanted visibility into who's owed a follow-up and whether he's caught up, surfaced through
the same block ④ phase cuts + block ⑥ drill-down dropdown he already uses. The §8 decision above
(`Follow-up sent` deliberately left out of `Status` — ambiguous by the 2nd follow-up, and it would
stop `Status` being a clean partition) still holds; this is the phase-cut mechanism that decision
pointed at, actually built out:

- **`Follow-up Due?`** (`master-prospects` col BX, live formula) — `TRUE` when `Status = Sent` AND
  `Last Touch Date` is filled AND 2 business days have elapsed (`WORKDAY(Last Touch Date, 2) <=
  TODAY()`). The interval is Andrew's own instruction, 2026-07-22 Slack thread: "follow-up emails
  two to three business days later" — triggers at the 2-day start of that window. Self-resetting:
  bump `Last Touch Date` on any follow-up sent and the clock restarts, so a 2nd or 3rd follow-up
  needs no new state, unlike a `Status` value would.
- **`Follow-up Sent?`** (col BY, sticky checkbox, same "set once, never cleared" mechanic as
  `Sent?`/`Bounced?`/`Replied?`/`Meeting Booked?`) — ticked by hand when Tej issues any follow-up.
  Answers "ever caught up at least once," which is what "did I issue all the follow-ups" actually
  needs — a cumulative reached-milestone count, not a per-attempt one.
- **`overview-stats` block ④** gained two phase rows, `Follow-up due` (`COUNTIFS` on `Status=Sent`
  AND `Follow-up Due?=TRUE`) and `Follow-up issued` (`COUNTIF` on `Follow-up Sent?=TRUE`) — same
  "overlapping cut, does not sum" treatment as the rest of block ④.
- **Block ⑥ drill-down** dropdown gained `"Follow-up due"` and `"Follow-up issued"` as two synthetic
  options alongside the real 16 `Status` values. Rows under them still read `Sent` in `Status` — the
  dropdown's count/filter formulas special-case these two labels rather than doing a literal
  `Status` match. `scripts/build-overview-stats.ts` generates all of this; re-run it to rebuild the
  tab if the layout changes.

**Known limitation:** `Follow-up Sent?` is purely manual — there's no way to infer "a follow-up went
out" from anything else on the sheet (no inbox access from this environment), so it only works if
Tej actually ticks it.

### Two gotchas worth keeping

`SUM(COUNTIFS(range, {"a";"b"}, range2, x))` **silently returns only the count for `"a"`** —
Sheets does not broadcast an array criterion across a multi-criteria COUNTIFS. The first build
undercounted the pipeline grid by 136 rows and looked entirely plausible. Every multi-status cell
emits one explicit `COUNTIFS` per status, joined with `+`. **The reconciliation check is that
block ① TOTAL equals the org count** — if it doesn't, a formula is wrong, not the data.

**Formatting outlives values.** `spreadsheets.values.clear` wipes values but leaves cell
**formats**. Rebuilding the tab with a different layout dropped an old percent-formatted column
onto new content and rendered Untiered's `305` as `30500.0%`. The build now resets
`userEnteredFormat` and data validation across the whole sheet before re-applying its own.
