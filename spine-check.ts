/**
 * Stage 2 — Shared spine verification, against the LIVE sheet.
 * Proves classify -> dedup/merge -> write works end-to-end with hand-crafted
 * input, BEFORE any Slack front-end exists. Uses a clearly-marked synthetic
 * org so it can never collide with real data, and cleans up after itself.
 * Run: npx tsx spine-check.ts
 */
import "dotenv/config";
import { google } from "googleapis";
import { processItems } from "./src/pipeline";
import type { Item } from "./src/types";

const MARKER = "ZZZ_SPINE_TEST_DELETE_ME";
const TEST_SOURCE_URL_1 = "internal://spine-test-source-1";
const TEST_SOURCE_URL_2 = "internal://spine-test-source-2";

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function findMarkerRows(): Promise<number[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const tab = process.env.STAGING_TAB_NAME || "data-staging";
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:A` });
  const rows = res.data.values || [];
  const matches: number[] = [];
  rows.forEach((r, i) => {
    if ((r[0] || "").includes(MARKER)) matches.push(i + 1);
  });
  return matches;
}

async function readRow(rowNumber: number) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const tab = process.env.STAGING_TAB_NAME || "data-staging";
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A${rowNumber}:R${rowNumber}` });
  return res.data.values?.[0] || [];
}

async function deleteRows(rowNumbers: number[]) {
  if (rowNumbers.length === 0) return;
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const tab = process.env.STAGING_TAB_NAME || "data-staging";
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties)" });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
  if (sheetId == null) throw new Error(`Couldn't find sheetId for "${tab}"`);
  // Delete highest row first so earlier row numbers stay valid.
  const sorted = [...rowNumbers].sort((a, b) => b - a);
  const requests = sorted.map((rowNumber) => ({
    deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber } },
  }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function main() {
  console.log("\n🧪 Stage 2 — Shared spine check (live sheet, cleans up after itself)\n");

  console.log("Step 1: run a clean NEW org through the full spine (classify -> dedup -> write)...");
  const item1: Item = { organization: `${MARKER} Org One`, evidence: "spine test fixture" };
  const result1 = await processItems([item1], {
    sourceLabel: "Spine Test Source A",
    sourceUrl: TEST_SOURCE_URL_1,
    sourceSlug: "spine-test-a",
    tier: "-",
    extractor: "Text",
    forceReviewForNewOrgs: false,
  });
  console.log(`  -> added=${result1.added}, merged=${result1.merged}, review=${result1.review}, inMaster=${result1.inMaster}, runId=${result1.runId}`);
  if (result1.added !== 1) throw new Error(`Expected 1 new row, got ${result1.added}`);

  console.log("Step 2: run the SAME org from a DIFFERENT source -> must MERGE (cross-run dedup proof)...");
  const item2: Item = { organization: `${MARKER} Org One`, evidence: "spine test fixture, second source" };
  const result2 = await processItems([item2], {
    sourceLabel: "Spine Test Source B",
    sourceUrl: TEST_SOURCE_URL_2,
    sourceSlug: "spine-test-b",
    tier: "-",
    extractor: "Text",
    forceReviewForNewOrgs: false,
  });
  console.log(`  -> added=${result2.added}, merged=${result2.merged}`);
  if (result2.merged !== 1 || result2.added !== 0) throw new Error(`Expected a merge, got added=${result2.added} merged=${result2.merged}`);

  console.log("Step 3: re-run the IDENTICAL source again -> must be a no-op (idempotency proof)...");
  const result3 = await processItems([item2], {
    sourceLabel: "Spine Test Source B",
    sourceUrl: TEST_SOURCE_URL_2,
    sourceSlug: "spine-test-b-rerun",
    tier: "-",
    extractor: "Text",
    forceReviewForNewOrgs: false,
  });
  console.log(`  -> added=${result3.added}, merged=${result3.merged}`);
  if (result3.added !== 0 || result3.merged !== 0) throw new Error(`Expected a no-op, got added=${result3.added} merged=${result3.merged}`);

  console.log("Step 4: verify the live row shape (Contact blank, Times Seen=2, pipe-joined Source URL, Source col unchanged)...");
  const rowNumbers = await findMarkerRows();
  if (rowNumbers.length !== 1) throw new Error(`Expected exactly 1 marker row, found ${rowNumbers.length}`);
  const row = await readRow(rowNumbers[0]);
  const [organization, , , category, sector, source, sourceUrl, , whyThem, , contact, duplicate, , timesSeen] = row;
  console.log(`  Organization="${organization}" Category="${category}" Sector="${sector}"`);
  console.log(`  Source="${source}" SourceURL="${sourceUrl}"`);
  console.log(`  WhyThem="${whyThem}"`);
  console.log(`  Contact="${contact}" Duplicate="${duplicate}" TimesSeen="${timesSeen}"`);

  const checks: [string, boolean][] = [
    ["Contact is blank", contact === "" || contact === undefined],
    ["Source column unchanged (first-seen label)", source === "Spine Test Source A"],
    ["Source URL is pipe-joined with both sources", sourceUrl === `${TEST_SOURCE_URL_1} | ${TEST_SOURCE_URL_2}`],
    ["Times Seen incremented to 2", String(timesSeen) === "2"],
    ["Category is a real enum value (classification worked)", !!category && category !== "Grant"],
  ];
  let allPassed = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✅" : "❌"} ${label}`);
    if (!ok) allPassed = false;
  }

  console.log("\nCleaning up test row(s)...");
  const finalMarkerRows = await findMarkerRows();
  await deleteRows(finalMarkerRows);
  console.log(`  Deleted ${finalMarkerRows.length} row(s).`);

  if (!allPassed) {
    console.log("\n❌ Spine check FAILED — see unchecked items above.\n");
    process.exit(1);
  }
  console.log("\n✅ Spine check PASSED — classify -> dedup/merge -> write proven end-to-end on the live sheet.\n");
}

main().catch(async (e) => {
  console.error("\n💥 Fatal error during spine check:", e.message || e);
  console.error("Attempting cleanup of any marker rows before exiting...");
  try {
    const rows = await findMarkerRows();
    await deleteRows(rows);
    console.error(`Cleaned up ${rows.length} row(s).`);
  } catch (cleanupErr: any) {
    console.error("Cleanup also failed — check the sheet manually for rows starting with", MARKER, cleanupErr.message);
  }
  process.exit(1);
});
