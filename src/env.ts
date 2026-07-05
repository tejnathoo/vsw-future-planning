const REQUIRED = [
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "SLACK_APP_TOKEN",
  "SLACK_ADMIN_USER_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "N8N_SCRAPE_URL_WEBHOOK",
] as const;

/** Fail fast on boot rather than deep into a Slack event handler. */
export function assertRequiredEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")} — check .env against .env.example`);
  }
}
