import { getAnthropicClient, parseStrictJson } from "../anthropicClient";
import type { Item } from "../types";

export interface TextExtractionResult {
  items: Item[];
  dropped: number; // hallucination post-check (D12) failures
}

const CHUNK_MAX_CHARS = 6000;

/**
 * Split text into chunks no larger than maxChars, breaking on paragraph
 * boundaries where possible so an org mention isn't split across chunks.
 * Falls back to a hard split for a single paragraph longer than maxChars.
 * Pure + unit-tested.
 */
export function chunkText(text: string, maxChars = CHUNK_MAX_CHARS): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (para.length <= maxChars) {
      current = para;
    } else {
      // a single paragraph exceeds the limit — hard-split it
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

/**
 * D12 anti-hallucination post-check: drop any item whose organization name
 * isn't a case-insensitive substring of the source text. Pure + unit-tested
 * separately from the network call.
 */
export function postCheckOrgs(items: Item[], sourceText: string): TextExtractionResult {
  const lowerText = sourceText.toLowerCase();
  let dropped = 0;
  const filtered = items.filter((item) => {
    const ok = !!item.organization && lowerText.includes(item.organization.toLowerCase());
    if (!ok) dropped += 1;
    return ok;
  });
  return { items: filtered, dropped };
}

async function extractFromChunk(chunk: string, userNote?: string): Promise<Item[]> {
  const prompt = `Extract every distinct company/organisation name mentioned in this document excerpt. Return STRICT JSON only, no markdown fences, in this exact shape:
{"items":[{"organization":"","evidence":""}]}

Rules:
- Only include organisations (companies, firms, agencies, funds, associations, government programs), not people.
- Preserve exact display casing of names as they appear in the excerpt.
- evidence is a SHORT snippet (<=10 words) from the excerpt proving the organisation is mentioned.
- If no organisations are mentioned, return {"items":[]}.
${userNote ? `\nContext from the person who submitted this document (use it to understand what this document is and why these organisations matter — do not extract organisations mentioned only in this context block, only from the excerpt itself):\n"""\n${userNote}\n"""\n` : ""}
Document excerpt:
"""
${chunk}
"""`;

  const msg = await getAnthropicClient().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  if (msg.stop_reason === "max_tokens") {
    throw new Error("extractFromChunk: response was truncated even for a single chunk — reduce CHUNK_MAX_CHARS");
  }

  const responseText = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  let parsed: { items?: Item[] };
  try {
    parsed = parseStrictJson<{ items?: Item[] }>(responseText);
  } catch {
    throw new Error(`extractFromChunk: model did not return valid JSON: ${responseText.slice(0, 200)}`);
  }
  return parsed.items || [];
}

/**
 * Markdown/plain-text path (PRD §4.5, AGENTS.md §Markdown/plain-text) —
 * Anthropic, not Gemini: there's no visual content, so this is a text task
 * like classification. Chunks the document so extraction scales to any
 * document size rather than hoping one call's max_tokens is enough.
 * Because we have the full source text, the D12 anti-hallucination substring
 * check applies here (unlike vision/PDF) — any extracted org name that isn't
 * actually in the text gets dropped, counted, never silently kept
 * (AGENTS.md golden rule #3/#12).
 */
export async function extractOrgsFromText(text: string, userNote?: string): Promise<TextExtractionResult> {
  const chunks = chunkText(text);
  const perChunk = await Promise.all(chunks.map((chunk) => extractFromChunk(chunk, userNote)));
  const allItems = perChunk.flat();
  return postCheckOrgs(allItems, text);
}
