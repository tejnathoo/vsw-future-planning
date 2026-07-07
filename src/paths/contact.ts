import { getAnthropicClient, parseStrictJson } from "../anthropicClient";
import type { ParsedContactMessage } from "../types";

/**
 * Parse a plain-text Slack contact-attribution message (PRD-equivalent to the
 * text/CSV/image/PDF extraction paths, but for attributing a contact/generic
 * inbox to a company already in master-prospects) — one Anthropic call, no D12
 * substring check (the user is typing directly, not extracting from a fetched
 * document, same reasoning as the userNote handling elsewhere in this repo).
 */
export async function parseContactMessage(text: string, userNote?: string): Promise<ParsedContactMessage> {
  const prompt = `A teammate is attributing a contact (or a shared/generic inbox) to a company that should already exist in a sponsor-prospecting spreadsheet. Extract the details from their message. Return STRICT JSON only, no markdown fences, in this exact shape:
{"organizationNameGuess":"","contacts":[{"name":"","title":"","email":"","linkedin":"","isGenericInbox":false}],"whyThemAddition":"","notesAddition":""}

Rules:
- organizationNameGuess: the company name as written in the message (don't normalize/expand it — matching against the real sheet happens separately).
- contacts: one entry per distinct person OR shared inbox mentioned. Omit fields not given (do not invent a title/email/linkedin). A generic/shared inbox (e.g. "service@aritzia.ca", "info@...") has isGenericInbox=true and no name/title.
- whyThemAddition: ONLY fill this if the message explicitly frames some piece of information as a reason to approach this org (e.g. "why we should reach out", "this is why they're a good fit"). Leave it empty otherwise.
- notesAddition: any other extra context in the message that isn't a contact field and isn't an explicit "why them" reason — e.g. background comments, how the contact was sourced, caveats. When you're not sure whether something is a "why them" reason or just a note, put it in notesAddition, not whyThemAddition.
- If the message gives nothing beyond a name/company, leave whyThemAddition and notesAddition empty.
${userNote ? `\nAdditional context from the person who submitted this (trusted):\n"""\n${userNote}\n"""\n` : ""}
Message:
"""
${text}
"""`;

  const msg = await getAnthropicClient().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  let parsed: Partial<ParsedContactMessage>;
  try {
    parsed = parseStrictJson<Partial<ParsedContactMessage>>(responseText);
  } catch {
    throw new Error(`parseContactMessage: model did not return valid JSON: ${responseText.slice(0, 200)}`);
  }

  return {
    organizationNameGuess: parsed.organizationNameGuess?.trim() || "",
    contacts: (parsed.contacts || []).filter((c) => c && (c.name || c.email || c.linkedin || c.isGenericInbox)),
    whyThemAddition: parsed.whyThemAddition?.trim() || undefined,
    notesAddition: parsed.notesAddition?.trim() || undefined,
  };
}
