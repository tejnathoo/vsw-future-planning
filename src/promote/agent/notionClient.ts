/**
 * Thin Notion wrapper (PRD §11.6) — plain `fetch` against the REST API, no SDK
 * dependency, matching this repo's thin-client pattern. Writes one page (=one
 * row) per Promotion Agent run into the "Promotion Agent — Run Log" database
 * (`NOTION_PROMOTION_LOG_DATABASE_ID`), automatically after every run finishes,
 * regardless of outcome — not something the agent has to remember to trigger.
 */

const NOTION_VERSION = "2022-06-28";

function apiKey(): string {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY is not set");
  return key;
}

function databaseId(): string {
  const id = process.env.NOTION_PROMOTION_LOG_DATABASE_ID;
  if (!id) throw new Error("NOTION_PROMOTION_LOG_DATABASE_ID is not set");
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

export interface NotionRunLogInput {
  runId: string; // becomes the page title ("Run")
  trigger: "on-demand" | "nightly";
  status: "success" | "partial" | "failed";
  added: number;
  merged: number;
  skippedReview: number;
  skippedSourceType: number;
  failed: number;
  tokensSpent: number;
  firecrawlCalls: number;
  slackThreadUrl?: string;
}

export async function createRunLogPage(input: NotionRunLogInput): Promise<{ pageId: string; url: string }> {
  const properties: Record<string, any> = {
    Run: { title: [{ text: { content: input.runId } }] },
    Date: { date: { start: new Date().toISOString() } },
    Trigger: { select: { name: input.trigger } },
    Status: { select: { name: input.status } },
    Added: { number: input.added },
    Merged: { number: input.merged },
    "Skipped - Review": { number: input.skippedReview },
    "Skipped - Source Type": { number: input.skippedSourceType },
    Failed: { number: input.failed },
    "Tokens spent": { number: input.tokensSpent },
    "Firecrawl calls": { number: input.firecrawlCalls },
  };
  if (input.slackThreadUrl) properties["Slack thread"] = { url: input.slackThreadUrl };

  const page = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({ parent: { database_id: databaseId() }, properties }),
  });
  return { pageId: page.id, url: page.url };
}

/**
 * Appends the full trace (prompt/tool-call/result/error per row, citations,
 * golden-rule-#16 suggestions) as plain paragraph blocks — kept terse/YAML-ish
 * per §11.6 so the agent can cheaply re-read its own history later. `lines` is
 * one block per entry; Notion caps a request at 100 children, so this chunks.
 */
export async function appendRunLogBody(pageId: string, lines: string[]): Promise<void> {
  const blocks = lines.map((line) => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: line.slice(0, 2000) } }] },
  }));
  for (let i = 0; i < blocks.length; i += 100) {
    const chunk = blocks.slice(i, i + 100);
    await notionFetch(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: chunk }),
    });
  }
}
