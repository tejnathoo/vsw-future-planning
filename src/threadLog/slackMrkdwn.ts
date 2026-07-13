import { inlineMentionName } from "./authorMap";

/** One Notion rich_text object, trimmed to just what this module needs to produce. */
type RichText =
  | { type: "text"; text: { content: string; link?: { url: string } | null }; annotations?: { bold?: boolean; code?: boolean } }
  ;

const NOTION_TEXT_LIMIT = 1900; // Notion's real cap is 2000; leave headroom.

function chunk(content: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < content.length; i += NOTION_TEXT_LIMIT) out.push(content.slice(i, i + NOTION_TEXT_LIMIT));
  return out.length ? out : [""];
}

function plainRuns(content: string): RichText[] {
  // Split on *bold* and `code` spans, longest-match-first so they don't nest.
  const runs: RichText[] = [];
  const pattern = /(\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content))) {
    if (m.index > last) pushText(content.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("*")) pushText(token.slice(1, -1), { bold: true });
    else pushText(token.slice(1, -1), { code: true });
    last = m.index + token.length;
  }
  if (last < content.length) pushText(content.slice(last));
  return runs;

  function pushText(text: string, annotations?: { bold?: boolean; code?: boolean }) {
    for (const c of chunk(text)) {
      if (!c) continue;
      runs.push({ type: "text", text: { content: c }, ...(annotations ? { annotations } : {}) });
    }
  }
}

/**
 * Converts a raw Slack message `text` (mrkdwn, with `<@U…>` / `<#C…|name>` /
 * `<url|label>` tokens) into Notion rich_text blocks. `resolveUserName` is
 * used only as the fallback label for an unmapped `<@U…>` with no `|label`
 * in the token itself (Slack omits the label when the sender didn't type one).
 */
export function slackTextToRichText(text: string, resolveUserName: (id: string) => string): RichText[] {
  const out: RichText[] = [];
  const tokenPattern = /<(@([A-Z0-9]+)(?:\|([^>]*))?|#([A-Z0-9]+)(?:\|([^>]*))?|(https?:\/\/[^|>]+)(?:\|([^>]*))?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenPattern.exec(text))) {
    if (m.index > last) out.push(...plainRuns(text.slice(last, m.index)));
    if (m[2]) {
      // <@UID> or <@UID|label>
      const name = m[3] || resolveUserName(m[2]) || inlineMentionName(m[2], m[2]);
      out.push({ type: "text", text: { content: `@${name}` } });
    } else if (m[4]) {
      // <#CID|name>
      out.push({ type: "text", text: { content: `#${m[5] || m[4]}` } });
    } else if (m[6]) {
      // <url> or <url|label>
      const url = m[6];
      const label = m[7] || url;
      out.push({ type: "text", text: { content: label, link: { url } } });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...plainRuns(text.slice(last)));
  return out.length ? out : [{ type: "text", text: { content: "" } }];
}
