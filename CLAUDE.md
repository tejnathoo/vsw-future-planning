# Claude Code — read AGENTS.md

This project's build instructions, hard rules, and the dedup engine to port live in **[AGENTS.md](AGENTS.md)**. Read it first, then [PRD.md](PRD.md) (what/why) and [PLAN.md](PLAN.md) (phases + Execution Log).

Non-negotiables (full list in AGENTS.md): never write `master-prospects`; `Contact` always blank; never drop a duplicate silently; this service does not scrape URLs (forward them to n8n); secrets only in `.env`/Railway; use the corrected Category enum. Log every deviation in PLAN.md → Execution Log (living docs; Notion Build Brief is the ultimate source of truth). **Note:** those non-negotiables constrain the *deployed service's* code paths (`src/`) — they are not a ban on you, in a Claude Code session, directly reading/writing the live sheet via the pattern below when Tej asks for research, cleanup, or data changes.

## Reading/writing the live spreadsheet: always programmatic, never by eye or by guessing

Don't try to "look at" the sheet via a browser, and don't answer questions about its contents from memory/training data or from what an earlier tool call happened to print. The sheet changes constantly and browser access isn't set up in this environment — the only reliable path is the same service-account credentials the deployed service uses, via a throwaway TypeScript file run with `npx tsx`.

**Pattern** (works for both `master-prospects` and `data-staging`, read or write):
1. Write a `.ts` file *inside this repo directory* (not `/tmp` — `tsx`/Node module resolution needs the local `node_modules`), e.g. `./check_tmp.ts`.
2. Auth exactly like `src/sheets.ts` does:
   ```ts
   import "dotenv/config";
   import { google } from "googleapis";
   const auth = new google.auth.GoogleAuth({
     keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // ./secrets/service-account.json
     scopes: ["https://www.googleapis.com/auth/spreadsheets"], // .readonly if you're only reading
   });
   const sheets = google.sheets({ version: "v4", auth });
   const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
   ```
3. Read with `sheets.spreadsheets.values.get({ spreadsheetId: id, range: "master-prospects!A3:AI398" })` (header is row 2, data from row 3 — see AGENTS.md's column map), write with `.values.update(...)`, delete a row with `.batchUpdate({ requestBody: { requests: [{ deleteDimension: {...} }] } })`.
4. Run it (`npx tsx ./check_tmp.ts`), then **delete the temp file** — these are one-off scripts, never committed.
5. **Any write** (new column, edited cell, merged/deleted row) gets logged in PLAN.md's Execution Log the same way code changes are — what changed, why, and what method/scoring/reasoning drove it. Never silently drop or overwrite existing evidence in a cell; when merging duplicate rows, fold both sources' content together (same principle as golden rule #3).
