# What VSW is worth to a sponsor — the value asset

**Created 2026-07-29.** This is the doc the enrichment process never had.

Until today, every research agent working a prospect knew a great deal about *them* and
almost nothing about *us*. The entire encoded understanding of VSW was a three-sentence
paragraph pasted inline in one prompt template. That asymmetry is why the outreach can say
"we've been following your work on X" and cannot say "and here is what you'd get" — the
second half had nothing to draw on.

**Everything in §1–§4 is sourced.** Where a number is contested, it says so loudly. The
project's standing rule holds: *a specifically wrong fact in a cold email is worse than a
generic one.*

**Companion docs, all now in `docs/vsw/`:** [brand-messaging-framework.md](brand-messaging-framework.md)
(voice, pillars, audience matrix), [vsw-differentiators.md](vsw-differentiators.md),
[objection-handling.md](objection-handling.md), [known-stats-vsw-2026.md](known-stats-vsw-2026.md),
[community-proof-linkedin-posts.md](community-proof-linkedin-posts.md),
[media-coverage-canada-now-2026-05.md](media-coverage-canada-now-2026-05.md).

---

## 0. The attendee figure — registrants vs. profiles, and why 5,000 is right

**Resolved 2026-07-29, per Tej.** 5,000+ is correct and is the number to use. Registrants and
attendees are two different figures — each week has drawn 5,000+ in attendance, and VSW
deliberately quotes that larger, more accurate number. What looked like a discrepancy is two
different things being measured, not an error in either.

| Figure | Value | What it actually counts |
|---|---|---|
| **Attendance / registrants (the figure in use)** | **5,000+** | Real week-of attendance — the number to quote |
| 2026 file in `impact-report/data/` | **1,043** | Whova **profile export** — only people who went on to build an in-app profile, a self-selected subset of registrants |
| Largest single year in the Whova *import* files | **1,788** (2023) | Same artifact — profile/import data, not a registrant total |

**What this means for this doc:** the Whova exports undercount attendance because they capture
app-profile completion, not registration or door count. They're still useful for §1's
*composition* analysis (title/org mix among whoever did build a profile) — just not as the
source of total attendance. This section is the resolution; a future pass shouldn't re-flag
1,043-vs-5,000 as a bug.

**Still open, separately:** the outreach playbook's "Locked messaging decisions" section notes
the exact figure has read 3,000 / 10,000 / 5,000 in different template drafts since July 15.
That's Andrew standardizing on one exact wording, not a question of whether 5,000 is
defensible — still flagged there for his sign-off.

**What is safe to say, today, with no further research:**

> ✅ "More than 5,000 people over the past five years."
> ✅ "85+ events and 250+ speakers in 2026." *(consistent across all sources)*
> ✅ "Over a decade running."
> ❌ "5,000 attendees at VSW 2026." — not supported by any file we hold.

Andrew's Email A ("attracting thousands of people to dozens of events over the course of one
exciting week") and Email B ("in 2026 hosted 86 events that attracted more than 5,000 people")
are both consistent with this — the per-week reading is the correct one, not an overstatement.

---

## 1. Who is actually in the room

Computed 2026-07-29 from `impact-report/data/2026/VSW2026 Attendees.csv` in `vsw-playground`
(1,043 profiles; 925 with a stated title, 997 with an organization).

### Seniority — the number that matters to a sponsor

| Segment | Count | % of those with a title |
|---|---|---|
| Founder / Co-founder | 264 | 28.5% |
| CEO | 79 | 8.5% |
| Owner / Partner / Managing Director | 74 | 8.0% |
| **Subtotal — company principals** | **417** | **45.1%** |
| VP / Director / Head of | 68 | 7.4% |
| Other C-suite (CTO/CFO/COO/CMO) | 41 | 4.4% |
| Manager / individual contributor | 103 | 11.1% |
| Student / intern | 58 | 6.3% |
| Engineer / Designer | 30 | 3.2% |
| Investor (explicitly titled) | 8 | 0.9% |
| Other / unclassified | 200 | 21.6% |

