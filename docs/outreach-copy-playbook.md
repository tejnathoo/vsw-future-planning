# Outreach-copy playbook (sponsor cold outreach)

**When Tej gives you company names + a contact person, this is the runbook.** It turns
`(company, person)` pairs into personalized draft emails/LinkedIn notes in a Google Doc for
Andrew's review, sourced from the live tracker. This is Claude-Code-session work (research +
copy + direct sheet/doc writes), **not** deployed-service code — the `src/` non-negotiables in
AGENTS.md do not constrain it (see CLAUDE.md's carve-out). The habits that *do* carry over:
resolve columns by header name (never a hardcoded letter — Tej reshuffles live), key rows by
Organization Name (never a row number — Tej re-sorts), dry-run then verify every write, never
bury a cell's existing content, and log every write to PLAN.md's Execution Log.

## The one-line trigger

> "Draft outreach for: Acme (Jane Doe), Beta Corp (John Smith), …"

For each pair, run the loop below. Tej is the authority on the contact person — if the name he
gives differs from the sheet, use his and note it. If he gives an email/LinkedIn/title too,
update the contact fields (his explicit direction; log it). Then research → write clauses →
render the doc → report routes + any blockers + the doc link.

## Fixed artifacts

- **Spreadsheet** `1GZ0dvzz_ODdJ3Cd9jKfmPZtOjI-_w5f-LEDvT-ecDaQ`, tab `master-prospects`,
  header row **2**, data from row **3**. Auth = the throwaway-`.ts`-via-`npx tsx` +
  service-account pattern in CLAUDE.md.
- **Delivery Google Doc** `1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk`
  ("Future Planning - Outreach Drafts"), **owned by `tej.nathoo@vanstartupweek.ca`**, shared to
  the service account (`vsw-future-planning@vsw-future-planning.iam.gserviceaccount.com`) as
  Editor. Scope `https://www.googleapis.com/auth/documents`.
  - **The SA cannot create Google-native files** — its Drive storage quota is 0, so
    `documents.create`/HTML-import fail with a quota error. Only ever *write into* this
    Tej-owned doc. If a new doc is needed, Tej creates it and shares it Editor; never try to
    make the SA own one.
- **Andrew's templates** live in the Notion page "Thread with Andrew"
  (`38e6b6f2b95b8068b183c49d924e5906`): **Email A, Email B, LinkedIn A, LinkedIn B**.
  Placeholders: `[First name]`, `[Company]`, `[specific initiative/campaign]`, `[goal]`,
  `[two time options]`. Use the templates **verbatim** except for the placeholders, the
  attendee figure, and normalizing Email A's mixed `-`/`•` bullet markers.

## Tracker columns this workflow owns

Resolve these by header name every run (letters drift; these were BP–BU when created
2026-07-15):

- `Their Initiative (→[initiative])` — one clause, drops verbatim into `[specific initiative/campaign]`.
- `Their Goal (→[goal])` — one clause, drops verbatim into `[goal]`.
- `Why Us (→[why])` — **added 2026-07-29.** One sentence: what *this* organization gets from VSW.
  The only field in the tracker that faces our side of the trade rather than theirs. Authored
  from the fit memo's top-ranked ROI candidate + a real fact out of
  [docs/vsw/vsw-sponsor-value.md](vsw/vsw-sponsor-value.md). See "The `Why Us` sentence" below —
  it has its own bar and its own failure modes.
- `Personalization Source` — the URL(s) backing the two clauses, `|`-separated. Never write a
  clause you can't put a source next to.
  - **Before treating this field as blank, read the full row width.** A truncated column range
    (e.g. stopping at `AZ` instead of the sheet's actual last column) will show earlier fields as
    blank while missing later ones entirely — this caused a false "no source" read on the
    Freehouse row 2026-07-30 when a real source was sitting in a column past the truncated range.
    Read headers and data with a range wide enough to cover every enrichment column
    (`A2:CZ2`/`A3:CZ600` as of 2026-07-30 — reconfirm the true last column if it drifts) before
    concluding any field is empty.
  - **Exception, by standing approval (2026-07-30):** if Tej supplies the research material
    directly in chat and explicitly instructs writing the clause without a source URL, skip
    re-asking — write with `assertClean(flags, { allow: ["NO SOURCE"] })` and log the override in
    EXECUTION-LOG.md same as any other deviation. This does not relax the rule for
    agent-initiated research; it only covers the case where Tej is the one supplying and
    approving the material in the moment.
- `Outreach Route` — **manual dropdown, Tej's call** (converted from formula 2026-07-21 — see
  Execution Log). ⚠️ **The live strict validation is the authority, and it is NOT the enum this
  doc used to list.** Verified against the live column 2026-07-22 and again 2026-07-29, the real
  values are: `Email (Personal)`, `Email (Work)`, `Email (Work, Secondary)`, `Email (Generic
  Inbox)`, `Email (Work, Unverified Format)`, `LinkedIn DM`, `LinkedIn DM (Secondary)`,
  `Warm via Andrew`, `Warm via Viv`, `Warm via Holden`, `Warm via Tej`, `Contact Form`. The old
  `Email — personal` / `LinkedIn` list in this doc was never applied to the sheet and caused a
  batch of false "invalid value" alarms across the Tier 2 memos — **read the live data validation
  before trusting any enum written down anywhere, including here.** Blank means "not yet decided" —
  don't draft off a blank route. This is the row's single source of truth for which channel to
  write for; when a row has more than one workable option (e.g. both an email and a LinkedIn
  URL), the dropdown value is the decision, not a suggestion to re-derive from the raw contact
  fields.
- `Named Contact?` — **formula**, TRUE when Primary Contact Name is a real name (not blank, not `[`).
- `Ready?` — **formula**, TRUE when Route is non-blank and isn't Blocked AND both clauses are
  filled. The doc renders only `Ready?=TRUE` rows, so filling the clauses (and setting the route)
  is what makes a row appear.

`Ready?` formula (per row): `=IF(OR($BT{row}="",LEFT($BT{row},7)="Blocked"),FALSE,AND($BO{row}<>"",$BP{row}<>""))` — column letters drift, resolve by header at run time.
`Status` no longer advances live off these formulas; run `scripts/advance-status.ts` (dry run by
default, `--write` to apply) whenever you want `Status` to catch up to a chosen route.

## Before researching them, know what we're offering

**Read [docs/vsw/vsw-sponsor-value.md](vsw/vsw-sponsor-value.md) first.** Until 2026-07-29 this
project held a great deal of verified detail about every prospect and almost nothing about VSW,
which is why the copy could say "we've been following your work on X" and could not say "and
here is what you'd get." That doc now carries the real audience composition (45% of titled 2026
attendees are founders, CEOs or owner/partners; 696 organizations represented), the five
differentiators, the attributable proof, and — importantly — an explicit list of what we still
cannot claim.

