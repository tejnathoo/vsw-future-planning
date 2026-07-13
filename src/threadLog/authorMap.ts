/**
 * Maps Slack user IDs in #vsw-future-planning to how they should appear as
 * the author of a "Thread with Andrew" Notion entry (notionThreadLog.ts).
 * Mirrors the convention already used by the hand-written history on that
 * page: Andrew is a Notion page mention, Tej is a Notion user mention,
 * everyone else (currently just Vivian) is plain text.
 *
 * Add a new person here (and nowhere else) when someone new starts posting
 * in that channel — unmapped users fall back to their Slack display name as
 * plain text, so nothing is silently dropped, but new regulars are worth
 * promoting to a real Notion mention for consistency with the rest of the page.
 */
export type NotionAuthor =
  | { kind: "notion-page"; pageId: string }
  | { kind: "notion-user"; userId: string }
  | { kind: "plain"; name: string };

const AUTHOR_MAP: Record<string, NotionAuthor> = {
  // Tej Nathoo — tej.nathoo@vanstartupweek.ca
  U08TKLJH4QL: { kind: "notion-user", userId: "2e453c67-7fef-4b8f-860d-f3ab0b533dd2" },
  // Andrew — andrew@vanstartupweek.ca / andrew@dilts.ca
  U8QPULMJS: { kind: "notion-page", pageId: "3666b6f2-b95b-80a3-a43c-f2e3cdf646f4" },
  // Vivian Chan / Vivian Lago — vivianchan03@gmail.com
  U84RK49M4: { kind: "plain", name: "Vivian Lago" },
};

/** `fallbackName` is the Slack display name, fetched via `users.info` if this user isn't mapped. */
export function resolveNotionAuthor(slackUserId: string, fallbackName: string): NotionAuthor {
  return AUTHOR_MAP[slackUserId] ?? { kind: "plain", name: fallbackName };
}

/**
 * `@mention` -> plain "@Name" text used *inline within a message body*
 * (e.g. "@Tej - good morning"), matching the page's established convention
 * of not using live mentions inside callout prose, only in the "from" line.
 */
const INLINE_MENTION_NAME: Record<string, string> = {
  U08TKLJH4QL: "Tej",
  U8QPULMJS: "Andrew",
  U84RK49M4: "Vivian",
};

export function inlineMentionName(slackUserId: string, fallbackName: string): string {
  return INLINE_MENTION_NAME[slackUserId] ?? fallbackName;
}
