const REQUIRED = [
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "SLACK_APP_TOKEN",
  "SLACK_ADMIN_USER_ID",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "N8N_SCRAPE_URL_WEBHOOK",
] as const;

/** Fail fast on boot rather than deep into a Slack event handler. */
export function assertRequiredEnv(): void {
  const missing: string[] = REQUIRED.filter((key) => !process.env[key]);
  // Local dev uses a keyFile path; Railway (no local filesystem for it) pastes
  // the whole service-account JSON into GOOGLE_SERVICE_ACCOUNT_JSON instead —
  // either one satisfies the Google Sheets auth requirement, see sheets.ts.
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    missing.push("GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")} — check .env against .env.example`);
  }
}
