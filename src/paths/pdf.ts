import { getGeminiClient, parseStrictJson } from "../geminiClient";
import type { Item } from "../types";

// Inline base64 requests get unwieldy well before Gemini's hard request-size
// cap — anything bigger goes through the File API instead (AGENTS.md).
const INLINE_LIMIT_BYTES = 15 * 1024 * 1024;
const FILE_ACTIVE_POLL_MS = 1500;
const FILE_ACTIVE_TIMEOUT_MS = 60_000;

export interface PdfExtractionResult {
  items: Item[];
  truncated: boolean; // Gemini's own response said the document was too large to read in full
}

function buildPrompt(userNote?: string): string {
  return `Extract every distinct company/organisation name mentioned or shown as a logo/wordmark in this PDF (sponsor decks often have logo-only pages, not just text). Return STRICT JSON only, no markdown fences, in this exact shape:
{"items":[{"organization":"","evidence":""}],"truncated":false}

Rules:
- Only include organisations (companies, firms, agencies, funds, associations, government programs), not people.
- evidence is a SHORT note (<=10 words) on where/how it appears (e.g. "logo, page 3", "listed as gold sponsor").
- Set "truncated": true only if you were not able to read the entire document (e.g. it was cut off).
- If no organisations are found, return {"items":[],"truncated":false}.${
    userNote ? `\n\nContext from the person who submitted this document (use it to understand what this document is, not as a source of organisation names by itself):\n"""\n${userNote}\n"""` : ""
  }`;
}

async function waitForFileActive(name: string): Promise<void> {
  const ai = getGeminiClient();
  const deadline = Date.now() + FILE_ACTIVE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const file = await ai.files.get({ name });
    if (file.state === "ACTIVE") return;
    if (file.state === "FAILED") throw new Error(`Gemini file processing failed for ${name}`);
    await new Promise((r) => setTimeout(r, FILE_ACTIVE_POLL_MS));
  }
  throw new Error(`Gemini file ${name} did not become ACTIVE within ${FILE_ACTIVE_TIMEOUT_MS}ms`);
}

/**
 * PDF path (PRD §4.4, AGENTS.md §Vision+PDF) — Gemini document understanding,
 * not a text-only parser, since sponsor decks have logo-only pages a text
 * parser misses. Small PDFs are inlined; larger ones go through the Gemini
 * File API. Like the image path, there's no fetched text to run the D12
 * substring check against, so the caller forces brand-new orgs to Review.
 */
export async function extractOrgsFromPdf(buf: Buffer, userNote?: string): Promise<PdfExtractionResult> {
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-pro";
  const ai = getGeminiClient();
  const prompt = buildPrompt(userNote);

  let filePart: { fileData: { fileUri: string; mimeType: string } } | { inlineData: { mimeType: string; data: string } };
  if (buf.length > INLINE_LIMIT_BYTES) {
    const uploaded = await ai.files.upload({
      file: new Blob([new Uint8Array(buf)], { type: "application/pdf" }),
      config: { mimeType: "application/pdf" },
    });
    if (!uploaded.name || !uploaded.uri) throw new Error("extractOrgsFromPdf: file upload did not return a name/uri");
    await waitForFileActive(uploaded.name);
    filePart = { fileData: { fileUri: uploaded.uri, mimeType: "application/pdf" } };
  } else {
    filePart = { inlineData: { mimeType: "application/pdf", data: buf.toString("base64") } };
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }, filePart] }],
  });

  const text = (response.text || "").trim();
  if (!text) throw new Error("extractOrgsFromPdf: empty response from Gemini");

  let parsed: { items?: Item[]; truncated?: boolean };
  try {
    parsed = parseStrictJson<{ items?: Item[]; truncated?: boolean }>(text);
  } catch {
    throw new Error(`extractOrgsFromPdf: model did not return valid JSON: ${text.slice(0, 200)}`);
  }
  return { items: parsed.items || [], truncated: !!parsed.truncated };
}
