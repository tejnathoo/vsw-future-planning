---
name: work-log
description: Audit what Tej actually got done across every source the work lives in (repo, EXECUTION-LOG, the live sheet, the Outreach Drafts docs, the Thread with Andrew Notion page, Slack, the week plan / twelveoclock.co, calendar), corroborate his own recollection against that evidence, then write the day's bullets for the time-tracking spreadsheet in his voice. Use when Tej says "here's what I got done", "log my day", "write my time tracking bullets", "audit what I did today/yesterday/this week", or pastes a rundown of work and asks for bullets.
---

# Work log — audit, corroborate, then write

Turns a day (or a stretch of days) of real work into time-tracking bullets that survive being read by someone who was not there.

Three phases, in order. Do not skip to phase 3 because Tej's rundown looks complete. His rundown is a **claim**, not the record. The whole point of this skill is that the evidence lives in seven places and he remembers maybe five of them.

---

## Phase 1 — Collect

Ask Tej for the date range and his own rundown if he has not already given one. If he says "just audit it", proceed with no rundown and reconstruct from evidence alone.

Then sweep every source below. Run the independent ones in parallel. Note which sources came back empty; an empty source is a finding, not a blank.

### 1. The repo

```bash
cd "/Users/tejnathoo/Desktop/Tej Nathoo/vsw-future-planning"
git log --since="<start>" --until="<end>" --stat
git status --porcelain
find . -newermt "<start>" ! -newermt "<end>" -type f \
  -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./dist/*" | sort
```

Uncommitted and untracked work counts. Most of Tej's output in this repo sits unstaged for days. Scratch files (`scratch_*.ts`, `*_tmp.ts`) are evidence of research that happened even when nothing shipped.

### 2. EXECUTION-LOG.md

The densest source. Dated `###` headings, newest at the bottom. Read every entry inside the range in full. This is where the *reasoning* behind each change was recorded, which is what makes a bullet specific rather than generic.

```bash
grep -n "^### <YYYY-MM-DD>" EXECUTION-LOG.md
```

If work shows up in git or the sheet but has no EXECUTION-LOG entry, that is a gap to flag: the log is supposed to carry every write.

### 3. The live sheet (`master-prospects`)

Follow the programmatic pattern in CLAUDE.md exactly: a throwaway `.ts` in the repo root, service-account auth, `npx tsx`, then delete the file. Never guess at the sheet's contents and never trust a column letter without re-reading the header row (Tej reshuffles columns live).

The sheet has no per-day history, so it corroborates **state**, not **timing**. Use it to confirm a claim's end state: counts by Tier, counts by Status, which rows carry a Draft Link, which rows are flagged. If Tej says he enriched eleven orgs, read those eleven rows and confirm the fields are populated.

### 4. The Outreach Drafts docs

- **#1** — `1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk` ("Future Planning - Outreach Drafts")
- **#2** — `1dtYDFnZUmjC6cMk-lTFpcoPQ_hWnxv6kQ8_uTwOaGmY` ("Future Planning - Outreach Drafts #2")

Both owned by `tej.nathoo@vanstartupweek.ca`, service account has Editor. List tabs via the Docs API to count and name what was drafted. Drive `files.get` with `modifiedTime` confirms the date.

### 5. "Thread with Andrew" Notion page

`38e6b6f2-b95b-8068-b183-c49d924e5906` — a live mirror of `#vsw-future-planning`, newest entry at top, so it is a timestamped record of what Tej and Andrew actually said to each other. Best source for: what Andrew asked for, what Tej sent him, when approval was requested, and what got redirected mid-day.

### 6. Slack `#vsw-future-planning`

Use the Slack tools directly when the Notion mirror looks incomplete (the mirror has known gaps around redeploys). Message timestamps are the only real clock in this whole system, so use them when Tej wants hours rather than bullets.

### 7. The week plan

`assets/artifact-src/week-plan.html` locally, published at `twelveoclock.co/vsw-week-plan`. The live site is the source of truth between the three copies. This tells you what the day was *supposed* to deliver, which is what makes "shipped it" or "carried it over" a real statement.

### 8. Calendar

Meetings, calls and blocks are work. Pull the range with the calendar tools. A two-hour call with Andrew belongs in the log as much as a commit does.

### 9. Notion project hub

`3886b6f2b95b80e7aa38ca1298a768ed` — check for pages created or edited in the range that the other sources missed.

---

## Phase 2 — Corroborate

Reconcile Tej's rundown against the evidence and produce a short reconciliation before writing any bullets. Four buckets:

