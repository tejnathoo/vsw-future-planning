/** An extracted item, before classification/dedup. */
export interface Item {
  organization: string;
  org_url?: string | null;
  evidence?: string;
  category_hint?: string | null;
  person?: string | null;
  /** Pre-built by the CSV path (e.g. "Past VSW sponsor: 2019, 2023") — skips the LLM guess. */
  warmLead?: string;
  /** Pre-built by the CSV path from the row's own data — overrides the classifier's Why Them. */
  whyThemOverride?: string;
}

/** The corrected Category enum — live + strict on master-prospects (confirmed 2026-07-03). */
export const CATEGORY_ENUM = [
  "Tech", "Bank", "Law firm", "Gov", "Crown corp", "Accelerator", "VC", "BIA",
  "University", "Media", "Consumer brand", "Real estate", "Recruiting",
  "Finance", "Professional services", "Defense & aerospace",
] as const;
export type Category = typeof CATEGORY_ENUM[number];

export type DuplicateFlag = "" | "Review" | "In Master";
export type Extractor = "CSV import" | "Vision" | "PDF" | "Text" | "Manual";

/** One data-staging row, columns A-R in exact order. */
export interface StagingRow {
  organization: string; // A
  orgKey: string; // B
  domain: string; // C
  category: Category | ""; // D
  sector: string; // E
  source: string; // F — first-seen label, never edited on merge
  sourceUrl: string; // G — pipe-joined on merge
  tier: string; // H — "1".."10" or "-"
  whyThem: string; // I
  warmLead: string; // J
  contact: ""; // K — always blank
  duplicate: DuplicateFlag; // L
  matchedOrg: string; // M
  timesSeen: number; // N
  runId: string; // O
  scrapedAt: string; // P — ISO datetime, America/Vancouver
  extractor: Extractor; // Q
  reviewStatus: "New"; // R
}

/** A minimal view of an existing Staging row, as read fresh before dedup. */
export interface StagingIndexEntry {
  rowNumber: number; // 1-indexed sheet row
  organization: string; // col A
  orgKey: string; // col B
  domain: string; // col C
  sourceUrl: string; // col G (pipe-joined string as stored)
  whyThem: string; // col I
  timesSeen: number; // col N
}

/** A minimal view of a Master row (no Domain column). */
export interface MasterIndexEntry {
  organization: string; // col B, "Organization Name"
  orgKey: string; // derived
}

/**
 * A fuller view of a Master row, for the Promotion feature's Path B matching +
 * aggregation. Adds the row number and the two columns §10.4 appends onto.
 */
export interface MasterPromotionEntry {
  rowNumber: number; // 1-indexed sheet row
  organization: string; // col B, "Organization Name"
  orgKey: string; // derived via orgKey()
  whyThem: string; // col F, "Why Them"
  sourceLink: string; // col J, "Source Link" (pipe-joined string as stored)
}

/** The Source Type enum, live on the master-prospects "Source Type" dropdown (PRD §10.6 Q3). */
export const SOURCE_TYPE_ENUM = [
  "Past VSW sponsor",
  "Past VSW event partner",
  "Comparable event sponsor",
  "BC ecosystem directory",
] as const;
export type SourceType = typeof SOURCE_TYPE_ENUM[number];

/**
 * The full Approved-row shape read from data-staging for promotion (all the
 * columns §10.5 maps from, plus the row number and Review Status).
 */
export interface StagingApprovedRow {
  rowNumber: number; // 1-indexed sheet row
  organization: string; // A
  orgKey: string; // B
  domain: string; // C
  category: string; // D
  sector: string; // E
  source: string; // F
  sourceUrl: string; // G
  tier: string; // H
  whyThem: string; // I
  warmLead: string; // J
  duplicate: string; // L
  matchedOrg: string; // M
  timesSeen: string; // N
  runId: string; // O
  scrapedAt: string; // P
  extractor: string; // Q
  reviewStatus: string; // R
}

/**
 * One new master-prospects row for Path A append (columns A-AF, exact order).
 * Only B/C/D/F/I/J/K/M/AF are ever populated; the rest are always blank (§10.5).
 */
export interface MasterRow {
  organizationName: string; // B
  category: string; // C
  subsector: string; // D
  whyThem: string; // F
  sourceType: SourceType; // I
  sourceLink: string; // J
  warmLead: boolean; // K — a real checkbox in the sheet (TRUE/FALSE), not "Y"/"Unknown" text
  warmLeadPath: string; // M
  notes: string; // AF
}

export type DedupOutcome =
  | { kind: "merge"; rowNumber: number; appendSourceUrl: boolean }
  | { kind: "new"; duplicate: DuplicateFlag; matchedOrg: string };

/** One contact (or generic inbox) extracted from a plain-text Slack contact-attribution message. */
export interface ParsedContact {
  name?: string;
  title?: string;
  email?: string;
  linkedin?: string;
  /** True when this is a shared/generic inbox (e.g. "service@aritzia.ca"), not a named person. */
  isGenericInbox?: boolean;
}

/** Result of parsing a plain-text contact-attribution message (src/paths/contact.ts). */
export interface ParsedContactMessage {
  organizationNameGuess: string;
  contacts: ParsedContact[];
  /** Only set when the message explicitly frames extra info as a reason to approach the org. */
  whyThemAddition?: string;
  /** Anything else worth keeping that isn't clearly a Why Them reason. */
  notesAddition?: string;
}

/** The subset of an existing master-prospects row's contact-related columns (N-T, plus F/AF for appends). */
export interface MasterContactFields {
  whyThem: string; // F
  primaryName: string; // N
  primaryTitle: string; // O
  primaryEmail: string; // P
  primaryLinkedin: string; // Q
  secondaryName: string; // R
  secondaryLinkedin: string; // S
  genericIntakeEmail: string; // T
  notes: string; // AF
}

/**
 * Cells to write via updateMasterContactFields — only the keys present get
 * written; anything else on the row is left untouched (never a full rewrite).
 */
export type MasterContactFieldUpdates = Partial<MasterContactFields>;
