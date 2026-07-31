# Broad-org breakdown candidates

**Purpose.** Andrew's note (relayed via Slack): *"large organizations like the universities (e.g.,
UBC) or governmental bodies (e.g., Province of BC)... are far too broad for the outreach, please
take some time to look at those organizations and consider which departments / business segments
might have actually been involved in sponsoring other events (e.g., Innovation UBC aka e@UBC). It
is very likely that for large organizations there are multiple potential groups and contacts we
should be reaching out to."* This doc is the first pass: **just the list** of which rows are
candidates for that treatment, sorted by confidence. No research, no scraping, no department/contact
hunting — that is a deliberately separate follow-up step.

**Scope.** All 393 org rows in `master-prospects` (not just Tier 1/2 — a broad org could be sitting
untiered too).

**Confidence definitions.**
- **High** — the org name itself is unambiguously a large, multi-unit institution (a whole
  university, a whole government body, a national crown corporation, a Fortune-500-scale
  multinational, a top-tier global bank/law/consulting/accounting firm) and the row still sits at
  that whole-institution level with no narrower sub-entity row already covering it.
- **Low** — plausibly large/multi-unit but not obvious from the sheet alone (mid-size company,
  unclear internal structure, or a specific program already surfaced in `Why Them` that may already
  be "narrow enough"). Needs a quick confirmation pass, not full research.

**Methodology.** Sheet-data classification only — `Outreach Tier`, `Category`, `Subsector`,
`Why Them`, `Notes` for all 393 rows, read via a throwaway script (`scripts/tracker.ts` helpers, one
read call, header names resolved live). No external research this pass. Every flagged row was
cross-checked against the full 393-name list for existing narrower sibling rows sharing its
institutional root (UBC, SFU, Government of Canada, RBC, TELUS, etc.) before being flagged as
"untouched."

---

## High confidence

### Public sector / quasi-public