- **Confirmed** — he said it, the evidence shows it. Say nothing, just use it.
- **Gaps** — the evidence shows work he did not mention. Add it. This is the single highest-value output of the skill; he consistently under-reports the small fixes and the research that led nowhere.
- **Discrepancies** — his number and the evidence's number differ. State both and use the evidence's. Never quietly average them or pick the flattering one.
- **Unverifiable** — he claims something no source can confirm (a phone call, thinking time, work done outside these systems). Keep it, mark it as his word, do not invent corroboration.

Show Tej the gaps and discrepancies before writing. One or two lines each. Do not write a report about the report.

**Never invent a number.** If the evidence gives 49 drafts and he remembers 50, ask which is right rather than picking. Per the Voice System: don't invent numbers, ask.

---

## Phase 3 — Write

### Fetch both guides live, every time

Do not write from memory of them and do not use a cached copy.

- **Voice System** — Notion `3716b6f2-b95b-818d-9c91-c6d25decffc1`
- **Stop Slop Guide** — Notion `5d33c81d-b930-419e-8557-41fbb4ec7629`

Both are living documents. The Voice System carries a cumulative feedback log that grows.

### Format

One fenced code block per day, so Tej can copy and paste each into the sheet without picking prose out of the way. Header the day outside the block.

Inside each block:

- **Bullets are input-based.** What Tej was doing at his computer. Not what the work achieved. Each bullet starts with a verb of the actual activity: researched, traced, rewrote, read back, screened, reconciled, rebuilt.
- **Every activity bullet is marked with `•`,** not a hyphen and not a markdown dash. The `•` is what Tej's time-tracking sheet expects, so the block pastes in clean.
- **One `NET IMPACT:` line at the bottom of the block.** All outcomes, counts and results live here and nowhere else. Three or four sentences at most, written as prose, with no `•` and no list of its own.

### Register

Default audience is **Andrew, a business lawyer, non-technical**, sitting at his screen asking what work actually got done. So:

- No file paths, no script names, no function names, no column letters, no API names in the bullets. "Rewrote scripts/run-report.ts to resolve headers" becomes "Fixed the report that had been scanning the wrong column and silently reporting everything clean."
- Name the *activity* and the *judgment*, since that is the labour. "Checked three other candidates first to confirm they were not existing VSW partners" reads as work. "Selected DMZ" does not.
- Keep the specifics that a non-technical reader can still verify: organisation names, counts, what was wrong and what it was corrected to.
- If Tej explicitly says the audience is technical, keep the file and script names. Ask if unstated and the day was heavily code-shaped.

### Voice rules that bite hardest here

From the Voice System (hard rules, no exceptions):

- **No em dashes.** Restructure with commas, periods or colons.
- **No thesis-antithesis.** Never "not X, it's Y" or "not just X, but Y". State what it is.
- Canadian spelling, with the standing exceptions.
- Exact numbers, never rounded.
- Claim, then name names. A broad assertion is followed immediately by the specific orgs, rows or outcomes that prove it.

From the Stop Slop Guide:

- Active voice with a named actor. "The tracker was corrupted" becomes "The tracker had been overwriting the tier every time someone was handed off."
- No throat-clearing openers, no emphasis crutches, no business jargon from the substitution table.
- Cut adverbs that carry no meaning: really, just, simply, actually, genuinely.
- Vary rhythm. Do not stack short fragments and do not default to three-item lists.
- Replace vague declaratives with the evidence itself.

Score the finished block against the Stop Slop dimensions (Directness, Rhythm, Trust, Authenticity, Density). Revise below 35/50. Do not show Tej the score unless he asks.

### Definition of done

Read the finished blocks back and verify:

- [ ] Every bullet describes an input, an activity Tej performed
- [ ] Every activity bullet is marked with `•`, no hyphens or dashes anywhere in the list
- [ ] Exactly one NET IMPACT line per day block, holding every outcome, written as prose without `•`
- [ ] Every number traced to a source in phase 1, none inferred
- [ ] Zero em dashes
- [ ] Zero thesis-antithesis constructions
- [ ] Zero banned phrases from the LLM tells list
- [ ] No file paths, script names or column letters, unless the audience is technical
- [ ] Gaps found in phase 2 are present in the bullets
- [ ] Discrepancies were raised with Tej outside the block, not silently resolved inside it
- [ ] Open items and carry-overs are offered separately, never folded into the day's work as if completed

---

## Notes

Open items, blockers and carry-overs are not time spent. Offer them as a separate block if the day produced any, and let Tej decide whether they belong in his sheet.

If the range spans several days, write one block per day rather than one merged block. Tej's sheet is per-day, and a merged block forces him to unpick it.
