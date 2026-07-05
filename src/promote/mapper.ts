import type { MasterRow, SourceType, StagingApprovedRow } from "../types";

/**
 * Derive the master-prospects "Source Type" (col I) from a Staging row's Source
 * (col F) text — NOT from the Tier number (PRD §10.6 Q3: Tej explicitly rejected
 * a Tier→label table because Tiers 6–10 lump together heterogeneous source kinds).
 *
 * THROWS (rather than defaulting) on an unrecognized Source, same posture as
 * classify.ts's Category enum validator — a new source kind must get a deliberate
 * mapping decision, not a silent guess onto real Master data.
 *
 * FIRST-PASS GUESS — needs Tej to confirm/expand (PRD §10.6 Q3, still partially
 * open): the exact live Source (col F) strings in data-staging were never
 * enumerated, so the pattern matches below are inferred from the 4 confirmed
 * Source Type dropdown values and the most obviously-implied Source labels. Only
 * the 4 confirmed Source Type values are ever emitted; anything unmatched throws.
 */
export function deriveSourceType(source: string): SourceType {
  const s = (source || "").toLowerCase();

  // Tier 1 — past-sponsor sources (e.g. "Viv sponsor CSV").
  if (s.includes("viv") || s.includes("sponsor csv") || s.includes("past vsw sponsor") || s.includes("past sponsor")) {
    return "Past VSW sponsor";
  }
  // Tier 1 — speaker/partner sources.
  if (s.includes("speaker") || s.includes("partner")) {
    return "Past VSW event partner";
  }
  // Tier 2 — comparable-event sponsor lists.
  if (s.includes("comparable event") || s.includes("comparable")) {
    return "Comparable event sponsor";
  }
  // Tier 3 — BC ecosystem directories.
  if (
    s.includes("bc tech") ||
    s.includes("new ventures bc") ||
    s.includes("innovate bc") ||
    s.includes("ecosystem directory") ||
    s.includes("bc ecosystem")
  ) {
    return "BC ecosystem directory";
  }

  throw new Error(
    `deriveSourceType: unrecognized Source "${source}" — add a mapping (PRD §10.6 Q3) rather than guessing a Source Type.`
  );
}

/**
 * Pure column mapper (PRD §10.5): one Approved Staging row → the Master row shape
 * `appendMasterRow` expects (Path A). Every field not listed maps to blank per
 * the §10.5 table (Prospect ID, HQ/Geography, Potential Mutual Value, Programming
 * Angle, Warm Lead Person, all contact/outreach/funding/Stage columns).
 */
export function mapStagingToMaster(row: StagingApprovedRow): MasterRow {
  return {
    organizationName: row.organization,
    category: row.category,
    subsector: row.sector,
    whyThem: row.whyThem,
    sourceType: deriveSourceType(row.source),
    sourceLink: row.sourceUrl,
    warmLead: row.warmLead.trim() ? "Y" : "Unknown",
    warmLeadPath: row.warmLead,
    notes: `Promoted from data-staging · Tier ${row.tier} · ${row.extractor} · Run ${row.runId} · ${row.scrapedAt}`,
  };
}