Two things from it that constrain every draft:
- **§0, the attendee figure.** 5,000 is a five-year cumulative number and must carry its
  timeframe. There is no support for a single-year 5,000 claim.
- **§4, there is no tier structure**, deliberately — defining the format is what this project is
  for. Do not imply a package exists. Frame being early as the offer.

## Research: deep-scrape the org's OWN site — this is the required method, not optional

This is the step that decides whether the copy reads like "we know you" or like a mail-merge.
The shallow way (open-web `/v2/search` for summaries) is what produced a first pass Tej rejected
as "reads like we just looked at their landing page." **Do the deep pass every time.**

**Do not personalize from the `Why Them` column, and do not personalize from an open-web search.**
Why Them is an internal qualification note ("this org has budget and spends it on events") and is
sometimes flat wrong (it claimed KPMG runs a Startup Innovation Lab — that lab is in **Cyprus**).
An open-web "recent news" search is a namesake minefield: "Valhalla" alone returns four unrelated
investment firms; "City of Vancouver" returns the Washington-state city; global firms surface
`en_us` pages. A *specifically wrong* fact in a cold email is worse than a generic one.

**Required per org — JSON-extract from their OWN domain** (a namesake cannot live on their own
site). Firecrawl REST v2, `Authorization: Bearer ${FIRECRAWL_API_KEY}` from `.env`:

