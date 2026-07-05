import { getGeminiClient, parseStrictJson } from "../geminiClient";
import type { Item } from "../types";

/**
 * Image path (PRD §4.3, AGENTS.md §Vision+PDF) — Gemini vision reads sponsor
 * logos off a flyer/deck screenshot. No fetched text exists to check extracted
 * names against, so unlike the text path there's no D12 substring check here;
 * the caller compensates by forcing brand-new orgs to Review
 * (RunContext.forceReviewForNewOrgs) rather than trusting the read blind.
 */
export async function extractOrgsFromImage(buf: Buffer, mimeType: string, userNote?: string): Promise<Item[]> {
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-pro";
  const prompt = `Identify every distinct company/organisation logo or wordmark visible in this image. Return STRICT JSON only, no markdown fences, in this exact shape:
{"items":[{"organization":"","evidence":"logo visible in image"}]}

Rules:
- Only include organisations you can identify with reasonable confidence from the logo/wordmark itself.
- Skip illegible, generic, or ambiguous marks rather than guessing.
- If no logos are identifiable, return {"items":[]}.
- evidence should note roughly where in the image it appears if useful (e.g. "top banner", "bottom row"), otherwise just "logo visible in image".${
    userNote ? `\n\nContext from the person who submitted this image (use it to understand what this image is, not as a source of organisation names by itself):\n"""\n${userNote}\n"""` : ""
  }`;

  const response = await getGeminiClient().models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType, data: buf.toString("base64") } }],
      },
    ],
  });

  const text = (response.text || "").trim();
  if (!text) throw new Error("extractOrgsFromImage: empty response from Gemini");

  let parsed: { items?: Item[] };
  try {
    parsed = parseStrictJson<{ items?: Item[] }>(text);
  } catch {
    throw new Error(`extractOrgsFromImage: model did not return valid JSON: ${text.slice(0, 200)}`);
  }
  return parsed.items || [];
}