**The headline for a corporate prospect: roughly 45% of titled attendees are the person who
signs — founder, CEO, or owner/partner. Add VPs, directors and C-suite and it is ~57%.**
That is an unusually senior room for an accessible, community-priced event, and it is the
single most useful fact this project now holds about VSW.

*Method note: bucketed by regex over free-text titles, so "Other" (21.6%) holds real
job titles that didn't match a pattern, not blanks. Treat the percentages as ±2–3 points.
Investor is undercounted — investors commonly list "Partner" or "Managing Director" and land
in the principals bucket.*

### Breadth

- **696 unique organizations** represented in 2026 alone.
- **640 repeat attendees** across 2021–2026 — people who came back in a later year.
- Institutional presence includes UBC, SFU, Innovate BC, New Ventures BC, Alacrity Canada,
  ISED (Innovation Canada), Osler, Doane Grant Thornton, and Black Business Association of BC.

### Composition, per VSW's own positioning

Founders (heavily early-stage, explicitly including pre-idea and pre-seed), operators,
investors, accelerators, corporates, students, and talent-seekers. `vanstartupweek.ca/about-us`
names talent matchmaking explicitly. VSW's own sponsor roster — Absolute Security, Accenture,
RBC, Amazon, TELUS, EA, SAP — means the room also contains BD and exec people from large
companies, **which matters for any prospect whose product is sold to companies rather than
to individuals.**

---

## 2. The five differentiators

Verbatim from `vsw-differentiators.md`, which Tej wrote as intake for LinkedIn outreach:

1. **The whole ecosystem, one week.** The one time a year the entire BC startup community is
   in the same place. No other regional event creates that density.
2. **Over a decade of community trust.** 10+ years of consistency. The community returns on
   its own, not because of marketing. Longevity *is* the credential.
3. **The BC model, not Silicon Valley cosplay.** Sustainable growth over hype cycles,
   human-centered building, long-term thinking. A 2026 attendee: *"Long-term, sustainable
   ventures… aligned to the values and lifestyles of the founders. The BC model of
   entrepreneurship."*
4. **Accessible by design.** Explicitly welcoming to pre-idea and pre-seed founders. That mix
   — napkin-sketch builders next to serial founders — produces unusually honest conversations.
5. **External validation.** Canada Now (May 2026) covered VSW as "the foundation" of
   Vancouver's startup ecosystem, quoting seven founders and operators, framing VSW as the
   authentic base that Web Summit Vancouver landed on top of.

---

## 3. Proof — attributable, named, and specific

The strongest asset here is that attendees publish their own ROI. From
`community-proof-linkedin-posts.md`:

- **Denver D., founder** — won the VSW 2024 pitch competition and posted the return in his own
  words: *"130+ new connections, 8 new clients, 4 stronger friendships, 4 new funding partners,
  1 new proptech startup launched."* This is the single best piece of evidence VSW holds. It is
  public, attributed, specific, and it is an *attendee* outcome, not a marketing claim.
- **Luis Juarez, CEO, Inside View Global** — *"It's where I got my first leads, made connections
  that mattered, and started learning the fundamentals that shaped Inside View Global."* Second
  year hosting his own event at VSW.
- **Canada Now, May 2026** — earned media, seven named sources, positioning VSW as essential
  context for understanding the local ecosystem.

**Usage rule:** these are attendee outcomes and ecosystem standing, not sponsor outcomes.
Do not present Denver's numbers as what a *sponsor* got. They are evidence that the room
converts into real business relationships, which is the premise a sponsor is buying into.

---

## 4. What VSW can offer — and the honest gap

**There is no sponsorship tier structure, and that is deliberate, not an oversight.** Per Tej
(2026-07-29): defining the next-evolution format of VSW *is what this project is for*. Tiers
and pricing get designed after the format is settled.

This has a direct consequence for outreach, and it is worth stating plainly rather than
working around: **we are not currently selling a package. We are opening a conversation about
what a partnership could be, at a moment when the format is genuinely still being shaped.**

That is a weaker sales position in one way and a stronger one in another, and the copy should
use the stronger reading:

