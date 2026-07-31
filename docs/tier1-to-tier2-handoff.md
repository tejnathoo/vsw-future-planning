# Tier 1 → Tier 2 handoff (2026-07-21) — EXECUTED

**Status: done and verified live.** Everything below was a proposal as of earlier today; Tej
approved it and it has since been written to `master-prospects` and confirmed by a fresh read
(`scripts/tier1-tier2-rebalance.ts`, logged in PLAN.md's Execution Log under the same date). This
doc now serves as the record of what happened and the standing table to hand off to whoever
manages Tier 2 next.

**Purpose.** Andrew/Tej's target: Tier 1 = 20 cold leads, Tier 2 = 50 cold leads, both tiers
containing only genuine cold leads. Tier 1 sat at 29 before this pass.

**Live result:** Tier 1 = **20** (zero dead/blocked rows left in it — every remaining row is
genuinely active). Tier 2 = **56** (50 + the 6 adopted from Tier 1 below).

**What the Tier 2 side still needs to do:** independently select 6 of its own existing Tier 2 rows
to drop into a tentative Tier 3 hold, landing Tier 2 back at net 50. That selection isn't made
here — it depends on Tier 2's own current composition/priorities, which this pass didn't touch.

---

## The 3 dead/blocked rows — removed from rotation entirely (Tej's call, 2026-07-21)

Of the original 29, **3 rows aren't real cold leads and don't belong in any tier**:

| Org | Status | Why it's not a real lead |
|---|---|---|
| Coast Capital Venture Connection | `Archived` | Own Notes: "looks like Venture Connection died in 2024." |
| Vancouver Economic Commission | `Archived` | Own Notes: "Does not exist anymore." |
| Province of British Columbia | `Sourced`, Blocked | Too broad — Andrew's own note says it needs specific ministries/departments (see `docs/broad-org-breakdown-candidates.md`); not enriched, no route. |

**Resolution: `Outreach Tier` gets cleared entirely for all 3** — blank, not `Tier 1`, not `Tier 2`,
not held anywhere. They're out of the outreach rotation completely, not parked. Province of
British Columbia stays available for the separate department-breakdown work already catalogued in
`docs/broad-org-breakdown-candidates.md`; the other two are simply dead and done.

**This changes the math.** Tier 1's genuinely active pool is **26** (29 minus these 3), not 29. To
land Tier 1 at exactly 20, only **6** need to move to Tier 2 — not 9. That means **3 of the
originally-recommended 9 get held back in Tier 1 instead of moving**, to make up for the 3 slots
these dead/blocked rows vacate.

---

## Held back in Tier 1 (3 of the original 9)

| Org | Contact | Why held back rather than moved |
|---|---|---|
| **Valhalla Private Capital** | Grant Lawrence, **Co-Founder** | Founder-level contact — as senior as a first-touch contact gets; well-documented footprint (NVBC Communication Partner, Foresight 50 judging panel, 252 deals/$70M track record per Notes). |
| **Kensington Capital Partners** | Dylan Freeze, **Director** (Vancouver office) | Local office-specific leadership title, plus a substantiated $2.3B+ AUM per Notes — more evidence-backed than Northleaf's similar profile. |
| **Top Down Ventures** | Kevin Clune, **Head of Content & Strategic Partnerships** | Literally a partnerships-titled role (direct fit for a sponsorship conversation), and externally referenced in the CVCA Intelligence Q1 2026 report. |

This was a judgment call on relative contact seniority/evidence, not a hard rule — say the word if
you'd rather swap any of these three for a different one of the original 9 (still reversible, it's
just an `Outreach Tier` cell either way).

---

## 6 moved into Tier 2 (revised down from 9)

