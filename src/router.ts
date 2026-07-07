/** Minimal shape of a Slack file object (from the app_mention event payload). */
export interface SlackFile {
  name?: string;
  mimetype?: string;
  filetype?: string; // Slack's short type, e.g. "csv", "pdf", "png", "markdown", "text"
  url_private?: string;
  permalink?: string;
}

export type Route =
  | { kind: "url"; urls: string[] }
  | { kind: "csv"; file: SlackFile }
  | { kind: "pdf"; file: SlackFile }
  | { kind: "image"; file: SlackFile }
  | { kind: "text"; file: SlackFile }
  | { kind: "promote" }
  | { kind: "approve"; value: string }
  | { kind: "unsupported_file"; file: SlackFile }
  | { kind: "contact"; text: string }
  | { kind: "chat"; text: string }
  | { kind: "none" };

const URL_REGEX = /https?:\/\/[^\s<>|]+/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const LINKEDIN_REGEX = /linkedin\.com\/in\//i;

function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) || [];
  // Slack wraps links as <https://example.com|label> or <https://example.com> — strip the wrapper.
  return matches.map((m) => m.replace(/^<|>$/g, "").split("|")[0]);
}

/** Whatever's left of the message after pulling out the URL(s) — the user's free-text context, if any. */
export function stripUrls(text: string): string {
  return (text || "").replace(URL_REGEX, "").trim();
}

/**
 * Contact-attribution detection (no file, no promote/approve command): an
 * email address in free text is an unambiguous signal on its own — it's never
 * a scrape target. A LinkedIn profile URL is more ambiguous, since a bare
 * pasted LinkedIn URL should keep forwarding to n8n like any other URL
 * (unchanged existing behavior) — it only counts here when there's other text
 * alongside it (name/title context), never a lone link.
 */
function looksLikeContactMessage(text: string): boolean {
  if (EMAIL_REGEX.test(text)) return true;
  if (LINKEDIN_REGEX.test(text) && stripUrls(text).length > 0) return true;
  return false;
}

/**
 * Route one app_mention event, per PRD §4.6 (+ §10.2 promote command):
 *   1. files[] present -> route by mimetype/filetype (csv/pdf/image/md-txt).
 *   2. no file, text is the "promote" command -> Promotion Agent (PRD §11).
 *   3. no file, text is "approve <value>" -> add a Source Type to the live
 *      dropdown (PRD §11.4 — gated, never reachable from the reasoning loop
 *      itself, only from this explicit human command).
 *   4. no file, no promote/approve, text has an email (or a LinkedIn profile
 *      URL plus other text) -> "contact" (attribute a contact/generic inbox to
 *      an existing master-prospects row — checked before URL forwarding so a
 *      LinkedIn URL accompanied by name/title context doesn't get forwarded
 *      to n8n for scraping).
 *   5. no file but a URL in text -> URL forwarder.
 *   6. no file, no URL, but some other text -> "chat" (conversational Q&A,
 *      PRD §12 — plain-chat questions about the spreadsheet/build).
 *   7. neither (bare mention, no text) -> "none" (caller asks for a link/CSV/PDF/image/text file).
 * Pure function — no Slack client, no I/O — fully unit-testable.
 */
export function detectRoute(input: { text: string; files: SlackFile[] }): Route {
  const [file] = input.files;
  if (file) {
    const mimetype = (file.mimetype || "").toLowerCase();
    const filetype = (file.filetype || "").toLowerCase();
    const name = (file.name || "").toLowerCase();

    if (filetype === "csv" || mimetype === "text/csv" || name.endsWith(".csv")) {
      return { kind: "csv", file };
    }
    if (filetype === "pdf" || mimetype === "application/pdf" || name.endsWith(".pdf")) {
      return { kind: "pdf", file };
    }
    if (mimetype.startsWith("image/")) {
      return { kind: "image", file };
    }
    if (
      filetype === "markdown" ||
      filetype === "text" ||
      mimetype === "text/markdown" ||
      mimetype === "text/plain" ||
      name.endsWith(".md") ||
      name.endsWith(".txt")
    ) {
      return { kind: "text", file };
    }
    return { kind: "unsupported_file", file };
  }

  const trimmed = (input.text || "").trim().toLowerCase();
  if (trimmed === "promote" || trimmed.startsWith("promote ")) {
    return { kind: "promote" };
  }
  if (trimmed.startsWith("approve ")) {
    // Preserve the original casing of the value itself — only the command
    // keyword is case-insensitive. Source Type values are human-readable labels.
    const original = (input.text || "").trim();
    const value = original.slice(original.toLowerCase().indexOf("approve ") + "approve ".length).trim();
    return { kind: "approve", value };
  }

  if (looksLikeContactMessage(input.text || "")) {
    return { kind: "contact", text: (input.text || "").trim() };
  }

  const urls = extractUrls(input.text || "");
  if (urls.length > 0) return { kind: "url", urls };

  if (trimmed.length > 0) return { kind: "chat", text: (input.text || "").trim() };

  return { kind: "none" };
}
