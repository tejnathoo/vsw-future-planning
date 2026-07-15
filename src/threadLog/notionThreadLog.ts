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

// ---- persisted state: Slack root message ts -> Notion thread bookkeeping ----

interface ThreadState {
  calloutBlockId: string; // the root message's own callout block
  toggleBlockId: string | null; // created lazily on the first reply
  replyCount: number;
}

interface ThreadLogState {
  [rootTs: string]: ThreadState;
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

function threadToggleBlock(replyCount: number): any {
  return {
    object: "block",
    type: "toggle",
    toggle: { rich_text: [{ type: "text", text: { content: `🧵 ${replyCount} ${replyCount === 1 ? "reply" : "replies"}` } }] },
  };
}

async function renameToggle(toggleId: string, replyCount: number): Promise<void> {
  await notionFetch(`/blocks/${toggleId}`, {
    method: "PATCH",
    body: JSON.stringify({
      toggle: { rich_text: [{ type: "text", text: { content: `🧵 ${replyCount} ${replyCount === 1 ? "reply" : "replies"}` } }] },
    }),
  });
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
    // Top-level entries are each anchored by their OWN send time this way, so
    // the main flow of the page stays strictly chronological on its own —
    // replies live inside a collapsed toggle (below) instead of inline, so a
    // long-running thread's later replies never push older entries around or
    // get buried under newer unrelated messages.
    const marker = await findMarkerBlockId();
    const inserted = await notionFetch(`/blocks/${pageId()}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: [dividerBlock(), dateBlock, callout], after: marker }),
    });
    const calloutBlockId = inserted.results[2].id;
    const state = readState();
    state[rootTs] = { calloutBlockId, toggleBlockId: null, replyCount: 0 };
    writeState(state);
    return;
  }

  // Reply: goes inside a collapsed "🧵 N replies" toggle directly under the
  // root message's callout, created lazily on the first reply. Every later
  // reply is appended as a child of that same toggle (Notion's default
  // append-to-end behavior on /children with no `after` keeps them in the
  // order they arrived), so the toggle's position never has to move even as
  // new replies keep coming in hours after unrelated newer messages arrived.
  const state = readState();
  const thread = state[rootTs];
  if (!thread) {
    // Root predates this automation (or state was lost on redeploy) — fall
    // back to logging it as a new top-level entry rather than dropping it.
    const marker = await findMarkerBlockId();
    const inserted = await notionFetch(`/blocks/${pageId()}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: [dividerBlock(), dateBlock, callout], after: marker }),
    });
    state[rootTs] = { calloutBlockId: inserted.results[2].id, toggleBlockId: null, replyCount: 0 };
    writeState(state);
    return;
  }

  thread.replyCount += 1;
  if (!thread.toggleBlockId) {
    const toggleInserted = await notionFetch(`/blocks/${pageId()}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: [threadToggleBlock(thread.replyCount)], after: thread.calloutBlockId }),
    });
    thread.toggleBlockId = toggleInserted.results[0].id;
  } else {
    await renameToggle(thread.toggleBlockId, thread.replyCount);
  }
  await notionFetch(`/blocks/${thread.toggleBlockId}/children`, {
    method: "PATCH",
    body: JSON.stringify({ children: [dateBlock, callout] }),
  });
  state[rootTs] = thread;
  writeState(state);
}
