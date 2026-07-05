import { scrapedAtNow } from "../time";

/**
 * URL path (PRD §4.1) — the service does NOT scrape URLs. It hands them
 * straight to n8n's existing engine and returns; n8n owns everything else
 * (Firecrawl/Stagehand, extract, dedup, write, its own Slack notice).
 */
export async function forwardUrlsToN8n(urls: string[], userLabel: string, userNote?: string): Promise<void> {
  const webhook = process.env.N8N_SCRAPE_URL_WEBHOOK;
  if (!webhook) throw new Error("N8N_SCRAPE_URL_WEBHOOK is not set");

  const note = `via Slack — ${userLabel}, ${scrapedAtNow()}`;
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, note, userNote: userNote || undefined }),
  });
  if (!res.ok) {
    throw new Error(`n8n webhook returned ${res.status} ${res.statusText}`);
  }
}