```ts
POST https://api.firecrawl.dev/v2/scrape
{ url: "https://<ownDomain>/",          // homepage, or a known program/portfolio/about page
  onlyMainContent: true,
  formats: [{ type: "json", prompt:
    `This page belongs to <ORG> (a <CATEGORY>). Using ONLY what is explicitly on THIS page,
     return null for anything not present — never guess:
     (1) signatureProgram: a named program, fund, cohort, event, or initiative they run;
     (2) localHighlight: a specific named portfolio company / member / partner, esp. Vancouver/BC;
     (3) recentMilestone: the most recent concrete named announcement + date if shown;
     (4) distinctiveLine: one short phrase in THEIR words for what sets them apart (not boilerplate);
     (5) focusAreas: the specific sectors/stages they focus on.` }] }
```

Resolve the domain from a known-big-org map, else the contact email domain (skip
gmail/outlook/etc.); **fix known namesake domains by hand** (e.g. Kensington = `kcpl.ca`, NOT the
US-automotive `kensingtoncapital.com`). Batch all orgs in one script, save results to a scratch
JSON, then hand-author from that material.

`/v2/search` is now only for **finding** things (a domain, a contact person) — never the source of
a personalization fact. When you do search: send **exactly one** of `includeDomains` /
`excludeDomains` (both together 400s "Invalid request body"), and **surface API errors** — never
collapse a 400 into "0 results" (a silent one wasted a whole pass).

**Two rules the deep scrape does NOT exempt you from:**
- **Verify Canadian relevance** — global brands' pages still surface US programs (KPMG's Chapel
  Hill accelerator, EY's `en_us`). Keep the Canadian one.
- **Never trust the extractor's locality claim.** It said Version One's portfolio co "Ada" is
  "Vancouver, BC" — Ada is Toronto; the claim was dropped. Only assert a company is local if you
  independently know it (Trulioo ✓, ENVGO ✓). If a whole site resolves to the wrong entity
  (rhinoventures.com → an unrelated healthcare-leadership org), keep the clause modest and flag it
  NEEDS-VERIFY rather than inventing specificity.

## Writing the clauses — the sentence and its grammar gate

The clause fills two slots in one sentence, rendered as:

> We've been following **`<ip>`** and your focus on **`[goal]`**.

where `ip = [initiative].startsWith("your") ? [initiative] : "your work on " + [initiative]`.
**Always render "your work on X", never "[Company]'s work on X"** — the possessive breaks on
names ending in s ("Graphite Ventures's") and stutters when the initiative carries the org name
("AWS's work on AWS Activate"). The "your work on" form fixes both at once.

**Hard invariants (a clause that fails any of these does not get written):**
1. `[initiative]` is ONE noun phrase with **no internal " and "**, no appositive, no comma clause.
   This is the exact defect Tej caught: a compound initiative collides with the sentence's own
   "…and your focus on…" to make a three-"and" run-on. Failure that shipped once:
   `"Valhalla Angels, Western Canada's largest angel network, and your corporate finance work"`
   → "…work on Valhalla Angels, …, and your corporate finance work **and** your focus on…". Fixed
   to one named thing: `"Valhalla Entrepreneurs BaseCamp"`.
2. `[initiative]` contains no "focus on" (collides with the goal slot) and does not start with a
   word that would double-"your" after the render prefix.
3. `[initiative]` is a **specific named thing** — a program / fund / event / cohort (AWS Activate,
   Fund V, Founders Fund I, Innovation Growth Fund III, AI Ascent, The 50, AccelerateAB). Not a
   generic activity ("supporting early-stage entrepreneurs across their whole business lifecycle"
   is boilerplate every VC says and is banned).
