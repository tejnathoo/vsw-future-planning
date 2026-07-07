import { getAnthropicClient, parseStrictJson } from "../anthropicClient";
import { sameOrg } from "../dedup";
import type { MasterPromotionEntry } from "../types";

export type OrgMatchResult =
  | { status: "matched"; rowNumber: number; organization: string }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "none" };

/**
 * Ask the model to pick the best match for `nameGuess` among `candidateNames`,
 * or say none — used only when the deterministic sameOrg() pass finds nothing
 * (e.g. "Pacific Can" meant for a row actually named something else in the
 * sheet). Injectable so tests can stub it without hitting the network.
 */
export async function llmMatchOrg(nameGuess: string, candidateNames: string[]): Promise<string | null> {
  if (candidateNames.length === 0) return null;
  const prompt = `A teammate typed a company name that should match one row in a list of known organizations, but the wording may differ (abbreviation, missing legal suffix, informal name, typo). Given the typed name and the list, return STRICT JSON only, no markdown fences:
{"match": "<exact string from the list, or null if you are not reasonably confident any single one is the same organization>"}

Typed name: "${nameGuess}"

Known organizations:
${candidateNames.map((n) => `- ${n}`).join("\n")}`;

  const msg = await getAnthropicClient().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  try {
    const parsed = parseStrictJson<{ match: string | null }>(text);
    return parsed.match || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a company-name guess against master-prospects: deterministic
 * sameOrg() first (matches how src/promote/agent/tools.ts's match_master_org
 * tool works), falling back to one LLM call over the live org-name list only
 * when the deterministic pass finds nothing. Never guesses past that — an
 * unresolved case comes back "none" for the caller to ask Tej about.
 */
export async function matchMasterOrg(
  nameGuess: string,
  masterIndex: MasterPromotionEntry[],
  llmFallback: (nameGuess: string, candidateNames: string[]) => Promise<string | null> = llmMatchOrg
): Promise<OrgMatchResult> {
  const deterministic = masterIndex.filter((m) => sameOrg(m.organization, nameGuess));
  if (deterministic.length === 1) {
    return { status: "matched", rowNumber: deterministic[0].rowNumber, organization: deterministic[0].organization };
  }
  if (deterministic.length > 1) {
    return { status: "ambiguous", candidates: deterministic.map((d) => d.organization) };
  }

  const llmPick = await llmFallback(nameGuess, masterIndex.map((m) => m.organization));
  if (!llmPick) return { status: "none" };
  const matched = masterIndex.find((m) => m.organization === llmPick);
  if (!matched) return { status: "none" };
  return { status: "matched", rowNumber: matched.rowNumber, organization: matched.organization };
}
