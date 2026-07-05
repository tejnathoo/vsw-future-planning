import { parse } from "csv-parse/sync";
import type { Item } from "../types";

const ORG_COLUMN_CANDIDATES = ["organization", "organisation", "org", "company", "company name", "sponsor", "name", "account name"];
const YEAR_COL_REGEX = /^(19|20)\d{2}$/;
const TRUTHY = new Set(["true", "yes", "y", "1", "x"]);

// Known upgrade candidates from the original Build Brief (D14) — hardcoded because
// they're specific named orgs from the brief, not a general heuristic.
const UPGRADE_CANDIDATES = ["DVBIA", "Innovate BC", "Earnest", "TransLink", "WorkSafeBC", "CBRE", "PLT", "SweetWater"];

export interface CsvParseResult {
  items: Item[];
  shape: "viv" | "general";
  missingUpgradeCandidates: string[]; // brief-named candidates not found in this CSV — flag back, don't guess
}

/** Column-detection failure — caller must ask in-thread, never guess silently (AGENTS.md golden rule). */
export class AmbiguousOrgColumnError extends Error {
  constructor(public readonly headers: string[]) {
    super(`Couldn't confidently tell which column holds the organization name. Headers: ${headers.join(", ")}`);
  }
}

function findOrgColumn(headers: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of ORG_COLUMN_CANDIDATES) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  throw new AmbiguousOrgColumnError(headers);
}

function findNotesColumn(headers: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  return lower.findIndex((h) => /note|comment|type|cash|vik/.test(h));
}

function isUpgradeCandidate(organization: string): boolean {
  const norm = organization.trim().toLowerCase();
  return UPGRADE_CANDIDATES.some((c) => norm.includes(c.toLowerCase()));
}

/**
 * Parse a CSV into rows/headers. Pure, no network — testable without a real file.
 */
export function parseCsvBuffer(buf: Buffer): { headers: string[]; rows: string[][] } {
  const records: string[][] = parse(buf.toString("utf-8"), { skip_empty_lines: true });
  const [headers, ...rows] = records;
  return { headers: headers || [], rows };
}

/**
 * Map parsed CSV rows into items, per PRD §4.2:
 *  - "Viv shape" (org name + per-year TRUE/FALSE columns) -> warmLead built from
 *    the TRUE years, whyThemOverride citing years + any notes verbatim, upgrade
 *    candidates flagged. This applies to ANY CSV with that shape, not just Viv's
 *    literal file — Tier/Source are the caller's job (they know which file this is).
 *  - General shape (no year columns) -> organization only; Category/Sector/Why
 *    Them come from the normal classifier, same as any other path.
 * Throws AmbiguousOrgColumnError if the org-name column can't be confidently
 * identified — the caller must ask in-thread, never guess (AGENTS.md).
 */
export function mapCsvRows(headers: string[], rows: string[][]): CsvParseResult {
  const orgColIdx = findOrgColumn(headers);
  const yearCols = headers
    .map((h, idx) => ({ idx, year: h.trim() }))
    .filter((c) => YEAR_COL_REGEX.test(c.year));
  const notesColIdx = findNotesColumn(headers);

  if (yearCols.length === 0) {
    const items: Item[] = rows
      .map((row) => ({ organization: (row[orgColIdx] || "").trim() }))
      .filter((item) => item.organization);
    return { items, shape: "general", missingUpgradeCandidates: [] };
  }

  const items: Item[] = [];
  const seenOrgs = new Set<string>();
  for (const row of rows) {
    const organization = (row[orgColIdx] || "").trim();
    if (!organization) continue;
    seenOrgs.add(organization.toLowerCase());

    const trueYears = yearCols
      .filter((c) => TRUTHY.has((row[c.idx] || "").trim().toLowerCase()))
      .map((c) => c.year);

    const warmLead = trueYears.length > 0 ? `Past VSW sponsor: ${trueYears.join(", ")}` : "";
    const note = notesColIdx >= 0 ? (row[notesColIdx] || "").trim() : "";

    let whyThem = trueYears.length > 0
      ? `Sponsored ${trueYears.join(", ")}${note ? ` — ${note}` : ""}.`
      : note || "Listed in the sponsor history CSV; no confirmed sponsor year on file.";
    if (isUpgradeCandidate(organization)) {
      whyThem = `Upgrade candidate: ${whyThem}`;
    }

    items.push({ organization, warmLead, whyThemOverride: whyThem });
  }

  const missingUpgradeCandidates = UPGRADE_CANDIDATES.filter(
    (c) => !Array.from(seenOrgs).some((org) => org.includes(c.toLowerCase()))
  );

  return { items, shape: "viv", missingUpgradeCandidates };
}
