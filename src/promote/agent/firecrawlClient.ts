/**
 * Thin Firecrawl wrapper (PRD §11.4 / AGENTS.md golden rule #5 scoped exception)
 * — plain `fetch` against the REST API, matching this repo's existing
 * thin-client-wrapper pattern (anthropicClient.ts, geminiClient.ts). No SDK dep.
 * Used ONLY by the Promotion Agent's own research tools, never by the intake
 * paths (which still forward URLs to n8n, unchanged).
 */

function apiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not set");
  return key;
}

export interface FirecrawlSearchResult {
  title: string;
  url: string;
  description: string;
}

export async function firecrawlSearch(query: string): Promise<FirecrawlSearchResult[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit: 5 }),
  });
  if (!res.ok) throw new Error(`firecrawl_search failed: ${res.status} ${await res.text()}`);
  const json: any = await res.json();
  const web = json?.data?.web || json?.data || [];
  return web.map((r: any) => ({
    title: r.title || "",
    url: r.url || "",
    description: r.description || "",
  }));
}

/** Returns clean markdown, truncated to keep the agent loop's context bounded. */
export async function firecrawlScrape(url: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });
  if (!res.ok) throw new Error(`firecrawl_scrape failed: ${res.status} ${await res.text()}`);
  const json: any = await res.json();
  const markdown: string = json?.data?.markdown || "";
  return markdown.slice(0, 8000);
}
