/**
 * Live mirror of #vsw-future-planning into the "Thread with Andrew" Notion
 * page. Every message and thread reply in that channel gets appended as a
 * new entry, newest at the top, matching the format of the page's existing
 * hand-written history (see the page's own "Agent instructions" callout).
 *
 * Plain `fetch` against the REST API, no SDK — same thin-client pattern as
 * `promote/agent/notionClient.ts`. Kept as its own module (rather than
 * extending that one) because it writes arbitrary page blocks, not database
 * rows, and has its own persisted state (thread ts -> insertion anchor).
 */
import * as fs from "fs";
import * as path from "path";
import { scrapedAtNow } from "../time";
import { resolveNotionAuthor, inlineMentionName, type NotionAuthor } from "./authorMap";
import { slackTextToRichText } from "./slackMrkdwn";

const NOTION_VERSION = "2022-06-28";
const MARKER_TEXT = "[Next email here]";

function apiKey(): string {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY is not set");
  return key;
}

function pageId(): string {
  const id = process.env.NOTION_THREAD_LOG_PAGE_ID;
  if (!id) throw new Error("NOTION_THREAD_LOG_PAGE_ID is not set");
  return id;
}

async function notionFetch(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Notion API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---- persisted state: Slack root message ts -> Notion insertion anchor ----

interface ThreadLogState {
  // keyed by the *thread root* ts; value is the block id to insert the next
  // reply after (starts as the root's own callout block, advances to each
  // new reply's callout block as replies arrive, so replies stack in order).
  [rootTs: string]: string;
}

function statePath(): string {
  return process.env.THREAD_LOG_STATE_PATH_OVERRIDE || path.join(__dirname, "..", "..", "state", "thread-log.json");
}

function readState(): ThreadLogState {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeState(state: ThreadLogState): void {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n", "utf-8");
}

// ---- anchor discovery: find the "[Next email here]" marker paragraph ----

let cachedMarkerBlockId: string | null = null;

async function findMarkerBlockId(): Promise<string> {
  if (cachedMarkerBlockId) return cachedMarkerBlockId;
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const qs = cursor ? `?page_size=20&start_cursor=${cursor}` : "?page_size=20";
    const data = await notionFetch(`/blocks/${pageId()}/children${qs}`, { method: "GET" });
    for (const block of data.results) {
      if (block.type !== "paragraph") continue;
      const text = (block.paragraph.rich_text || []).map((rt: any) => rt.plain_text || "").join("");
      if (text.includes(MARKER_TEXT)) {
        cachedMarkerBlockId = block.id;
        return block.id;
      }
    }
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  throw new Error(`Could not find the "${MARKER_TEXT}" marker block on the Thread with Andrew page`);
}

// ---- block builders ----

function authorRichText(author: NotionAuthor): any[] {
  if (author.kind === "notion-page") return [{ type: "mention", mention: { type: "page", page: { id: author.pageId } } }];
  if (author.kind === "notion-user") return [{ type: "mention", mention: { type: "user", user: { id: author.userId } } }];
  return [{ type: "text", text: { content: author.name } }];
}

function dateParagraphBlock(iso: string, author: NotionAuthor, isReply: boolean): any {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        { type: "mention", mention: { type: "date", date: { start: iso, time_zone: null } } },
        { type: "text", text: { content: isReply ? " ↳ reply from " : " from " } },
        ...authorRichText(author),
      ],
    },
  };
}

function calloutBlock(bodyRichText: any[], fileNote: string | null): any {
  const rich_text = [{ type: "text", text: { content: "(Slack)\n" } }, ...bodyRichText];
  if (fileNote) rich_text.push({ type: "text", text: { content: `\n${fileNote}` } });
  return { object: "block", type: "callout", callout: { rich_text, icon: { type: "emoji", emoji: "💬" } } };
}

function dividerBlock(): any {
  return { object: "block", type: "divider", divider: {} };
}

// ---- Slack user display-name lookup (fallback for unmapped users) ----

const nameCache = new Map<string, string>();

async function slackDisplayName(userId: string, slackClient: any): Promise<string> {
  if (nameCache.has(userId)) return nameCache.get(userId)!;
  try {
    const info = await slackClient.users.info({ user: userId });
    const name = info.user?.profile?.real_name || info.user?.real_name || info.user?.name || userId;
    nameCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
}

// ---- public entry point ----

export interface SlackMessageForLog {
  ts: string;
  threadTs?: string; // present on both the root (once it has replies) and every reply
  userId: string;
  text: string;
  fileNames?: string[];
}

/**
 * Records one Slack message (top-level or thread reply) into the Notion page.
 * Safe to call for every non-bot, non-subtype message in the channel — the
 * caller (index.ts) is responsible for filtering to #vsw-future-planning and
 * skipping bot/subtype events before calling this.
 */
export async function recordSlackMessage(msg: SlackMessageForLog, slackClient: any): Promise<void> {
  const isReply = !!msg.threadTs && msg.threadTs !== msg.ts;
  const rootTs = msg.threadTs || msg.ts;

  const displayName = await slackDisplayName(msg.userId, slackClient);
  const author = resolveNotionAuthor(msg.userId, displayName);
  const resolveUserName = (id: string) => inlineMentionName(id, nameCache.get(id) || id);

  const iso = scrapedAtNow(new Date(Number(msg.ts.split(".")[0]) * 1000));
  const bodyRichText = slackTextToRichText(msg.text, resolveUserName);
  const fileNote = msg.fileNames && msg.fileNames.length ? `(file attached: ${msg.fileNames.join(", ")})` : null;

  const dateBlock = dateParagraphBlock(iso, author, isReply);
  const callout = calloutBlock(bodyRichText, fileNote);

  if (!isReply) {
    // New top-level message: always insert right after the marker, so the
    // most-recently-sent message ends up closest to the top, newest-first —
    // the existing divider that used to follow the marker rides along after
    // our new blocks, so we only need to add our own divider *before* them.
    const marker = await findMarkerBlockId();
    const inserted = await notionFetch(`/blocks/${pageId()}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: [dividerBlock(), dateBlock, callout], after: marker }),
    });
    const calloutBlockId = inserted.results[2].id;
    const state = readState();
    state[rootTs] = calloutBlockId;
    writeState(state);
    return;
  }

  // Reply: nest directly under the last block recorded for this thread
  // (initially the root message's own callout, then each subsequent reply),
  // so a multi-reply thread reads top-to-bottom in the order it happened —
  // matching the page's existing "↳ reply" convention.
  const state = readState();
  let anchor = state[rootTs];
  if (!anchor) {
    // Root predates this automation (or state was lost on redeploy) — fall
    // back to logging it as a new top-level entry rather than dropping it.
    const marker = await findMarkerBlockId();
    const inserted = await notionFetch(`/blocks/${pageId()}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: [dividerBlock(), dateBlock, callout], after: marker }),
    });
    anchor = inserted.results[2].id;
    state[rootTs] = anchor;
    writeState(state);
    return;
  }
  const inserted = await notionFetch(`/blocks/${pageId()}/children`, {
    method: "PATCH",
    body: JSON.stringify({ children: [dateBlock, callout], after: anchor }),
  });
  state[rootTs] = inserted.results[1].id;
  writeState(state);
}