| Org | Tier | Category | Why flagged | Narrower row already exists? |
|---|---|---|---|---|
| **Province of British Columbia** | Tier 1 | Gov | **Already identified, in progress** — blocked on routing per `docs/org-goals-enrichment-model.md` §4; Andrew's own note calls it out by name. | Partial — `BC Ministry of International Trade`, `BC Ministry of Jobs, Economic Development and Innovation`, `Innovate BC`, `Trade and Invest BC` already exist as narrower provincial agencies/ministries. |
| **Vancouver Economic Commission** | Tier 1 | Gov | **Already identified, in progress** — same §4 blocked list. | No. |
| **Coast Capital Venture Connection** | Tier 1 | Accelerator | **Already identified, in progress** — same §4 blocked list. Note: row's own `Notes` say the program "looks like it died in 2024." | Sibling `Coast Capital Savings Federal Credit Union` exists (the parent credit union), but the SFU-run venture program itself is the sub-entity, not the parent. |
| **Government of Canada** | — | Gov | Whole federal government; its own `Why Them` text says outright it's "best approached through a specific department or program rather than as a single sponsor." | Yes, several — `Global Affairs Canada`, `PacifiCan`, `EDC`, `BDC`, `NRC IRAP` / `National Research Council of Canada Industrial Research Assistance Program`, `Innovation for Defence Excellence and Security (IDEaS) and Innovation Solutions Canada` all already exist as narrower federal bodies. |
| **The University of British Columbia** | — | University | Whole university, still at institution level. | Yes — `Innovation UBC` already exists as the narrower commercialization arm. |
| **Simon Fraser University** | — | University | Whole university; its own `Why Them` even name-checks its sub-arms. | Yes — `SFU Beedie School of Business`, `SFU Innovates`, `SFU VentureLabs` all already exist. |
| **Queen's University** | — | University | Whole university. | Yes — `Smith School of Business, Queen's University` already exists. |
| **University of Toronto** | — | University | Whole university (Innovations & Partnerships Office named in `Why Them` but no separate row). | No. |
| **University of Alberta** | — | University | Whole university (Innovation Fund named in `Why Them` but no separate row). | No. |
| **University of Calgary** | — | University | Whole university (Innovate Calgary / UCeed named in `Why Them` but no separate row). | No. |
| **Northeastern University** | — | University | Whole university (26 programs / 14 campuses per its own `Why Them`); no Vancouver-campus-specific row. | No. |
| **SAIT** | — | University | Whole polytechnic institute. | No. |
| **Red Deer Polytechnic** | — | University | Whole polytechnic institute. | No. |
| **City of Vancouver** | Tier 1 | Gov | Whole municipal government; row's own `Notes` recommend routing "through direct contacts at the economic development office" rather than the city generically. | Related arm's-length bodies exist (`Vancouver Economic Commission` [blocked], `Destination Vancouver`, `Invest Vancouver` [Metro Vancouver's service, not the City's]) but no City-department-level row. |
| **City of Toronto** | — | Gov | Whole municipal government ("StartUp Here" program named in `Why Them`, no separate row). | No. |
| **Metro Vancouver** | — | Gov | Whole regional government. | Yes — `Invest Vancouver` already exists, explicitly described as "Metro Vancouver's official regional economic development service." |
| **BC Hydro** | — | Crown corp | Whole provincial utility; multiple plausible units (Power Smart, community investment, the CICE-partnered innovation call named in `Why Them`). | No. |
| **Vancouver Fraser Port Authority** | — | Crown corp | Whole port authority, multi-department (trade, innovation, sustainability). | No. |
| **Vancouver Airport Authority / YVR** | — | Gov | Whole airport authority; runs its own named Innovation Hub. ~~Duplicate row~~ — resolved 2026-07-22, see PLAN.md Execution Log. | No genuine sub-entity row. |

### Large private companies

| Org | Tier | Category | Why flagged | Narrower row already exists? |
|---|---|---|---|---|
| **Google** | — | Tech | Whole company, still at institution level. | Yes — `Google Cloud` (Warm), `Google for Startups`, `YouTube` all already exist. |
| **Microsoft** | — | Tech | Whole company. | Yes — `Microsoft for Startups` (Tier 2), `LinkedIn`, `The Coalition (Microsoft)` all already exist. |
| **Amazon** | Tier 2 | Tech | Whole company; per `docs/org-goals-enrichment-model.md` §6, a known collision risk with its own sub-entity. | Yes — `AWS` (Tier 1) already exists; doc flags the two rows must stay distinct. |
| **Meta** | — | Tech | Whole company; `Why Them` itself notes its startup programming "isn't yet confirmed to exist in Canada" — a sign the current row may not be the right unit at all. | No. |
| **IBM** | — | Tech | Whole company (IBM Ventures named in `Why Them`, no separate row). | No. |
| **Oracle** | — | Tech | Whole company. | No. |
| **SAP** | Tier 2 | Tech | Whole company; row's own `Notes` flag its existing clauses as generic global positioning. | No. |
| **Salesforce** | — | Tech | Whole company. | Yes — `Slack` already exists (acquired 2021, Vancouver-founded). |
| **NVIDIA** | — | Tech | Whole company (NVIDIA Inception named in `Why Them`, no separate row). | No. |
| **Adobe** | — | Tech | Whole company (Adobe Incubator / Adobe Ventures named in `Why Them`, no separate row). | No. |
| **Cisco** | — | Tech | Whole company. | No. |
| **Dell** | Tier 2 | Tech | Whole company. | No. |
| **Bell** | — | Tech | Whole national telecom. | No. |
| **Telus** | — | Tech | Whole telecom parent; the ask given as a task example says its sub-entities are correct, but the parent telecom-service company itself is still a separate, unnarrowed ask from its VC arms. | Yes — `TELUS Global Ventures`, `TELUS Pollinator Fund` (both Tier 1) already exist. |
| **BMO (Bank of Montreal)** | — | Bank | Whole bank. | No. |
| **CIBC** | — | Bank | Whole bank. | Yes — `CIBC Innovation Banking` already exists. |
| **RBC** | Tier 2 | Bank | Whole bank. | Yes — `RBCx` already exists. |
| **TD** | Tier 1 | Bank | Whole bank/brand. Note: the confusingly-named sibling row was renamed 2026-07-22 from `TD Bank Group` to `TD Innovation Partners (TDIP)` to make clear it's a correct narrower sub-entity, not a duplicate of this row — see PLAN.md Execution Log. | Yes — `TD Innovation Partners (TDIP)` already exists. |
| **National Bank of Canada** | Tier 1 | Bank | Whole bank. | No. |
| **JPMorgan** | — | Bank | Whole bank (Innovation Economy platform named in `Why Them`, no separate row). | No. |
| **Rogers** | — | Tech | Whole telecom. ~~Duplicate row (`Rogers Communications`)~~ — resolved 2026-07-22, see PLAN.md Execution Log. | No genuine sub-entity row. |
| **Dentons** | — | Law firm | World's largest law firm by headcount (per its own `Why Them`). | No. |
| **Norton Rose Fulbright** | — | Law firm | Global law firm. | No. |
| **Fasken** | — | Law firm | Large national Canadian firm. | No. |
| **Bennett Jones** | — | Law firm | Large national Canadian firm. | No. |
| **Blakes** | — | Law firm | Large national Canadian firm. | No. |
| **McCarthy Tétrault** | — | Law firm | Large national Canadian firm. | No. |
| **Osler** | — | Law firm | Large national Canadian firm. | No. |
| **PwC** | Tier 1 | Professional services | Big Four global firm. | No. |
| **KPMG** | Tier 1 | Professional services | Big Four global firm. | No. |
| **EY** | Warm | Professional services | Big Four global firm. | No. |
| **Deloitte** | — | Professional services | Big Four global firm. ~~Duplicate row (`Deloitte Consulting`)~~ — resolved 2026-07-22, see PLAN.md Execution Log. | No genuine sub-entity row. |
| **McKinsey & Company** | — | Professional services | Global (MBB) consultancy. | No. |
| **Boston Consulting Group** | — | Professional services | Global (MBB) consultancy. | No. |
| **Bain & Company** | — | Professional services | Global (MBB) consultancy. | No. |
| **Accenture** | Tier 2 | Tech | Top-5 global consultancy. | No. |
| **BDO** | — | Professional services | National accounting/advisory network. | No. |
| **MNP** | — | Professional services | National accounting/advisory network. | No. |

---

## Low confidence

### Public sector / quasi-public

| Org | Tier | Category | What's uncertain |
|---|---|---|---|
| **TransLink** | — | Crown corp | Large transit authority, but its own site funnels sponsorship asks through one generic "Community Sponsorships and Partnerships" form — unclear if internal departments (transit police, engineering, Compass) are meaningfully separate sponsorship contacts. |
| **ICBC** | — | Crown corp | Provincial crown corp, but single-product (auto insurance) — unclear whether a distinct innovation/mobility unit exists worth a separate ask, vs. BC Hydro's more obviously multi-program structure. |
| **Musqueam Indian Band** | — | Gov | Indigenous government; a specific spokesperson (Chief Wayne Sparrow) is already named, but unclear whether the Band's economic-development arm (if one exists, e.g. a development corporation) is a distinct/better-fit contact from Band governance. |
| **Squamish Nation** | — | Gov | Same uncertainty as Musqueam — governance vs. economic-development-corporation split unclear from sheet data. |
| **Tsleil-Waututh Nation** | — | Gov | Same uncertainty as Musqueam/Squamish. |
| **BDC** | — | Crown corp | National crown business bank; `Why Them`/`Notes` already center the ask on "BDC Capital" specifically, so partial narrowing may already exist in the text even without its own row. |
| **EDC (Export Development Canada)** | — | Crown corp | National crown export-credit agency; single stated mandate, unclear if internal segmentation (financing vs. trade programs) matters for a VSW ask. |

### Large private companies

| Org | Tier | Category | What's uncertain |
|---|---|---|---|
| **Manulife** | — | Finance | Large multinational insurer, but `Why Them` already centers on one named program (UpLink partnership) — may already be narrow enough in substance even without a separate row. |
| **Sun Life** | — | Finance | Same pattern — `Why Them` already centers on one named initiative (Sunny, its GenAI chatbot). |
| **Boeing** | — | Defense & aerospace | Global aerospace major; internal division structure (defense vs. commercial vs. HorizonX-style ventures arm) not established from sheet data. |
| **Airbus** | Tier 2 | Defense & aerospace | Same uncertainty as Boeing (Airbus Central Innovation named in `Why Them`, no separate row). |
| **BAE Systems** | — | Defense & aerospace | Same uncertainty — global defense major, internal segmentation unclear. |
| **Northrop Grumman** | — | Defense & aerospace | Same uncertainty. |
| **Thales** | — | Defense & aerospace | Same uncertainty. |
| **Safran** | — | Defense & aerospace | Same uncertainty. |
| **Workday** | — | Tech | Large enterprise SaaS company, but single-product enough (HCM/financial management) that it may not need a department split at all — more borderline than the tech majors in the High list. |
| **Mastercard** | — | Finance | Global payments giant, but `Why Them` already centers on one named program (Start Path) — may already be narrow enough in substance. |
| **Visa** | — | Finance | Same pattern — already centers on the Visa Accelerator specifically. |
| **Fujitsu** | — | Tech | Multinational, but has a specific Vancouver AI-HQ presence and co-creation program already named in `Why Them` — may already be effectively narrowed in substance. |

---

## Already correctly narrowed (context for the next agent — don't re-flag these)

Found while cross-checking the flagged rows above for existing sibling breakdowns:

- **SFU** family: `SFU Beedie School of Business`, `SFU Innovates`, `SFU VentureLabs` (siblings of `Simon Fraser University`).
- **UBC** family: `Innovation UBC` (sibling of `The University of British Columbia`).
- **Queen's** family: `Smith School of Business, Queen's University` (sibling of `Queen's University`).
- **BCIT**: only ever appears already-narrowed — `BCIT Commercialization Assistance Program`, `Digital Arts Media and Design @ BCIT` — there is no whole "BCIT" row to flag.
- **Amazon/Google/Microsoft/Salesforce** families: `AWS`, `Google Cloud`, `Google for Startups`, `YouTube`, `Microsoft for Startups`, `LinkedIn`, `The Coalition (Microsoft)`, `Slack`.
- **Bank families**: `RBCx` (sibling of `RBC`), `CIBC Innovation Banking` (sibling of `CIBC`).
- **TELUS** family: `TELUS Global Ventures`, `TELUS Pollinator Fund` (siblings of `Telus`) — the example the task brief itself calls out as correct.
- **BC/Canada government apparatus**: `Trade and Invest BC`, `Invest Vancouver`, `Innovate BC`, `BC Ministry of International Trade`, `BC Ministry of Jobs, Economic Development and Innovation` (all narrower agencies/ministries feeding into `Province of British Columbia` / `Metro Vancouver`), and `PacifiCan`, `Global Affairs Canada` (narrower federal bodies feeding into `Government of Canada`).
- **University-affiliated research centres**, already at the correct narrow grain and not tied to a single flagged parent above: `Centre for Aging + Brain Health Innovation & ACT`, `Centre for AI Decision-Making and Action (CAIDA)`, `Centre for Digital Media`, `Charles Chang Institute for Entrepreneurship`.

One namesake note for the next agent: **`Beedie`** (the philanthropic real-estate developer, row Category `Real estate`) and **`SFU Beedie School of Business`** are two genuinely distinct organizations that merely share a donor's name — not a parent/child pair, don't merge or conflate them.

---

## Summary

- **High confidence — public/quasi-public: 19** (including the 3 already-known/in-progress: Province of BC, Vancouver Economic Commission, Coast Capital Venture Connection)
- **High confidence — large private companies: 38**
- **Low confidence — public/quasi-public: 7**
- **Low confidence — large private companies: 12**
