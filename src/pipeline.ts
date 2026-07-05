import { classifyItem } from "./classify";
import { appendWhyThemNote, decideDedup, domainOf, orgKey, sameOrg, splitSourceUrls } from "./dedup";
import { appendStagingRows, mergeStagingRows, readMasterIndex, readStagingIndex, type MergeUpdate } from "./sheets";
import { runId as buildRunId, scrapedAtNow } from "./time";
import type { DuplicateFlag, Extractor, Item, StagingRow } from "./types";

export interface RunContext {
  sourceLabel: string; // col F, e.g. "Viv sponsor CSV"
  sourceUrl: string; // col G for this whole run (one stable value per CSV/PDF/image/text file)
  sourceSlug: string; // feeds the Run ID
  tier: string; // "1".."10" or "-"
  extractor: Extractor;
  /** Vision/PDF default brand-new orgs to Review (PRD §4.3/§4.4); CSV/Text do not. */
  forceReviewForNewOrgs: boolean;
  /** Free-text the user typed alongside the @mention — passed to the classifier for grounding/attribution. */
  userNote?: string;
}

export interface RunResult {
  added: number;
  merged: number;
  review: number;
  inMaster: number;
  runId: string;
}

/**
 * The shared spine: classify -> dedup/merge -> write. Reads Staging + Master
 * fresh once per run (AGENTS.md golden rule #7), then applies the ported §7
 * algorithm per item, including same-run dedup (step 1) before ever
 * consulting the sheet-backed indexes.
 */
export async function processItems(items: Item[], ctx: RunContext): Promise<RunResult> {
  const runIdValue = buildRunId(ctx.sourceSlug);
  const scrapedAt = scrapedAtNow();

  const stagingIndex = await readStagingIndex();
  const masterIndex = await readMasterIndex();

  const pending: { row: StagingRow; urls: Set<string> }[] = [];
  const mergeAcc = new Map<
    number,
    { urls: Set<string>; increment: number; baseTimesSeen: number; baseWhyThem: string; sourceLabel: string }
  >();

  let review = 0;
  let inMaster = 0;

  for (const item of items) {
    // Step 1 (same-run dupe check): does this item match a row we're already
    // about to create in THIS run? If so, fold it in without touching the sheet.
    const pendingMatch = pending.find(
      (p) =>
        sameOrg(p.row.organization, item.organization) ||
        (!!item.org_url && !!p.row.domain && p.row.domain === domainOf(item.org_url))
    );
    if (pendingMatch) {
      if (!pendingMatch.urls.has(ctx.sourceUrl)) {
        pendingMatch.urls.add(ctx.sourceUrl);
        pendingMatch.row.timesSeen += 1;
      }
      continue;
    }

    const decision = decideDedup(item, ctx.sourceUrl, stagingIndex, masterIndex);

    if (decision.kind === "merge") {
      const existing = stagingIndex.find((s) => s.rowNumber === decision.rowNumber)!;
      let acc = mergeAcc.get(decision.rowNumber);
      if (!acc) {
        acc = {
          urls: new Set(splitSourceUrls(existing.sourceUrl)),
          increment: 0,
          baseTimesSeen: existing.timesSeen,
          baseWhyThem: existing.whyThem,
          sourceLabel: ctx.sourceLabel,
        };
        mergeAcc.set(decision.rowNumber, acc);
      }
      if (decision.appendSourceUrl && !acc.urls.has(ctx.sourceUrl)) {
        acc.urls.add(ctx.sourceUrl);
        acc.increment += 1;
      }
      continue;
    }

    // "new" outcome — Vision/PDF force brand-new orgs to Review (never downgrades an
    // existing In Master/Review flag, only upgrades a clean "" result).
    const duplicate: DuplicateFlag =
      decision.duplicate === "" && ctx.forceReviewForNewOrgs ? "Review" : decision.duplicate;
    if (duplicate === "Review") review += 1;
    if (duplicate === "In Master") inMaster += 1;

    const classification = await classifyItem({
      organization: item.organization,
      evidence: item.evidence,
      sourceLabel: ctx.sourceLabel,
      tier: ctx.tier,
      userNote: ctx.userNote,
    });

    const row: StagingRow = {
      organization: item.organization,
      orgKey: orgKey(item.organization),
      domain: domainOf(item.org_url),
      category: classification.category,
      sector: classification.sector,
      source: ctx.sourceLabel,
      sourceUrl: ctx.sourceUrl,
      tier: ctx.tier,
      whyThem: item.whyThemOverride ?? classification.whyThem,
      warmLead: item.warmLead ?? "",
      contact: "",
      duplicate,
      matchedOrg: decision.matchedOrg,
      timesSeen: 1,
      runId: runIdValue,
      scrapedAt,
      extractor: ctx.extractor,
      reviewStatus: "New",
    };
    pending.push({ row, urls: new Set([ctx.sourceUrl]) });
  }

  const newRows = pending.map((p) => ({ ...p.row, sourceUrl: [...p.urls].join(" | ") }));
  if (newRows.length > 0) await appendStagingRows(newRows);

  const mergeUpdates: MergeUpdate[] = [];
  for (const [rowNumber, acc] of mergeAcc) {
    if (acc.increment === 0) continue; // fully idempotent re-run — nothing changed
    const newTimesSeen = acc.baseTimesSeen + acc.increment;
    mergeUpdates.push({
      rowNumber,
      sourceUrl: [...acc.urls].join(" | "),
      whyThem: appendWhyThemNote(acc.baseWhyThem, newTimesSeen, acc.sourceLabel),
      timesSeen: newTimesSeen,
      scrapedAt,
    });
  }
  if (mergeUpdates.length > 0) await mergeStagingRows(mergeUpdates);

  return { added: newRows.length, merged: mergeUpdates.length, review, inMaster, runId: runIdValue };
}
