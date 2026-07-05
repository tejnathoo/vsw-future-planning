import { google, sheets_v4 } from "googleapis";
import { orgKey } from "./dedup";
import type {
  MasterIndexEntry,
  MasterPromotionEntry,
  MasterRow,
  StagingApprovedRow,
  StagingIndexEntry,
  StagingRow,
} from "./types";

let sheetsClient: sheets_v4.Sheets | undefined;

function getSheets(): sheets_v4.Sheets {
  if (!sheetsClient) {
    // Railway has no local filesystem to point GOOGLE_APPLICATION_CREDENTIALS'
    // keyFile at, so the service-account JSON is pasted whole into
    // GOOGLE_SERVICE_ACCOUNT_JSON there instead; local dev keeps using the
    // gitignored ./secrets/service-account.json keyFile.
    const rawCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const auth = new google.auth.GoogleAuth({
      ...(rawCredentials
        ? { credentials: JSON.parse(rawCredentials) }
        : { keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS }),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set");
  return id;
}

function stagingTab(): string {
  return process.env.STAGING_TAB_NAME || "data-staging";
}

function masterTab(): string {
  return process.env.MASTER_TAB_NAME || "master-prospects";
}

function masterHeaderRow(): number {
  return Number(process.env.MASTER_HEADER_ROW || "2");
}

/**
 * Read fresh Staging (AGENTS.md golden rule #7 — always read immediately
 * before computing dedup, since n8n is a second writer). Pulls cols A,B,C,G,I,N
 * per Build Spec §6, plus each row's sheet row number.
 */
export async function readStagingIndex(): Promise<StagingIndexEntry[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${stagingTab()}!A2:N`,
  });
  const rows = res.data.values || [];
  return rows.map((row, i) => {
    const organization = row[0] || "";
    return {
      rowNumber: i + 2, // header is row 1
      organization,
      orgKey: row[1] || orgKey(organization),
      domain: row[2] || "",
      sourceUrl: row[6] || "",
      whyThem: row[8] || "",
      timesSeen: Number(row[13] || "1"),
    };
  }).filter((e) => e.organization);
}

/** Read fresh Master (col B, "Organization Name", from row 3 down — header on row 2, no Domain column). */
export async function readMasterIndex(): Promise<MasterIndexEntry[]> {
  const startRow = masterHeaderRow() + 1;
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${masterTab()}!B${startRow}:B`,
  });
  const rows = res.data.values || [];
  return rows
    .map((row) => row[0] || "")
    .filter(Boolean)
    .map((organization) => ({ organization, orgKey: orgKey(organization) }));
}

/**
 * Read fresh Master for the Promotion feature (PRD §10.3/§10.4) — needs row
 * numbers plus Why Them (F) and Source Link (J) for Path B matching + append,
 * where `readMasterIndex` only pulls col B. Data starts at row 3 (header row 2).
 * Reuses `orgKey()` from dedup so the match key is derived identically to Staging.
 */
export async function readMasterPromotionIndex(): Promise<MasterPromotionEntry[]> {
  const startRow = masterHeaderRow() + 1;
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${masterTab()}!B${startRow}:J`,
  });
  const rows = res.data.values || [];
  return rows
    .map((row, i) => {
      const organization = row[0] || ""; // col B
      return {
        rowNumber: i + startRow,
        organization,
        orgKey: orgKey(organization),
        whyThem: row[4] || "", // col F (B is index 0 → F is index 4)
        sourceLink: row[8] || "", // col J
      };
    })
    .filter((e) => e.organization);
}

/**
 * Read fresh data-staging rows for the Promotion feature (PRD §10.5). Pulls the
 * full A:R range (Review Status at R is the Approved filter; callers filter).
 * `readStagingIndex` only reads a subset for the dedup spine — do not conflate.
 */
export async function readStagingApprovedRows(): Promise<StagingApprovedRow[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${stagingTab()}!A2:R`,
  });
  const rows = res.data.values || [];
  return rows
    .map((row, i) => {
      const organization = row[0] || "";
      return {
        rowNumber: i + 2, // header is row 1
        organization,
        orgKey: row[1] || orgKey(organization),
        domain: row[2] || "",
        category: row[3] || "",
        sector: row[4] || "",
        source: row[5] || "",
        sourceUrl: row[6] || "",
        tier: row[7] || "",
        whyThem: row[8] || "",
        warmLead: row[9] || "",
        duplicate: row[11] || "",
        matchedOrg: row[12] || "",
        timesSeen: row[13] || "",
        runId: row[14] || "",
        scrapedAt: row[15] || "",
        extractor: row[16] || "",
        reviewStatus: row[17] || "",
      };
    })
    .filter((e) => e.organization);
}

/**
 * Where the next Path A row should land — computed from the already-read Master
 * index rather than Sheets' own `append()` table-detection heuristic. That
 * heuristic finds "the last row" by scanning a given column for the last
 * non-empty cell, which is unsafe here: Prospect ID (col A) is deliberately
 * left blank on every row (PRD §10.6 Q1), so anchoring on col A can't reliably
 * locate the end of the real data. Falls back to just after the header if
 * Master has no rows yet.
 */