> **Being early is the offer.** A prospect who engages now helps define what their involvement
> looks like, rather than picking from a rate card someone else designed. For a company whose
> real interest is something other than a logo — talent access, a workshop, pilot
> introductions, executive visibility — that is a materially better proposition than a tier.

This is already how the objection handling answers it (`objection-handling.md`, Multinationals:
*"There's a range — from hosting a workshop or session, to activating at an event, to straight
sponsorship. The format that works best tends to depend on what you're trying to get out of
it."*). It should be how the outreach frames it too.

**Formats with precedent, usable as concrete examples:** hosting a workshop or session,
activating at an event (Nespresso and PeelTea ran café activations in 2026), sponsoring a
named moment (Fasken sponsored the 2026 closing party; the opening was at Science World),
straight sponsorship, and speaking or panel slots.

### What Tej is gathering next

Past-sponsor outcomes for 2–3 sponsors — see §6 for exactly what that unlocks.

---

## 5. Audience-specific value propositions

From the brand framework's messaging matrix, mapped to how sponsor prospects actually
segment. **Match the prospect to a row before writing the ROI thesis.**

| If the prospect wants… | The VSW value | Evidence to lean on |
|---|---|---|
| **Customers among founders/SMBs** | 696 orgs, 45% principals — the buyer is in the room, not a gatekeeper | §1 seniority table |
| **Talent / employer brand** | Talent matchmaking is named VSW programming; the room skews senior-operator | §1, `vanstartupweek.ca/about-us` |
| **Deal flow (investors/corp dev)** | Proximity to BC early-stage before active raise, low-pressure, investor-only sessions | `objection-handling.md`, Investors |
| **Community standing / local credibility** | Decade of trust; the ecosystem's own event, not a parachuted-in brand | Differentiators 2 and 5 |
| **Executive visibility / thought leadership** | Speaking and panel slots; 250+ speakers in 2026 | §4 formats |
| **Government / economic-development mandate** | Direct unfiltered access to founders outside a program lens | `objection-handling.md`, Government |
| **Reaching other large companies** | Existing sponsor roster means corporate BD/exec are also attendees | §1 composition |

---

## 6. How enrichment uses this — the `Why Us (→[why])` field

Every prospect now gets a stored, reviewed, one-sentence answer to *what does this specific
organization get from VSW*, built by matching the fit memo's top-ranked ROI candidate against
a row in §5, and grounded in a §1–§3 fact.

**The construction:** `[their evidenced need] + [the specific VSW fact that meets it]`.

**Worked example — Accenture.** The fit memo's top-ranked candidate is talent (59 live
Vancouver openings, evidenced and dated). §5 row 2 is the match. §1 supplies the fact:

> *"You're hiring across engineering and delivery in Vancouver right now, and the room
> is 45% founders and company principals with talent matchmaking built into the week."*

**The bar it has to clear** — the same substitutability test as everything else:

- ❌ *"Great exposure to the Vancouver tech community"* — true of every sponsor of every event.
- ❌ *"Access to thousands of attendees"* — a number, not a reason.
- ✅ *"Your Startup Program's lowest tier needs no minimum raise, and this room is
  deliberately built for pre-seed founders who'd qualify."* (Cloudflare — specific, and only
  true because of something specific about *them*.)

**If no honest answer exists, leave it blank and say so in `Notes`.** A prospect with no real
reason to sponsor is a tiering problem, not a copywriting problem. Inventing a benefit is the
same failure mode as inventing a fact.

---

## 7. What is still missing

| Gap | Blocks | Owner |
|---|---|---|
| Past-sponsor outcomes, 2–3 sponsors (§6) | The only proof that a *sponsor* got value, vs an attendee | Tej |
| Sponsorship tiers / pricing | Not a gap — deliberately deferred until the format is set | The project itself |
| Sponsor-specific reach numbers (booth traffic, activation engagement) | Quantifying activation ROI | Not collected |
| Survey results / NPS / demographics beyond title | Richer audience claims | Not collected |
| 2022 attendance data | The year-over-year series has a hole | Tej |
