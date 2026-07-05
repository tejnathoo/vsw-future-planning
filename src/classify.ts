import { getAnthropicClient } from "./anthropicClient";
import { CATEGORY_ENUM, type Category } from "./types";

export interface ClassifyInput {
  organization: string;
  evidence?: string;
  sourceLabel: string; // human-readable Source (col F) — grounds "Why Them"
  tier?: string; // "1".."10" or "-"
  /** Free-text context the user typed alongside the @mention (e.g. "this is the CVCA 50 — attribute to CVCA"). Trusted, not subject to D12 — use it to steer Sector/Why Them. */
  userNote?: string;
}

export interface Classification {
  category: Category;
  sector: string;
  whyThem: string;
}

const CATEGORY_LIST = CATEGORY_ENUM.join(", ");

/**
 * Classify one item into Category / Sector / Why Them.
 * Category MUST be a real enum value — the live master-prospects dropdown is
 * `strict`, so anything outside CATEGORY_ENUM is a hard error, not a guess
 * (AGENTS.md golden rule: never silently pick when a value is ambiguous;
 * here it's not ambiguous — it's a contract violation, so we throw and the
 * caller can retry/flag rather than write an invalid row).
 *
 * Tier-5 grant handling (PRD §8, resolved 2026-07-03): "Grant" is not a valid
 * Category. We still ask the model for a real category (e.g. "Gov" for most
 * government-run grant programs) and prefix Why Them with "Grant: " — plain
 * colon, no emoji, no em-dash.
 */
export async function classifyItem(input: ClassifyInput): Promise<Classification> {
  const isGrantTier = input.tier === "5";
  const prompt = `Classify this organisation for a sponsor-sourcing pipeline.

Organisation: ${input.organization}
Evidence: ${input.evidence || "(none provided)"}
Source: ${input.sourceLabel}
${input.userNote ? `\nContext from the person who submitted this (trusted — use it to inform Sector and Why Them, including any attribution instructions it gives):\n"""\n${input.userNote}\n"""\n` : ""}
Return STRICT JSON only, no markdown fences, in this exact shape:
{"category": "<one of: ${CATEGORY_LIST}>", "sector": "<short label, e.g. Cleantech, SaaS, Legal, Banking, Life Sciences>", "whyThem": "<<=20 words, grounded in the evidence and source>"}

Rules:
- category MUST be exactly one of the listed values, verbatim.
- whyThem must be grounded in the evidence/source given — do not invent facts.${
    isGrantTier
      ? '\n- This is a Tier-5 grant/funding source. Pick the real category that best fits (usually "Gov" for government-run programs). Do NOT write "Grant" as the category — it is not a valid value. Instead, prefix whyThem with exactly "Grant: " (plain colon, no emoji, no em-dash).'
      : ""
  }`;

  const msg = await getAnthropicClient().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let parsed: { category?: string; sector?: string; whyThem?: string };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`classifyItem: model did not return valid JSON: ${text.slice(0, 200)}`);
  }

  if (!parsed.category || !(CATEGORY_ENUM as readonly string[]).includes(parsed.category)) {
    throw new Error(`classifyItem: invalid category "${parsed.category}" for "${input.organization}" — must be one of: ${CATEGORY_LIST}`);
  }
  if (!parsed.sector || !parsed.whyThem) {
    throw new Error(`classifyItem: missing sector/whyThem for "${input.organization}"`);
  }
  if (isGrantTier && !parsed.whyThem.startsWith("Grant: ")) {
    parsed.whyThem = `Grant: ${parsed.whyThem}`;
  }

  return { category: parsed.category as Category, sector: parsed.sector, whyThem: parsed.whyThem };
}