export function nextMasterRowNumber(index: MasterPromotionEntry[]): number {
  if (index.length === 0) return masterHeaderRow() + 1;
  return Math.max(...index.map((e) => e.rowNumber)) + 1;
}

/**
 * Write ONE new master-prospects row at an explicit, caller-computed row number
 * (Path A, PRD §10.5) — a targeted `values.update`, not `values.append`, so
 * placement is deterministic rather than guessed (see `nextMasterRowNumber`).
 * Writes columns B-AF, populating only B/C/D/F/I/J/K/M/AF — every other column
 * blank; col A (Prospect ID) is left untouched. This is the ONLY sanctioned way
 * to add a Master row (AGENTS.md golden rule #1 carve-out).
 */
export async function appendMasterRow(row: MasterRow, rowNumber: number): Promise<void> {
  const values = [[
    row.organizationName, // B
    row.category, // C
    row.subsector, // D
    "", // E HQ / Geography
    row.whyThem, // F
    "", // G Potential Mutual Value
    "", // H Programming Angle
    row.sourceType, // I
    row.sourceLink, // J
    row.warmLead, // K Warm Lead?
    "", // L Warm Lead Person
    row.warmLeadPath, // M
    "", // N Primary Contact Name
    "", // O Title
    "", // P Email
    "", // Q LinkedIn URL
    "", // R Secondary Contact Name
    "", // S Secondary Contact LinkedIn
    "", // T Generic Intake Email
    "", // U Stage
    "", // V Last Touch Date
    "", // W Last Touch Channel
    "", // X Next Step
    "", // Y Next Follow-up Date
    "", // Z Owner
    "", // AA Funding Type
    "", // AB Estimated Capacity
    "", // AC Target Ask Range
    "", // AD Exclusivity Play? (Y/N/Unknown)
    "", // AE Budget Window
    row.notes, // AF
  ]];
  await getSheets().spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${masterTab()}!B${rowNumber}:AF${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

/**
 * Append text to a pipe-joined cell only if not already present (PRD §10.4 step 5).
 * Split on " | ", trim, membership-check the exact value. Pure + unit-testable.
 * Deliberately NOT the Staging merge's "(Nth: <source label>)" ordinal-note logic
 * — that's a different mechanism for a different column's semantics (AGENTS.md
 * §Dedup vs. this feature's §10.4). Returns the (possibly unchanged) cell value.
 */
export function appendAggregate(existing: string, addition: string): string {
  const add = (addition || "").trim();
  if (!add) return existing || "";
  const parts = (existing || "").split(" | ").map((s) => s.trim()).filter(Boolean);
  if (parts.includes(add)) return existing || "";
  return parts.length === 0 ? add : `${existing} | ${add}`;
}

/**
 * Path B aggregation (PRD §10.4): batch-update ONLY column F (Why Them) and
 * column J (Source Link) on an existing Master row. Never touches any other
 * column, ever (AGENTS.md golden rule #1 carve-out boundary). Callers pass the
 * full new cell values (already run through `appendAggregate`). Mirrors
 * `mergeStagingRows`'s `values.batchUpdate` pattern.
 */
export async function updateMasterAggregateRow(
  rowNumber: number,
  whyThem: string,
  sourceLink: string
): Promise<void> {
  const tab = masterTab();
  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${tab}!F${rowNumber}`, values: [[whyThem]] },
        { range: `${tab}!J${rowNumber}`, values: [[sourceLink]] },
      ],
    },
  });
}

/**
 * Flip Review Status (col R) to "Merged-to-Master" for a batch of Staging rows,
 * touching ONLY col R (PRD §10.2). Mirrors `mergeStagingRows`'s batch pattern.
 */
export async function markStagingMergedToMaster(rowNumbers: number[]): Promise<void> {
  if (rowNumbers.length === 0) return;
  const tab = stagingTab();
  const data: sheets_v4.Schema$ValueRange[] = rowNumbers.map((n) => ({
    range: `${tab}!R${n}`,
    values: [["Merged-to-Master"]],
  }));
  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
}

/**
 * Live Source Type dropdown values (master-prospects col I) — read fresh every
 * call, never hardcoded/cached (PRD §11.4). This is what lets a Tej-approved
 * addition "just work" on the next run with no code change. Reads the
 * dataValidation rule off row 3 (first data row) and trusts it's uniform down
 * the column, same technique used in the 2026-07-04 dry run that found only 3
 * values were actually live despite 4 being discussed.
 */
export async function readSourceTypeDropdown(): Promise<string[]> {
  const startRow = masterHeaderRow() + 1;
  const res = await getSheets().spreadsheets.get({
    spreadsheetId: spreadsheetId(),
    ranges: [`${masterTab()}!I${startRow}`],
    includeGridData: true,
  });
  const cell = res.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0];
  const values = cell?.dataValidation?.condition?.values || [];
  return values.map((v) => v.userEnteredValue || "").filter(Boolean);
}

/** Resolve a tab's numeric sheetId by title — avoids relying on a hand-copied gid env var. */
async function getSheetIdByTitle(title: string): Promise<number> {
  const res = await getSheets().spreadsheets.get({ spreadsheetId: spreadsheetId(), fields: "sheets.properties" });
  const sheet = res.data.sheets?.find((s) => s.properties?.title === title);
  if (sheet?.properties?.sheetId == null) throw new Error(`getSheetIdByTitle: no sheet titled "${title}"`);
  return sheet.properties.sheetId;
}

/**
 * Add a new value to the live Source Type dropdown (master-prospects col I).
 * **Gated tool (AGENTS.md golden rule #16 / PRD §11.4): only ever called from
 * the `@bot approve <value>` command path — never offered to / callable by the
 * Promotion Agent's own reasoning loop.** Applies over rows 3-342 (the range
 * confirmed live 2026-07-04), matching how the rest of the column's validation
 * is actually applied — NOT per-cell. Reads back afterward to confirm.
 */
export async function appendSourceTypeToDropdown(newValue: string): Promise<string[]> {
  const current = await readSourceTypeDropdown();
  if (current.includes(newValue)) return current; // already live — idempotent no-op
  const updated = [...current, newValue];
  const sheetId = await getSheetIdByTitle(masterTab());
  const startRow = masterHeaderRow() + 1; // row 3, 0-indexed = masterHeaderRow()

  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: startRow - 1, // 0-indexed
              endRowIndex: 342,
              startColumnIndex: 8, // col I
              endColumnIndex: 9,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: updated.map((v) => ({ userEnteredValue: v })),
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
      ],
    },
  });

  const confirmed = await readSourceTypeDropdown();
  if (!confirmed.includes(newValue)) {
    throw new Error(`appendSourceTypeToDropdown: wrote "${newValue}" but it didn't read back live`);
  }
  return confirmed;
}

/**
 * Fresh read of ONE Master row's Why Them (F) + Source Link (J) — used by
 * `update_master_aggregate_row` (PRD §11.4) to re-check current values right
 * before writing, rather than trusting a value the agent read earlier in a
 * multi-row run that might have gone stale (e.g. two Approved rows aggregating
 * onto the same Master org in one sweep).
 */
export async function readMasterRowAggregateFields(rowNumber: number): Promise<{ whyThem: string; sourceLink: string }> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${masterTab()}!F${rowNumber}:J${rowNumber}`,
  });
  const row = res.data.values?.[0] || [];
  return { whyThem: row[0] || "", sourceLink: row[4] || "" };
}

/** Deep-link to the master tab (for the Promotion Slack summary). */
export function masterSheetLink(): string {
  const gid = process.env.MASTER_TAB_GID || "";
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId()}/edit#gid=${gid}`;
}