| Org | Category | Contact | Route | Why Tier 2, not Tier 1 |
|---|---|---|---|---|
| **A100** | Accelerator | No named contact — `info@thea100.org` only | Email — shared inbox | Only Tier 1 row with zero named contact; weakest lead by that measure alone. |
| **Graphite Ventures** | VC | Jude Sacramenthas, VP Ecosystems | Email — shared inbox | Smaller seed fund, redundant with the stronger VC names staying. |
| **Northleaf Capital Partners** | VC (PE/fund-of-funds) | Chelsey Wiggins, VP Institutional Marketing | Email — personal | Same PE/fund-of-funds profile as Kensington (held back) — one is enough for Tier 1, and this is the weaker-evidenced of the two. |
| **The Syndicate** | VC (angel investing) | Galen Wang, Community Lead | LinkedIn | Solid angel-community org, but less institutional weight than the VC names being kept. |
| **Vanedge Capital** | VC | Violet Molnar, Office Manager | Email — shared inbox | Contact is an office manager, not a partner/BD role — weakest contact-seniority among the VC rows. |
| **Yaletown Partners** | VC | Yumi Maihara, Manager Marketing & Events | Email — shared inbox | Solid Vancouver VC, but contact is an events role, not partner-level; Tier 1 keeps stronger VC names. |

All 6 are `Status = Drafted — awaiting approval`, `Ready? = TRUE`, with real drafts already sitting
in the shared drafts doc — none of this enrichment work is lost, it just moves tiers with the row.

---

## Full Tier 1 standing table (all 29, current state)

| Org | Category | Status | Route | Contact | Disposition |
|---|---|---|---|---|---|
| A100 | Accelerator | Drafted — awaiting approval | Email — shared inbox | *(none — generic inbox)* | **→ Tier 2** |
| AWS | Tech | Drafted — awaiting approval | LinkedIn | Tara Wallace, Sr. Account Mgr Early Startups W. Canada | Stays — marquee tech name |
| City of Vancouver | Gov | Drafted — awaiting approval | Email — shared inbox | *(no ideal contact found — general emails used)* | Stays — anchor municipal gov row |
| Coast Capital Venture Connection | Accelerator | **Archived** | Blocked — no route | — | **Removed from all tiers** (dead, program ended 2024) |
| CVCA | VC (industry assoc.) | Drafted — awaiting approval | Email — shared inbox | Patrice Oliveira, Director Dev. & Member Engagement | Stays — industry association, distinct from single-fund VCs |
| EY | Professional services | Drafted — awaiting approval | Email — personal | Natalie Niedzialek, EY EOY Pacific rep | Stays — Big Four |
| Google Cloud | Tech | **Enriched** (held — draft needs revision) | LinkedIn | Iran Karimian, Head of Accelerator & Startup Ecosystem Canada | Stays — real 2025 past sponsor, new contact being sourced (see 2026-07-21 PLAN.md entry) |
| Graphite Ventures | VC | Drafted — awaiting approval | Email — shared inbox | Jude Sacramenthas, VP Ecosystems | **→ Tier 2** |
| Kensington Capital Partners | VC | Drafted — awaiting approval | LinkedIn | Dylan Freeze, Director | **Held back — stays Tier 1** |
| KPMG | Professional services | Drafted — awaiting approval | LinkedIn | Chelsea Philip, Marketing Director | Stays — Big Four |
| National Bank of Canada | Bank | Drafted — awaiting approval | Email — personal | Krista Wilson, Director Sponsorships & Donations | Stays — major bank |
| Northleaf Capital Partners | VC | Drafted — awaiting approval | Email — personal | Chelsey Wiggins, VP Institutional Marketing | **→ Tier 2** |
| Province of British Columbia | Gov | **Sourced** (Blocked) | Blocked — no route | — | **Removed from all tiers** (too broad, pending dept. breakdown) |
| PwC | Professional services | Drafted — awaiting approval | Email — personal (secondary) | Alaina Tennison, Network Strategy Liaison | Stays — Big Four |
| Rhino Ventures | VC | Drafted — awaiting approval | LinkedIn | Candace Hobin, Community Manager | Stays — deep Vancouver roots, corrected-domain research |
| Sequoia Capital | VC | Drafted — awaiting approval | Email — personal | Emma Matthieson, Sr. Director Experiences & Community | Stays — top global VC brand |
| TD | Bank | Drafted — awaiting approval | LinkedIn | Ann-Kim Linéus, Community Collaborations & Partnerships Mgr | Stays — major bank |
| TELUS Global Ventures | VC (corporate) | Drafted — awaiting approval | LinkedIn | Omair Shah, Partner Strategic Portfolio Dev. | Stays — corporate VC, distinct from independent funds |
| TELUS Pollinator Fund | VC (impact) | Drafted — awaiting approval | LinkedIn | Sami Bismarji, Director of Finance | Stays — impact-focused, distinct mandate |
| The Syndicate | VC (angel) | Drafted — awaiting approval | LinkedIn | Galen Wang, Community Lead | **→ Tier 2** |
| Top Down Ventures | VC | Drafted — awaiting approval | LinkedIn | Kevin Clune, Head of Content & Partnerships | **Held back — stays Tier 1** |
| Trade and Invest BC | Gov | Drafted — awaiting approval | Email — personal | Chris Heine, Sr. Manager Investor Services | Stays — anchor provincial gov row |
| Valhalla Private Capital | VC | Drafted — awaiting approval | Email — personal | Grant Lawrence, Co-Founder | **Held back — stays Tier 1** |
| Vancity | Bank | Drafted — awaiting approval | LinkedIn | Katie Stanoffsky, Sr. Specialist Growth Partnerships | Stays — major BC credit union |
| Vancouver Economic Commission | Gov (econ dev) | **Archived** | Blocked — no route | — | **Removed from all tiers** (dead, "does not exist anymore") |
| Vanedge Capital | VC | Drafted — awaiting approval | Email — shared inbox | Violet Molnar, Office Manager | **→ Tier 2** |
| Version One Ventures | VC | Drafted — awaiting approval | Email — personal | Boris Wertz, Founder & GP | Stays — well-known Vancouver VC; Sanket/Boris warm angle noted separately by Tej |
| Yaletown Partners | VC | Drafted — awaiting approval | Email — shared inbox | Yumi Maihara, Manager Marketing & Events | **→ Tier 2** |
| Zendesk Startups | Tech (SaaS) | Drafted — awaiting approval | LinkedIn | Derek Pham, Head of Americas Zendesk for Startups | Stays — recognizable SaaS brand |

