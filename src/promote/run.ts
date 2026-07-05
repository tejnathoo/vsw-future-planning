import { sameOrg } from "../dedup";
import {
  appendAggregate,
  appendMasterRow,
  markStagingMergedToMaster,
  masterSheetLink,
  nextMasterRowNumber,
  readMasterPromotionIndex,
  readStagingApprovedRows,
  updateMasterAggregateRow,
} from "../sheets";
import { mapStagingToMaster } from "./mapper";
import type { MasterPromotionEntry, StagingApprovedRow } from "../types";

export interface PromotionFailure {
  organization: string;
  error: string;
}

export interface PromotionResult {
  added: number; // Path A — new Master rows
  merged: number; // Path B — aggregated onto an existing Master row
  skippedNeedsReview: number; // Approved + Duplicate?="Review" — blocked per PRD §10.6 Q4
  failed: number;
  failures: PromotionFailure[];
}

/**
 * Staging → Master promotion job (PRD §10). Reads every Approved Staging row,
 * decides Path A (net-new) vs Path B (aggregate onto an existing Master row) via
 * the reused `sameOrg()` matcher against a freshly-read Master index, writes the
 * Master change, then flips that Staging row's Review Status to
 * "Merged-to-Master". One bad row is caught + counted as failed and left fully
 * untouched — it never aborts the whole sweep (AGENTS.md golden rule #3).
 */
export async function runPromotion(): Promise<PromotionResult> {
  const staging = await readStagingApprovedRows();
  const master = await readMasterPromotionIndex();
  const approved = staging.filter((r) => r.reviewStatus === "Approved");

  const result: PromotionResult = {
    added: 0,
    merged: 0,
    skippedNeedsReview: 0,
    failed: 0,
    failures: [],
  };
  const mergedRowNumbers: number[] = [];
  // Path A rows land at explicit, deterministic row numbers computed from the
  // Master index (see nextMasterRowNumber) — never Sheets' own append()
  // heuristic, which can't anchor reliably on the always-blank Prospect ID
  // column. Advance this cursor by one after each Path A write within the run.
  let nextRow = nextMasterRowNumber(master);

  for (const row of approved) {
    try {
      // Review-flagged rows are blocked from Path B until Tej confirms the match
      // (PRD §10.6 Q4) — an intentional skip, not a failure. Don't touch the row.
      if (row.duplicate === "Review") {
        result.skippedNeedsReview += 1;
        continue;
      }

      if (row.duplicate === "In Master") {
        await mergeOntoMaster(row, master);
        result.merged += 1;
      } else if (row.duplicate === "") {
        await appendMasterRow(mapStagingToMaster(row), nextRow);
        nextRow += 1;
        result.added += 1;
      } else {
        throw new Error(`unrecognized Duplicate? value "${row.duplicate}"`);
      }

      mergedRowNumbers.push(row.rowNumber);
    } catch (e: any) {
      result.failed += 1;
      result.failures.push({ organization: row.organization, error: e.message });
    }
  }

  await markStagingMergedToMaster(mergedRowNumbers);
  return result;
}

/**
 * Path B (Duplicate? = "In Master") — find the matched Master row by Org Key
 * via sameOrg() and aggregate Why Them + Source Link (idempotent append per
 * §10.4). Throws if no match is found — caller counts it as failed.
 */
async function mergeOntoMaster(row: StagingApprovedRow, master: MasterPromotionEntry[]): Promise<void> {
  const match = master.find((m) => sameOrg(m.organization, row.organization));
  if (!match) {
    throw new Error(`Duplicate?="In Master" but no matching Master row found for "${row.organization}"`);
  }
  const whyThem = appendAggregate(match.whyThem, row.whyThem);
  const sourceLink = appendAggregate(match.sourceLink, row.sourceUrl);
  await updateMasterAggregateRow(match.rowNumber, whyThem, sourceLink);
}

/**
 * Format the promotion summary as a Slack reply, matching the intake paths'
 * teammate tone (AGENTS.md golden rule #12). Engine label: Promotion.
 */
export function promotionSummary(result: PromotionResult): string {
  const parts = [
    `${result.added} added to Master`,
    `${result.merged} merged into existing`,
  ];
  if (result.skippedNeedsReview > 0) {
    parts.push(`${result.skippedNeedsReview} skipped (need you to confirm the match)`);
  }
  if (result.failed > 0) parts.push(`${result.failed} failed`);

  let text = `Promotion run done! ${parts.join(" · ")}\nEngine: Promotion · 📋 <${masterSheetLink()}|Open Master Prospects>`;

  if (result.failures.length > 0) {
    const lines = result.failures.map((f) => `• ${f.organization}: ${f.error}`).join("\n");
    text += `\n\nThese didn't go through:\n${lines}`;
  }
  return text;
}