4. `[goal]` echoes their **distinctive** stated priority in their own words; short. A single " and "
   here as a plain noun-list ("growth and innovation", "live and work") is fine — the run-on rule
   is about the *initiative* only.
5. **No dollar figures** anywhere (wallet-sizing).

**Run the gate in code before writing** — build the full sentence for every org and reject the
batch if any fails, e.g.:

```ts
const ip = init.startsWith("your") ? init : `your work on ${init}`;
const sentence = `We've been following ${ip} and your focus on ${goal}.`;
if (/ and /.test(init)) FAIL(org, "initiative has 'and' → run-on");
if (/focus on/.test(init)) FAIL(org, "initiative has 'focus on'");
if (/your work on your/.test(ip)) FAIL(org, "double-your");
// then eyeball each printed sentence — the gate catches structure, not tone.
```

If no safe, specific, verified hook exists (namesake unresolved, thin site), write a modest correct
clause and flag it NEEDS-VERIFY — never invent specificity to hit the bar.
- Write clauses to the sheet keyed by Organization Name. `Ready?` flips TRUE on its own.

**Run the gate in code, at write time, not afterwards.** `scripts/enrichment-gate.ts` exports
`checkRow()` and `assertClean()`. Build a `RowView` from the values you are *about* to write and
call `assertClean(checkRow(proposed))` before the API call — it throws on any blocking flag and
nothing gets written. This exists because the checks used to live only in the after-the-fact run
report, and WorkSafe BC was written with a two-`and` run-on initiative, no source, and no
alignment: three hard rules, all violated, all written anyway. An override needs an explicit
`{ allow: ["CHECK NAME"] }` and a line in EXECUTION-LOG.md.

## The `Why Us` sentence — our side of the trade

**Added 2026-07-29, because the audit found the emails make no specific claim about value to the
recipient at all.** Everything above constrains facts about *them*. This is the one field that
says what *they get*, and it is what turns "we noticed you" into a reason to reply.

Source it from the fit memo's **top-ranked ROI candidate** (the memos already rank these by
evidence quality — that ranking is the asset, and until now it died in a column that is never
quoted), matched to a row in [docs/vsw/vsw-sponsor-value.md](vsw/vsw-sponsor-value.md) §5, and
grounded in a real fact from §1–§3 of that doc.

**Construction:** `[their evidenced need] + [the specific VSW fact that meets it]`.

**Hard rules, same spirit as the clause gate:**
1. **It must fail the substitutability test in their favour** — the sentence should only be true
   because of something specific about *this* org. "Great exposure to Vancouver's tech community"
   is true of every prospect and is banned.
2. **A number from `vsw-sponsor-value.md`, or a named format, not both and not neither.** The
   45%-principals figure and the 696-organizations figure are the two strongest; the named
   formats (workshop, activation, speaking slot) are the alternative when the prospect's interest
   isn't audience-shaped.
3. **No attendee-count claim beyond what §0 of the value doc licenses.** The 5,000 figure is a
   five-year cumulative and must carry its timeframe. A single-year framing is not supported.
4. **Never promise a tier, a price, or a deliverable.** There is no tier structure yet — that's
   what this project is deciding. Being early is the offer; say that, don't invent a package.
5. **If no honest answer exists, leave it blank and put the reason in `Notes`.** A prospect with
   no real reason to sponsor is a tiering problem, not a copywriting problem. Inventing a benefit
   is the same failure as inventing a fact.

## The tone gate — Stop Slop, on prospect copy too

**This was missing entirely until 2026-07-29.** The Stop Slop Guide and the Voice System were
being applied to Slack messages to Andrew and never to the copy that goes to prospects. The only
gate on prospect-facing text was a regex looking for run-ons and dollar signs, which catches
grammar and says nothing about tone.

**Fetch both live from Notion every time — never work from a cached copy or from memory:**
- **Stop Slop Guide** — `5d33c81d-b930-419e-8557-41fbb4ec7629`
- **Tej Nathoo Voice System (Agent Reference)** — search Notion; used for internal comms, and for
  anything written in Tej's own voice rather than Viv's.

**Run it over:** the composed `We've been following…` sentence, the `Why Us` sentence, every
LinkedIn note, and any new external copy. **Not** over Andrew's template body — that is his
wording, used verbatim, and is not ours to slop-check.