---

## Resulting Tier 1 (20) — live, verified, all genuinely active, zero dead/blocked rows

AWS, City of Vancouver, CVCA, EY, Google Cloud, Kensington Capital Partners, KPMG, National Bank of
Canada, PwC, Rhino Ventures, Sequoia Capital, TD, TELUS Global Ventures, TELUS Pollinator Fund, Top
Down Ventures, Trade and Invest BC, Valhalla Private Capital, Vancity, Version One Ventures,
Zendesk Startups.

Category mix: Tech 3, Gov 2, VC 9, Professional services 3, Bank 3. (VC is still the largest single
category at 9 of 20 — inherent to holding 3 of the weaker-VC demotions back — flagging in case you
want to revisit that balance further.)

---

## Written and verified

All 9 `Outreach Tier` cells above were written live via `scripts/tier1-tier2-rebalance.ts` and
confirmed by a fresh read afterward (see PLAN.md's 2026-07-21 "Tier 1 → Tier 2 rebalance" Execution
Log entry for the full record). Nothing else on any row was touched — contacts, drafts, Status,
and all other enrichment fields are exactly as they were before this pass.

**Still open, on the Tier 2 side:** select 6 of Tier 2's own existing 56 rows to drop into a
tentative Tier 3 hold, landing Tier 2 back at net 50. That decision depends on Tier 2's current
composition and priorities, which weren't part of this pass — this doc's job ends at the handoff.
