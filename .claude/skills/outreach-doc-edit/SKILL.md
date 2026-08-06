---
name: outreach-doc-edit
description: Locate and edit a specific org's draft inside the Future Planning - Outreach Drafts Google Docs (#1 or #2) — re-routing a bounced email to a LinkedIn DM, adding/updating a LinkedIn note, or any other per-org tab edit. Use when Tej says things like "re-route [org] after the email bounced", "add the LinkedIn draft for [org]", "update [org]'s tab", or asks to edit a specific company's draft. Not for auditing/reading across drafts for a time-tracking summary — that's the work-log skill.
---

# Editing a single org's tab in an Outreach Drafts doc

This is the write-path counterpart to the `work-log` skill's read-only sweep. Use it whenever the
task is "go change this one org's draft," not "summarize what's in the docs."

## Step 1 — find the doc and the tab

**Fastest path: read the org's row in `master-prospects` and use its `Draft Link` cell.** It's
already a full URL to the exact doc + tab, e.g.
`https://docs.google.com/document/d/1dtYDFnZUmjC6cMk-lTFpcoPQ_hWnxv6kQ8_uTwOaGmY/edit?tab=t.db9qy2vw64gu`.
Parse the doc ID out of the path and the tab ID out of the `?tab=` query param. Key the row by
Organization Name, not row number (rows reshuffle — see CLAUDE.md).

**Fallback, if `Draft Link` is blank** — route by the row's `Tier` column:
- **Tier 1 & 2** → **Outreach Drafts #1** — `1Op9-2WQZYCjZ6GQKL0PVMi9OojzgKVuUxHhJqeZ8QTk`
- **Tier 3** → **Outreach Drafts #2** — `1dtYDFnZUmjC6cMk-lTFpcoPQ_hWnxv6kQ8_uTwOaGmY`

Both owned by `tej.nathoo@vanstartupweek.ca`, service account has Editor.

Then find the tab by title (org name) inside that doc — see the Tabs API note below for how.

## Step 2 — the fact that costs the most time to rediscover: these are real Docs Tabs

**Each org is an actual Google Docs Tab object, not a heading inside one flat document body.**
`documents.get({ documentId })` without the tabs flag returns only the *first* tab's content —
in these docs that's the tier-level tab (e.g. "Tier 3 (50)"), and every org lives in a
`childTabs` entry underneath it. A plain `body.content` scan will silently return nothing for
every org and give no error — this cost real time on 2026-08-04 before the cause was found.

```ts
const res = await docs.documents.get({ documentId: DOC_ID, includeTabsContent: true });

function findTabByTitle(tab: any, title: string): any {
  if (tab.tabProperties?.title === title) return tab;
  for (const c of tab.childTabs || []) {
    const r = findTabByTitle(c, title);
    if (r) return r;
  }
  return null;
}
let target: any = null;
for (const t of res.data.tabs || []) { target = findTabByTitle(t, orgName); if (target) break; }
const content = target.documentTab?.body?.content || [];
```

**Every read AND write location/range needs an explicit `tabId`.** `location: {tabId, index}`,
`range: {tabId, startIndex, endIndex}` — omitting it targets the wrong (first) tab silently.

Auth scope for writes: `https://www.googleapis.com/auth/documents` (not `.readonly` — these
tasks always end with a read-back verification pass, which also needs the write-capable client).

## Step 3 — pitfalls hit doing this for real (Sanctuary AI / SRED.ca, 2026-08-04)

- **`insertText` inherits the paragraph style of the insertion point.** Inserting a multi-line
  block immediately before an existing `HEADING_1` paragraph makes the *entire inserted block*
  render as `HEADING_1` by default, not just the one line meant to be a heading. Always follow a
  block insert with an explicit `updateParagraphStyle` (`NORMAL_TEXT`) for every line that isn't
  supposed to be a heading — and double check the fix range doesn't also catch a heading you
  wanted to keep (this happened: a `NORMAL_TEXT` reset range that ran one paragraph too far
  flattened the *next* real heading too, needing a second fix).
- **Replacing text inside an existing paragraph:** delete only the text content and leave the
  paragraph's own trailing `\n` alone — `deleteContentRange({start, end: end-1})` then
  `insertText` at `start` — so the paragraph's own formatting survives untouched instead of
  getting rebuilt from scratch.
- **`insertPageBreak` errors** ("insertion index must be inside the bounds of an existing
  paragraph") if pointed exactly at a structural boundary, e.g. a table's own start index. Target
  a character inside an adjacent blank paragraph instead.
- **Do the arithmetic-free way where you can, but when you can't, re-fetch before the next edit.**
  Chaining several index-shifting edits from hand-computed deltas is exactly how a duplicate page
  break slipped in once (see below). A read-back between edit passes is cheap insurance.

## Step 4 — the "re-routed after email bounced" tab convention

Established by Tej by hand on Sanctuary AI's tab; replicated for SRED.ca on 2026-08-04. At the
top of the tab, in this order:
1. `HEADING_1`: `"{Org}: Re-routed after email bounced"`
2. A plain paragraph with the contact's LinkedIn URL, hyperlinked (`textStyle.link.url`).
3. Blank paragraph.
4. The LinkedIn note — Stop-Slop-passed, ≤300 chars, canonical flow. See
   [docs/outreach-copy-playbook.md](../../../docs/outreach-copy-playbook.md) → "LinkedIn
   connection note — canonical flow and drafting rule" for the template, the char-budget fix
   order, and the possessive-form logic (`[Company]'s work on X` vs. the `your work on X`
   fallback for name-repeat cases).
5. Blank paragraph, then a **page break**.
6. The original draft's own heading, renamed to drop the now-redundant `"{Org}: "` prefix (e.g.
   `"Email A / chair@"`, not `"Sanctuary AI: Email A / chair@"`).
7. **A second page break right after that heading**, before its table — this is easy to miss
   because it sits oddly (embedded at the very end of the heading paragraph, not as its own
   blank paragraph). Its effect: the moved heading sits alone on its own page, separated from
   both the LinkedIn block above and the original draft's table/body below. Skipping it leaves
   the heading crammed onto the same page as the LinkedIn note, which is what actually happened
   on the first pass for SRED.ca and had to be fixed after the fact.

**Before drafting the note itself, check the row's `VSW` column.** A past sponsor (`VSW: TRUE`)
must get the re-engagement variant (see the playbook's "Re-engagement copy for past VSW sponsors"
section), never the cold "we're expanding..." template — sending a past partner cold copy is a
known, previously-made mistake (see the `returning_vsw_partners_mislabeled_cold` memory).

## Step 5 — before telling Tej it's done

Read the tab back — list every paragraph's start/end index, style, and any `pageBreak` elements
inside `paragraph.elements` (a page break is an inline element inside a paragraph, not its own
top-level content entry — a naive scan for top-level types will miss it). Every bug in Step 3 was
only caught this way, not by re-reading the batchUpdate response.

Then log the write in `EXECUTION-LOG.md` per CLAUDE.md's standing rule for any sheet/doc write.