The rules that bite hardest on this particular copy:
- **No em dashes.** Andrew independently arrived at the same instruction on 2026-07-29 ("replace
  all em dashes with colons"). Use commas or periods.
- **No binary contrasts** ("not X, but Y" / "isn't about X, it's about Y"). State Y.
- **No vague declaratives** — "the energy is real", "the talent is real", "the opportunity is
  significant". Name the evidence instead. This is the most likely failure mode for `Why Us`.
- **Cut adverbs and softeners** — really, truly, genuinely, simply, deeply.
- **Active voice with a named actor**, not "value is created" or "connections are made".
- Score the composed sentences on the guide's five dimensions; **revise anything below 35/50**.

⚠️ **A caution specific to this project.** The Stop Slop Guide is a *prose* guide written for
posts and essays. Cold outreach has conventions it does not cover, and a rule applied
mechanically can make a polite business email read as brusque. Use it to strip the tells, not to
rewrite Viv into a different person.

## Locked messaging decisions (Tej, 2026-07-15)

- **Attendee figure: `86 events` / `more than 5,000 people`.** Still flag it to Andrew — his own
  Template B says `[AD: please confirm this number]` against 3,000, and it's now had three values
  (3,000 / 10,000 / 5,000). It's a factual claim going to real companies; it stays flagged, top
  of the doc, until he confirms.
- **"Expanded VSW" is unapproved external language** (Tej's July-6 question to Andrew never
  answered). It's load-bearing in Email A. Keep Andrew's wording verbatim but flag it.
- **Senders = `chair@` and `community@`, both Viv.** A/B = 2 templates × 2 inboxes, all
  Viv-voiced ("I'm Vivian" / "Vivian Lago, Co-Chair"). Assign per row round-robin: Email A/chair,
  Email B/community, Email A/community, Email B/chair.
- **LinkedIn = a ≤300-char connection note** (Viv has no Premium/InMail; Andrew's LinkedIn A/B
  are 534/584 chars, unsendable as-is). The long pitch is what she sends after the request is
  accepted. Two short variants, A/B, from Viv's personal profile.
- **Route preference: personal email > shared inbox > LinkedIn** ("where it's both, go email").
- **Shared inbox openings:** address by first name if a named contact plausibly reads that inbox
  (e.g. a Director of Partnerships → `sponsorship@`); otherwise open without a name.
- **Times:** default to concrete next-week slots (a Tue + a Thu), always flagged "confirm against
  Viv's calendar" — never sent unverified.

**Andrew's copy revision (2026-07-23) — applies to every draft, past and future:**
- The call-to-action line, in both Email A and Email B (bulleted-ask or single-line-ask), collapses
  to one sentence: **"If you're open to it, we'd love to set up a brief call to chat about how our
  work can help you reach your organizational goals?"** This replaces Email A's whole
  "we would welcome a quick 20-minute conversation to learn:" + 4-bullet block, and Email B's
  "we'd love to set up a brief call to ask: how can our initiative…" line — same replacement text
  either way.
- **Delete two lines outright, no replacement:** the times-and-or-redirect line ("Would Tuesday …
  or is there someone on your team who's best to speak with about partnerships or engagement like
  this?") and the one-pager line ("Thanks for considering this. We're happy to send a one-pager …").
  The email now goes straight from the CTA sentence to "Best,".
- **LinkedIn connection note — new canonical text**, but Andrew's literal wording ("Hi [name], I'm
  Vivian, co-chair of an organization that for the last decade has attracted thousands of people
  each year to events in Vancouver's tech & innovation communities. [org name] stood out as a
  having great potential alignment. We're opening next year's program to larger partners, and would
  love to connect and hear how our work can help you reach your own organizational goals.") runs
  ~390-410 chars with real names/orgs substituted — over LinkedIn's 300-char connection-note cap
  (same constraint noted above). Compressed to preserve every substantive claim while fitting under
  300 for the longest real name/org combo in the tracker (287 chars worst case):
  > "Hi [name], I'm Vivian, co-chair of Vancouver's tech & innovation week — a decade of events,
  > thousands each year. [Org] stood out for its alignment. We're expanding next year to larger
  > partners and would love to connect and hear how our work can help you reach your goals."
  **This compression is a deviation from Andrew's literal text and needs his sign-off**, same as
  any new external copy — flag it, don't treat it as pre-approved.

## Data-hygiene checks before drafting (flag, don't guess)

- **Name ↔ contact mismatch:** verify the Primary Contact Name matches the email/LinkedIn on the
  row. Real cases caught: AWS row said "Tara Wallace" but the LinkedIn URL was Olga Kuzina's;
  a PwC email was attached to a Scotiabank row. When they disagree, **flag it to Tej and stop** —
  don't pick one.
- **Worklist notes are not data:** `[AD note: …]` / `[TN note: …]` / `[For Viv]` parked in the
  contact column are deliberate markers (an empty contact reading "look for their BD person in
  Vancouver"). The formulas already ignore `[`-prefixed cells — **never bulk-move these into
  Notes** to satisfy a merge. Only fix cells that are genuinely broken (transposed, name merged
  into title, an address buried in prose), and preserve the original text verbatim in Notes.
- **The Email column sometimes holds non-addresses** (a contact-form URL, a note). Route off the
  address, not the column.

## Rendering the doc

Rebuild a throwaway `.ts` that: reads the sheet, filters `Ready?=TRUE`, composes each draft from
the templates + clauses (Email A/B, shared-inbox opener, ≤300 LinkedIn note), and writes into the
delivery doc via the Docs API. **Read the doc back after writing** to confirm it landed — several
render bugs (below) were all caught that way, not by inspection.

**Canonical structure (per org tab) — the "Format" tab in Archive, sourced from the PwC draft, is
the ground truth. Read it back before assuming this description is still accurate; don't rebuild
from memory.** An earlier pass in this workflow built a 5-row table (To/Cc/Bcc/Subject/body-in-a-
cell) modeled on Graphite Ventures' tab — **Tej rejected that formatting (2026-07-23)** in favour
of the simpler structure below. Email tab layout, top to bottom:
1. `HEADING_1`: `"{Org} — Email {A/B} / {sender}@"`
2. blank paragraph
3. a 3-row × 2-col table: row 0 `To:` \| recipient address; row 1 `Subject Line:` \| subject text;
   row 2 `Additional Info` \| `Contact: {name} — {title}   |   Route: {route}   |   Tracker row {row}`
4. blank paragraph
5. the body, as **plain paragraphs directly in the tab** (not inside a table cell) — one paragraph
   per line, no blank spacer paragraphs between them, ending on "Best,"
6. `HEADING_2` "Personalization used" + `[initiative]`/`[goal]`/`source` lines

LinkedIn tab layout (unchanged, confirmed against The Syndicate's tab, authored by Tej): `HEADING_1`
title, `To:`/`Contact:` lines, `HEADING_2` "Connection note (n/300 characters)" + the note,
`HEADING_2` "Personalization used" + lines.

Render rules learned the hard way:
- **The full `[initiative]`/`[goal]` clauses overflow the 300-char LinkedIn note.** LinkedIn needs
  its own short hook/goal per org (≈≤50 chars), not the email clause. Assert every note is ≤300
  and print `n/300` in the doc; fix any straggler before finishing.
- **Match the opener to the actual recipient.** For `Email — personal (secondary)` the address is
  the *secondary* contact's, so greet the secondary contact by name, not the primary
  (PwC greeted "Alaina," while mailing Meaghan — wrong).
- **Shared-inbox opener:** greet the named contact by first name only if their title says they
  plausibly read that inbox (Director of Partnerships → yes; Office Manager / Intergovernmental
  Relations → no, open with "Hello,").
- **Past VSW sponsors** (check the `VSW` event column) should not get cold "we've been following
  you" copy — flag them for a re-engagement opener rather than sending cold.

## Definition of done — verify all of this by reading the doc back, before telling Tej it's ready

Render writes are cheap to get wrong and the two worst bugs this workflow has hit (a stripped
subject line, a wrong-recipient opener, LinkedIn overflow) were all invisible until a read-back.
Re-read the rendered doc and confirm, programmatically where you can:
1. Draft count matches the tracker's `Ready?=TRUE` rows; no duplicate org sections.
2. **Zero body run-ons** — no "We've been following…" sentence contains " and your " more than once.
3. **Every LinkedIn note ≤ 300 chars** (parse the `Connection note (n/300)` labels).
4. Every email draft has a `Subject:` line; every LinkedIn draft has a `Connection note`.
5. Each opener's first name matches the recipient the `To:` line actually goes to.
6. Front-matter flags present: attendee figure, "expanded VSW", every past-VSW-sponsor row, and
   any NEEDS-VERIFY rows.
7. **`npx tsx scripts/run-report.ts --blocking` returns zero blocking flags** for the tier you
   rendered. The report now refuses to run rather than reporting "clean" on an empty scope — if
   it throws about a missing tier column, fix that before believing any other check.
8. **No attendee-count claim without its timeframe**, per the value doc's §0. Grep the rendered
   doc for `5,000` / `5000` / `thousands` and confirm each one reads as multi-year.
9. **Every `Why Us` sentence names something only true of that org.** Read all of them in one
   sitting: if two prospects could swap sentences without either looking wrong, both are
   boilerplate and both get rewritten.

## Report back to Tej

Route tally, any name↔contact mismatches / NEEDS-VERIFY / blocked rows (with what's missing), and
the doc link.

## Re-engagement copy for past VSW sponsors (added 2026-07-20)

**Past sponsors must never get cold "we've been following you" copy.** Opening as though we've
just discovered an organization that already wrote us a cheque reads as though we forgot. Check
the `VSW` column; the run report (`scripts/run-report.ts`) flags these automatically.

The re-engagement variant **changes one paragraph only** — everything else in Andrew's Email A/B
stays verbatim, and it reuses the same `[initiative]` / `[goal]` / `LI Short Hook` tracker columns,
so no new fields are needed.

**Email — replaces the "We've been following…" paragraph:**

> `[Company]` supported Vancouver Startup Week in `[year]`, and that partnership meant a great deal
> to what we were able to put on. We've kept following your work on `[initiative]`, and your focus
> on `[goal]` lines up with our community as strongly now as it did then.

A re-engagement subject line also beats the cold one: `Reconnecting after [Company]'s support of
Vancouver Startup Week`.

**LinkedIn — re-engagement connection note (≤300 chars):**

> Hi `[First name]`, I'm Vivian, co-chair of Vancouver Startup Week. `[Company]` supported us in
> `[year]` and I'd love to reconnect. We've been following `[LI hook]`, and next year's edition is
> expanding to involve larger partners. Open to a quick chat?

**⚠️ This is new external copy and needs Andrew's sign-off** before it sends, same as his own
templates.

**Known gap:** the tracker records *that* an organization sponsored (the `VSW` checkbox) but not
*when*. `[year]` currently has to be read out of `Why Them` by hand. Fine for the two Tier 1 rows
affected; if re-engagement volume grows, that wants a `VSW Sponsor Year(s)` column rather than
prose-mining.
