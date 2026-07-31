# VSW 2026 — Known Stats

## Verified attendance (from raw data, computed 2026-07-08)

Real attendee-list data now lives in `impact-report/data/`. Computed with `impact-report/scripts/compute_attendance_totals.py` — rerun it any time the source files change.

| Year | Attendees (from Whova export) |
|---|---|
| 2021 | 720 |
| 2022 | *no file provided — confirm with Tej whether VSW ran in 2022* |
| 2023 | 1,788 |
| 2024 | 1,079 |
| 2025 | 1,029 |
| 2026 | 1,043 |
| **Total (sum of yearly counts)** | **5,659** |
| Unique individuals across all years (deduped by email) | 5,019 |
| Repeat attendees (returned in a later year) | 640 |

**⚠️ Discrepancy to resolve with Tej/Mark:** the 2026 marketing figure of "5,050 attendees" (used in the post-event email and LinkedIn outreach intake — see table below) does not match the 1,043 count in `VSW2026 Attendees.csv`. Likely explanation: the 2021/2023/2024/2025 files are Whova's *attendee import template* (the full registrant list organizers uploaded, e.g. from Eventbrite), while the 2026 file is a Whova *attendee profile export* (people who created an app profile — a subset of all registrants). If so, the two are not counting the same thing and the 5,050 figure may be the more accurate registrant/ticket-holder total for 2026, while the Whova profile export undercounts it. Recommend confirming the source and definition of "attendee" for 2026 before publishing a year-over-year comparison — as-is, comparing 1,043 (2026 profiles) against e.g. 1,788 (2023 full registrant list) is not apples-to-apples.

## Other stats already documented elsewhere (unverified, from marketing copy)

| Stat | Value | Source |
|---|---|---|
| Total attendees (marketing figure) | 5,050 | `blog/output/vsw-2026-post-event-thank-you.md`, `other/sales-outreach/vsw-differentiators-linkedin-intake.md` |
| Events/sessions | 85+ | Same as above |
| Speakers | 250+ | Same as above |
| Duration | 5 days (April 27–May 1, 2026) | CLAUDE.md |
| Years running | 10+ | `other/sales-outreach/vsw-differentiators-linkedin-intake.md` |
| Opening venue | Science World | `blog/output/vsw-2026-post-event-thank-you.md` |
| Closing party sponsor | Fasken | `blog/output/vsw-2026-post-event-thank-you.md` |
| Café sponsors | Nespresso, PeelTea | `blog/output/vsw-2026-post-event-thank-you.md`, `social/output/nespresso-asmr.md`, `social/output/peeltea-asmr.md` |
| Media coverage | Canada Now (Ashley Smith), May 2026 — quoted 7 founders/operators | `social/reference/media-coverage/2026-05-12-ashley-smith-canada-now.md` |
| Community organic content | Multiple founder/investor LinkedIn posts post-event | `social/reference/community-linkedin-posts.md`, `social/output/community-posts-strategic-analysis.md` |

## Why this matters

Tej mentioned VSW feedback "directly supports our ability to secure the government grants that keep VSW accessible" (per the post-event thank-you email) — so the impact report likely needs to speak to grant reporting requirements, not just marketing. Worth confirming with Tej/Mark whether this report has a specific funder or grant audience.

## Remaining gaps

- **2022 data** — no attendee file exists for 2022; confirm with Tej whether VSW ran that year or the file is just missing
- **2026 attendee count reconciliation** — see discrepancy note above; need to confirm which number (5,050 vs 1,043) is correct, or whether both are correct but measuring different things
- Day-by-day attendance breakdown (only year totals exist right now, not per-day)
- Ticket tier breakdown (All-Access Pass vs single-day vs comp) — the xlsx files don't consistently include a ticket type column
- Session-level attendance (which of the 85+ events drew the most people) — the 2026 CSV has a `registered_sessions` column that could support this if needed later
- Speaker/session category breakdown (panels vs workshops vs keynotes)
- Sponsor-specific reach or engagement numbers
- Survey results (satisfaction, NPS, demographics, testimonials)
