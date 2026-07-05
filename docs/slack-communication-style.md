# Slack communication style

How this bot should *use* the tools in [slack-formatting-reference.md](slack-formatting-reference.md) — not what exists, but when and why. Synthesized 2026-07-05 from Slack's own etiquette/best-practice guidance and widely-cited async/remote-work writing practices (sources at the bottom). This is the concrete "how" underneath AGENTS.md golden rule #12 ("Slack replies should read like a teammate, not a system log") — read that rule first; this doc is its expansion, not a competing standard.

---

## The five principles, distilled

1. **One comprehensive message, not a drip of fragments.** Every notification interrupts. Say everything relevant in the one message you send, rather than a first message and a fast follow-up. *This bot already does this* — one ack, then one result, never a stream of partial updates. Keep it that way as new paths get added.
2. **The 3-line rule.** If a message would run past ~3 lines of plain prose, it needs structure (bullets, a context footer) — not because bullets are fancier, but because a wall of `·`-joined clauses makes a reader parse before they can act. Below 3 lines, structure is often *more* friction than the content warrants — a short ack doesn't need a bulleted list to say "got your CSV, one sec."
3. **Context, clarity, action.** A good message answers, in order: *what is this about* (context), *what happened, unambiguously* (clarity), *what, if anything, does the reader need to do* (action). A run summary that buries "1 skipped (need you to confirm the match)" inside a dense line makes the reader re-read to find their action item; as its own bullet, it's unmissable.
4. **An aside is not a suffix.** `"...one sec 📄 (and by the way X)"` reads as one breathless sentence. If a thought is genuinely secondary, give it its own line (`\n\n(...)`) — don't graft it onto the end of the sentence carrying the main point. If it's not secondary, it shouldn't be parenthetical at all.
5. **Secondary information is visually secondary.** Links to the underlying Sheet/Notion page, Run IDs, "Engine: X" labels — none of this is the *result*, it's provenance for someone who wants to dig in. Slack's `context` block renders smaller and gray for exactly this reason (see the formatting doc §2) — use it for exactly this content, every time, rather than tacking a link onto the end of the result line.

## Concrete before/after, from this bot's own code

**A "done" summary** (CSV/text/image/pdf paths, `src/index.ts`):
```
Before: Done! 4 new · 1 merged · 0 already in Master · 2 flagged for review
        Run 20260704-1200-slack-csv

After:  Done!

        • 4 new
        • 1 merged
        • 2 flagged for review
        [context] 📊 Open Data Staging  •  Run 20260704-1200-slack-csv
```
The reader scans a list in one pass instead of parsing a `·`-delimited sentence; the Run ID/link move to context, where they belong (nobody needs the Run ID to understand what happened — they need it if they're about to go debug something).

**An ack with an aside** (the `promote` command):
```
Before: On it — sweeping data-staging for Approved rows and working through
        them now, one sec 📋 (I'll ask in here if I need anything from you.)

After:  On it — sweeping data-staging for Approved rows and working through
        them now, one sec 📋

        (I'll ask in here if I need anything from you.)
```
Same words, but the aside no longer reads as a trailing clause of the main sentence — it's clearly a separate, secondary note.

**When *not* to add structure** — a one-line ack like `Got your CSV (sponsors.csv) — digging through it now, one sec 📄` stays exactly as it is. It's one fact, already scannable; wrapping it in bullets or a context block would be formatting the content doesn't need (principle 2, inverted) — see the "don't perform formatting" line in the formatting doc's `header` section for the same idea applied to a different block type.

## A short pre-send checklist

Before a new Slack message ships in this codebase, ask:
- Is this genuinely one message, or did I just chain two unrelated facts together with "and"/parentheses? Split or restructure.
- Does it have 3+ distinct pieces of information (counts, statuses, multiple outcomes)? → `bulletMessage`, not a `·`-joined string.
- Is there a link, Run ID, or "Engine: X" label? → `context` block, not the main body.
- Does every error message say what happened *and* leave the reader knowing what to do next (retry, rename a column, wait for a research answer)? A bare stack-trace-flavored string fails this; `Ran into a snag processing that CSV: <specific reason>` passes it.
- Read it once, cold. Would a teammate reading only this message — no other context — know what happened and whether they need to act? If not, it's not done.

## Sources
- [Collaborate with kindness: etiquette tips in Slack](https://slack.com/blog/collaboration/etiquette-tips-in-slack)
- [Internal Communications Best Practices | Slack](https://slack.com/blog/collaboration/internal-communications-best-practices)
- [Easy dos and don'ts | Slack](https://api.slack.com/best-practices/dos-and-donts) (app/bot notification guidance specifically)
- [How to Write Effective Slack Messages: 10+ Real Examples](https://www.zivy.app/blog/how-to-write-effective-slack-messages) (source of the "3-line rule" framing)
- [GitLab Handbook — Asynchronous communication for remote work](https://handbook.gitlab.com/handbook/company/culture/all-remote/asynchronous/) (over-communicate context, document outcomes, assume positive intent)
