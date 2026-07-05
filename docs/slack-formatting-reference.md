# Slack formatting reference

Technical reference for every formatting tool available when this bot composes a Slack message. Companion to [slack-communication-style.md](slack-communication-style.md) (the *how to use these well* doc) — this file is just *what exists*. Researched from Slack's own developer docs (`docs.slack.dev`) 2026-07-05; re-verify against the live docs if something here looks stale — Slack does revise these pages.

Applies to every file that composes bot-facing text: [src/slack/reply.ts](../src/slack/reply.ts), [src/promote/agent/runAgent.ts](../src/promote/agent/runAgent.ts), [src/promote/agent/tools.ts](../src/promote/agent/tools.ts) (`ask_tej_on_slack`), [src/index.ts](../src/index.ts).

---

## 1. mrkdwn (Slack's own markup, not standard Markdown)

Slack calls its formatting language **mrkdwn** — deliberately not "markdown." It differs from GitHub-flavored Markdown in almost every particular. Used inside `text` fields typed `"mrkdwn"` (plain `text:` on a message, `section` blocks, `context` blocks).

| Style | Syntax | Notes |
|---|---|---|
| Bold | `*text*` | single asterisks, not double |
| Italic | `_text_` | underscores, not single asterisks |
| Strikethrough | `~text~` | tildes |
| Inline code | `` `text` `` | backticks |
| Code block | ` ```text``` ` | triple backticks |
| Block quote | `>text` at line start | |
| Line break | literal `\n` in the string | there is no `<br>` |
| Link (labeled) | `<https://url|label>` | **not** `[label](url)` — that's GitHub Markdown, Slack ignores it |
| Link (bare) | `<https://url>` | auto-links also work if the URL has no spaces around it |
| Email link | `<mailto:x@y.com|label>` | |
| User mention | `<@U12345>` | pings that user |
| Channel link | `<#C12345>` | |
| `@here` / `@channel` / `@everyone` | `<!here>` / `<!channel>` / `<!everyone>` | use sparingly — see the style doc |
| Date (localizes to viewer's timezone) | `<!date^1234567890^{date_pretty} at {time}|fallback text>` | rarely needed here; every timestamp in this bot is already America/Vancouver-explicit |
| Escaping | `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;` | only matters for literal `&`/`<`/`>` characters in dynamic content (e.g. an org name) |

**There is no native bullet-list syntax in plain mrkdwn text.** A line starting with `-` or `*` renders as literal text, not a list item — Slack's own docs say to "mimic list formatting with regular text and line breaks." This repo's convention: prefix each item with a real bullet character, `• `, and join with `\n` (see `bulletMessage` in `reply.ts`). For a *structurally real* list (not just a bullet-looking character), use a `rich_text_list` block (§3) — this repo doesn't need that yet since our lists are short and one level deep, but know it exists before reaching for a workaround.

## 2. Block Kit — the layout blocks this repo actually uses

Block Kit is Slack's structured, JSON-based message format — what you use for anything beyond "poking plain text through `text:`". A message body has a top-level `text` (the plain-text fallback shown in notifications/search — **always set this even when using `blocks`**) plus a `blocks` array, max 50 blocks per message.

### `section` — the workhorse
```json
{ "type": "section", "text": { "type": "mrkdwn", "text": "..." } }
```
- `text`: 1–3,000 characters.
- Optional `fields`: array of up to 10 more text objects (2,000 chars each), rendered as a compact 2-column grid — good for short label/value pairs, not used in this repo yet (our data doesn't naturally split into 2 columns).

### `context` — secondary/meta information, rendered small and gray
```json
{ "type": "context", "elements": [{ "type": "mrkdwn", "text": "..." }] }
```
- Up to 10 elements (text objects and/or images).
- This is what this repo uses for "Engine: ... · links" footers — Slack visually de-emphasizes it, which is exactly right for metadata that supports the result without competing with it.

### `divider` — a horizontal rule
```json
{ "type": "divider" }
```
No fields. Not currently used here — our messages are short enough that a visual separator hasn't been needed, but it's the right tool if a message ever grows a genuinely distinct second section (e.g. a summary + a separate "failures" block feels close to warranting one).

### `header` — large bold text, plain-text only
```json
{ "type": "header", "text": { "type": "plain_text", "text": "..." } }
```
- **150 characters max**, and it's `plain_text` only — no mrkdwn/emoji-shortcode/links inside it. Not used in this repo; our messages are short enough that a big header would be more ceremony than the content warrants (see the style doc's "don't perform formatting the content doesn't need").

### `rich_text` — the only way to get a *structurally real* bulleted/ordered/nested list
```json
{
  "type": "rich_text",
  "elements": [
    {
      "type": "rich_text_list",
      "style": "bullet",
      "elements": [
        { "type": "rich_text_section", "elements": [{ "type": "text", "text": "First item" }] },
        { "type": "rich_text_section", "elements": [{ "type": "text", "text": "Second item" }] }
      ]
    }
  ]
}
```
- `style: "bullet"` or `"ordered"`; nest with `"indent": 1, 2, ...`.
- `rich_text_quote` gives a real block-quote element (vertical bar), `rich_text_section` elements can carry `style: {bold, italic, strike, code}` per run of text.
- Worth reaching for if a list ever needs genuine nesting or nine-plus items; our `• `-prefixed mrkdwn lines (§1) are simpler and sufficient for the short, flat lists this bot produces today.

## 3. What this repo actually has, in code

- `doneMessage` — removed 2026-07-05; superseded by `bulletMessage` everywhere (was section + context, but with a `·`-joined single line instead of real bullets).
- `bulletMessage(intro, bullets, contextText, extraSections?)` (`src/slack/reply.ts`) — a `section` block (intro + `• `-bulleted body) + optional extra `section` block(s) (e.g. a failures list) + a `context` block (secondary links/metadata). This is the one helper every multi-item Slack reply in this codebase should go through — see the style doc for when "multi-item" applies.
- Plain `{ text, thread_ts }` — still correct and preferred for a genuinely single-fact message (a short ack, a one-line error, a one-line resume outcome). Don't wrap a one-liner in `blocks` just for the sake of it.

## Sources
- [Formatting message text | Slack Developer Docs](https://docs.slack.dev/messaging/formatting-message-text/)
- [Formatting with rich text | Slack Developer Docs](https://docs.slack.dev/block-kit/formatting-with-rich-text/)
- [Blocks reference | Slack Developer Docs](https://docs.slack.dev/reference/block-kit/blocks/)
- [Section block reference](https://docs.slack.dev/reference/block-kit/blocks/section-block)
- [Context block reference](https://docs.slack.dev/reference/block-kit/blocks/context-block)
- [Header block reference](https://docs.slack.dev/reference/block-kit/blocks/header-block)
- [Building with Block Kit | Slack](https://api.slack.com/block-kit/building)