/** Append a batch of new Staging rows (columns A-R, exact order). Returns the first appended row number. */
export async function appendStagingRows(rows: StagingRow[]): Promise<number> {
  if (rows.length === 0) return -1;
  const values = rows.map((r) => [
    r.organization, r.orgKey, r.domain, r.category, r.sector, r.source,
    r.sourceUrl, r.tier, r.whyThem, r.warmLead, r.contact, r.duplicate,
    r.matchedOrg, r.timesSeen, r.runId, r.scrapedAt, r.extractor, r.reviewStatus,
  ]);
  const res = await getSheets().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${stagingTab()}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  const updatedRange = res.data.updates?.updatedRange || "";
  const match = updatedRange.match(/!A(\d+)/);
  if (!match) throw new Error(`appendStagingRows: couldn't parse appended range: ${updatedRange}`);
  return parseInt(match[1], 10);
}

export interface MergeUpdate {
  rowNumber: number;
  sourceUrl: string; // full new pipe-joined value for col G
  whyThem: string; // full new value for col I (original + "(Nth: <source label>)" note)
  timesSeen: number; // new value for col N
  scrapedAt: string; // new value for col P
}

/** Batch-update ONLY columns G (Source URL), I (Why Them), N (Times Seen), P (Scraped At) on merged rows. Never touches F/K/R. */
export async function mergeStagingRows(updates: MergeUpdate[]): Promise<void> {
  if (updates.length === 0) return;
  const tab = stagingTab();
  const data: sheets_v4.Schema$ValueRange[] = [];
  for (const u of updates) {
    data.push({ range: `${tab}!G${u.rowNumber}`, values: [[u.sourceUrl]] });
    data.push({ range: `${tab}!I${u.rowNumber}`, values: [[u.whyThem]] });
    data.push({ range: `${tab}!N${u.rowNumber}`, values: [[u.timesSeen]] });
    data.push({ range: `${tab}!P${u.rowNumber}`, values: [[u.scrapedAt]] });
  }
  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
}

/** Deep-link to the staging tab (for Slack reply templates, Build Spec §8). */
export function stagingSheetLink(): string {
  const gid = process.env.STAGING_TAB_GID || "";
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId()}/edit#gid=${gid}`;
}
