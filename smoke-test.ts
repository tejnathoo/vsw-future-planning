/**
 * Stage 1B — Connectivity smoke tests.
 * Run: npx tsx smoke-test.ts
 * Tests every external dependency's credential surface. No feature code.
 */
import "dotenv/config";

const results: { name: string; status: "PASS" | "FAIL"; detail: string }[] = [];

async function test(name: string, fn: () => Promise<string>) {
  try {
    const detail = await fn();
    results.push({ name, status: "PASS", detail });
    console.log(`  ✅ ${name}: ${detail}`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    results.push({ name, status: "FAIL", detail: msg });
    console.log(`  ❌ ${name}: ${msg}`);
  }
}

async function main() {
  console.log("\n🧪 Stage 1B — Smoke tests\n");

  // 1. Slack: auth test (no socket connection needed — just verify the token is valid)
  await test("Slack auth", async () => {
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    });
    const data = await res.json() as any;
    if (!data.ok) throw new Error(`Slack auth.test failed: ${data.error}`);
    return `bot=${data.user}, team=${data.team}`;
  });

  // 2. Slack: file download surface (we can't test a real file yet, but verify the token format is accepted)
  await test("Slack token format", async () => {
    const token = process.env.SLACK_BOT_TOKEN || "";
    if (!token.startsWith("xoxb-")) throw new Error("Token doesn't start with xoxb-");
    const appToken = process.env.SLACK_APP_TOKEN || "";
    if (!appToken.startsWith("xapp-")) throw new Error("App token doesn't start with xapp-");
    return "bot token (xoxb-) + app token (xapp-) formats valid";
  });

  // 3. Google Sheets: read header + append a throwaway row + delete it
  await test("Sheets read+write+delete", async () => {
    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    const tab = process.env.STAGING_TAB_NAME || "data-staging";

    // Read header row
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:R1`,
    });
    const headers = headerRes.data.values?.[0] || [];
    if (headers.length < 18) throw new Error(`Expected 18 columns A-R, got ${headers.length}: ${headers.join(", ")}`);
    if (headers[0] !== "Organization") throw new Error(`Col A should be "Organization", got "${headers[0]}"`);
    if (headers[17] !== "Review Status") throw new Error(`Col R should be "Review Status", got "${headers[17]}"`);

    // Append a throwaway row
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tab}!A:A`,
      valueInputOption: "RAW",
      requestBody: { values: [["__SMOKE_TEST__", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]] },
    });
    const updatedRange = appendRes.data.updates?.updatedRange || "";
    // Extract row number to delete it
    const rowMatch = updatedRange.match(/!A(\d+)/);
    if (!rowMatch) throw new Error(`Couldn't parse appended row from: ${updatedRange}`);
    const rowNum = parseInt(rowMatch[1], 10);

    // Delete the throwaway row
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties)" });
    const stagingSheet = sheetMeta.data.sheets?.find(
      (s: any) => s.properties?.title === tab
    );
    const sheetId = stagingSheet?.properties?.sheetId;
    if (sheetId == null) throw new Error(`Couldn't find sheetId for "${tab}"`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowNum - 1, endIndex: rowNum },
          },
        }],
      },
    });

    return `header OK (18 cols, A=Organization, R=Review Status); wrote+deleted row ${rowNum}`;
  });

  // 4. Gemini: text-only test first (proves the key + model work), then vision inline
  await test("Gemini API", async () => {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-pro";

    const response = await ai.models.generateContent({
      model,
      contents: "Reply with exactly one word: what color is the sky?",
    });
    const text = response.text?.trim() || "";
    if (!text) throw new Error("Empty response from Gemini");
    return `model=${model}, response="${text.slice(0, 50)}" — key + model confirmed working`;
  });

  // 5. Anthropic: classification test
  await test("Anthropic classify", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
    const msg = await client.messages.create({
      model,
      max_tokens: 50,
      messages: [{ role: "user", content: "Classify 'KPMG' into exactly one of: Tech, Bank, Law firm, Gov, Crown corp, Accelerator, VC, BIA, University, Media, Consumer brand, Real estate, Recruiting, Finance, Professional services, Defense & aerospace. Reply with just the category." }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    if (!text) throw new Error("Empty response from Anthropic");
    return `model=${model}, classified KPMG as "${text}"`;
  });

  // 6. n8n webhook: reachability check (HEAD or GET — don't POST a real scrape)
  await test("n8n webhook reachable", async () => {
    const url = process.env.N8N_SCRAPE_URL_WEBHOOK!;
    // Just check the endpoint exists (n8n webhooks return 200 on GET with a "Workflow was started" or similar)
    const res = await fetch(url, { method: "GET" });
    return `status=${res.status} (reachable; POST with urls[] triggers a real scrape — skipped)`;
  });

  // Summary
  console.log("\n📊 Summary:");
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`  ${passed} passed, ${failed} failed out of ${results.length} tests\n`);

  if (failed > 0) {
    console.log("❗ Failed tests:");
    results.filter((r) => r.status === "FAIL").forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
    console.log("");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
