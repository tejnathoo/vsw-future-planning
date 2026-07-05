/**
 * Shared Slack message builders. Before adding a new message shape here, read
 * ../../docs/slack-formatting-reference.md (what Block Kit/mrkdwn tools exist)
 * and ../../docs/slack-communication-style.md (when/why to use which one) —
 * this file is where those two docs get applied in code, not just described.
 */

/**
 * Same section+context shape as the old `doneMessage` (removed 2026-07-05),
 * but for a body that reads as a scannable bullet list rather than one dense
 * `·`-joined line, and a context line that can carry more than one link (e.g.
 * the Promotion Agent's Master sheet + Notion log entry). `extraSections`
 * become their own section block(s) below the bullets — e.g. a "these didn't
 * go through" failures list — so they stay visually distinct from the main
 * result instead of running into it. This is the one helper every Slack reply
 * with 3+ distinct pieces of information should go through (style doc, "the
 * 3-line rule") — a genuinely one-line ack or error should stay a plain
 * `{ text, thread_ts }`, not get wrapped in blocks for its own sake.
 */
export function bulletMessage(intro: string, bullets: string[], contextText: string, extraSections: string[] = []) {
  const bulletLines = bullets.map((b) => `• ${b}`).join("\n");
  const fallback = [intro, ...bullets].join(" · ") + (extraSections.length ? `\n\n${extraSections.join("\n\n")}` : "");
  return {
    text: fallback,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `${intro}\n\n${bulletLines}` } },
      ...extraSections.map((s) => ({ type: "section" as const, text: { type: "mrkdwn" as const, text: s } })),
      { type: "context", elements: [{ type: "mrkdwn", text: contextText }] },
    ],
  };
}
