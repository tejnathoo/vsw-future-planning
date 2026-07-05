import "dotenv/config";
import { App } from "@slack/bolt";
import cron from "node-cron";
import { assertRequiredEnv } from "./env";
import { AmbiguousOrgColumnError, mapCsvRows, parseCsvBuffer } from "./paths/csv";
import { extractOrgsFromImage } from "./paths/image";
import { extractOrgsFromPdf } from "./paths/pdf";
import { extractOrgsFromText } from "./paths/text";
import { forwardUrlsToN8n } from "./paths/url";
import { processItems } from "./pipeline";
import { answerQuestion } from "./chat/answerQuestion";
import { runPromotionAgent, resumePendingRow } from "./promote/agent/runAgent";
import { appendSourceTypeToDropdown, stagingSheetLink } from "./sheets";
import { findUnresolvedByThread, resolvePendingQuestion } from "./promote/agent/pendingQuestions";
import { detectRoute, stripUrls, type SlackFile } from "./router";
import { downloadSlackFile } from "./slack/download";
import { bulletMessage } from "./slack/reply";
import { scrapedAtNow } from "./time";

assertRequiredEnv();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
});

async function react(client: any, channel: string, timestamp: string, name: string) {
  try {
    await client.reactions.add({ channel, timestamp, name });
  } catch (e: any) {
    if (!String(e.message).includes("already_reacted")) console.error(`[react ${name}] failed:`, e.message);
  }
}

/**
 * Checks whether `threadTs` has an unresolved `ask_tej_on_slack` pending
 * question (PRD §11.5) and, if so, resolves it and resumes that Staging row.
 * Returns true if it handled the reply (caller should do nothing further).
 *
 * Bug fixed 2026-07-05: a reply that re-mentions the bot (very natural in a
 * back-and-forth — "@bot what do you think?") used to go straight to
 * `detectRoute`/the chat feature with zero awareness of the pending question,
 * giving Tej a confused generic answer instead of resolving it. This check
 * now runs FIRST, before any route detection, in both the `app_mention` and
 * plain-`message` listeners, so it doesn't matter whether the reply mentions
 * the bot or not.
 */
async function tryResumePendingQuestion(threadTs: string, answerText: string, say: any): Promise<boolean> {
  const pending = findUnresolvedByThread(threadTs);
  if (!pending) return false;

  resolvePendingQuestion(pending.id, answerText);
  try {
    const outcome = await resumePendingRow(pending, app.client);
    if (!outcome) {
      await say({ text: `Thanks — but that Staging row isn't Approved anymore, so I'm leaving it alone.`, thread_ts: threadTs });
      return true;
    }
    const emoji = outcome.outcome === "added" || outcome.outcome === "merged" ? "✅" : outcome.outcome === "held" ? "🤔" : "❌";
    await say({ text: `${emoji} ${pending.organization}: ${outcome.detail}`, thread_ts: threadTs });
  } catch (e: any) {
    console.error("[resume pending question] failed:", e.message);
    await say({ text: `Ran into a snag picking that back up: ${e.message}`, thread_ts: threadTs });
  }
  return true;
}

app.event("app_mention", async ({ event, say, client }) => {
  const text = (event.text || "").replace(/<@[^>]+>/g, "").trim(); // strip the @mention tag itself
  const files: SlackFile[] = ((event as any).files || []).map((f: any) => ({
    name: f.name,
    mimetype: f.mimetype,
    filetype: f.filetype,
    url_private: f.url_private,
    permalink: f.permalink,
  }));

  const thread_ts = event.thread_ts || event.ts;

  // Only a threaded reply (not a fresh top-level mention) can possibly be
  // answering a pending question — a pending question is always asked
  // in-thread, so `event.thread_ts` is only set when this mention is a reply.
  if (event.thread_ts && (await tryResumePendingQuestion(event.thread_ts, text, say))) {
    await react(client, event.channel, event.ts, "white_check_mark");
    return;
  }

  const route = detectRoute({ text, files });
  console.log(`[app_mention] user=${event.user} route=${route.kind}`);

  // Anything left in the message besides the mention/URL is treated as free-text
  // context from the user (e.g. "this is the CVCA 50 — attribute to CVCA") and
  // threaded through to the LLM for grounding/attribution.
  const userNote = route.kind === "url" ? stripUrls(text) || undefined : text || undefined;

  await react(client, event.channel, event.ts, "eyes");

  switch (route.kind) {
    case "url":
      try {
        await forwardUrlsToN8n(route.urls, `<@${event.user}>`, userNote);
        await say({
          text: `Got it — sending that over to the scraper now 🔗\n\nNew/merged rows will land in data-staging, and you'll see the run summary in here shortly.${userNote ? "\n\n(Passed your note along too.)" : ""}`,
          thread_ts,
        });
        // Not white_check_mark — the scraper hasn't finished yet, this only
        // confirms the hand-off succeeded. n8n posts its own completion message.
        await react(client, event.channel, event.ts, "outbox_tray");
      } catch (e: any) {
        console.error("[url forward] failed:", e.message);
        await say({ text: `Hmm, that didn't make it to the scraper: ${e.message}`, thread_ts });
        await react(client, event.channel, event.ts, "x");
      }
      break;
    case "csv":
      await say({
        text: `Got your CSV (${route.file.name})${userNote ? " and your note — I'll factor that in" : ""} — digging through it now, one sec 📄`,
        thread_ts,
      });
      try {
        const buf = await downloadSlackFile(route.file.url_private!, process.env.SLACK_BOT_TOKEN!);
        const { headers, rows } = parseCsvBuffer(buf);
        const { items, shape, missingUpgradeCandidates } = mapCsvRows(headers, rows);

        const looksLikeViv = shape === "viv" && /viv/i.test(route.file.name || "");
        const sourceLabel = looksLikeViv ? "Viv sponsor CSV" : route.file.name || "CSV upload";
        const tier = looksLikeViv ? "1" : "-";

        const result = await processItems(items, {
          sourceLabel,
          sourceUrl: `internal://slack-csv-${(route.file.name || "upload").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          sourceSlug: `slack-csv-${route.file.name || "upload"}`,
          tier,
          extractor: "CSV import",
          forceReviewForNewOrgs: false,
          userNote,
        });

        const extraSections = missingUpgradeCandidates.length > 0
          ? [`Heads up — the brief names ${missingUpgradeCandidates.join(", ")} as upgrade candidates, but I didn't find them in this CSV. Wanted to flag that rather than guess.`]
          : [];

        await say({
          ...bulletMessage(
            "Done!",
            [`${result.added} new`, `${result.merged} merged`, `${result.inMaster} already in Master`, `${result.review} flagged for review`],
            `📊 <${stagingSheetLink()}|Open Data Staging>  •  Run ${result.runId}`,
            extraSections
          ),
          thread_ts,
        });
        await react(client, event.channel, event.ts, "white_check_mark");
      } catch (e: any) {
        if (e instanceof AmbiguousOrgColumnError) {
          await say({
            text: `I can't tell which column has the organization name in this one — headers are: ${e.headers.join(", ")}. Mind renaming that column to something like "Organization" and resending?`,
            thread_ts,
          });
        } else {
          console.error("[csv path] failed:", e.message);
          await say({ text: `Ran into a snag processing that CSV: ${e.message}`, thread_ts });
        }
        await react(client, event.channel, event.ts, "x");
      }
      break;
    case "text":
      await say({
        text: `Got your file (${route.file.name})${userNote ? " and your note — I'll factor that in" : ""} — digging through it for org names now, one sec 👀`,
        thread_ts,
      });
      try {
        const buf = await downloadSlackFile(route.file.url_private!, process.env.SLACK_BOT_TOKEN!);
        const fileText = buf.toString("utf-8");
        const { items, dropped } = await extractOrgsFromText(fileText, userNote);

        const result = await processItems(items, {
          sourceLabel: `Markdown/Text via Slack (<@${event.user}>, ${scrapedAtNow()})`,
          sourceUrl: route.file.permalink || route.file.url_private || "internal://slack-text-upload",
          sourceSlug: `slack-text-${route.file.name || "upload"}`,
          tier: "-",
          extractor: "Text",
          forceReviewForNewOrgs: false,
          userNote,
        });

        await say({
          ...bulletMessage(
            "Done!",
            [
              `${result.added} new`,
              `${result.merged} merged`,
              `${result.inMaster} already in Master`,
              `${result.review} flagged for review`,
              `${dropped} dropped (couldn't verify in the doc)`,
            ],
            `📊 <${stagingSheetLink()}|Open Data Staging>  •  Run ${result.runId}`
          ),
          thread_ts,
        });
        await react(client, event.channel, event.ts, "white_check_mark");
      } catch (e: any) {
        console.error("[text path] failed:", e.message);
        await say({ text: `Ran into a snag processing that file: ${e.message}`, thread_ts });
        await react(client, event.channel, event.ts, "x");
      }
      break;
    case "image":
      await say({
        text: `Got your image (${route.file.name})${userNote ? " and your note — I'll factor that in" : ""} — reading the logos now, one sec 👀`,
        thread_ts,
      });
      try {
        const buf = await downloadSlackFile(route.file.url_private!, process.env.SLACK_BOT_TOKEN!);
        const items = await extractOrgsFromImage(buf, route.file.mimetype || "image/png", userNote);

        const result = await processItems(items, {
          sourceLabel: `Image via Slack (<@${event.user}>, ${scrapedAtNow()})`,
          sourceUrl: route.file.permalink || route.file.url_private || "internal://slack-image-upload",
          sourceSlug: `slack-image-${route.file.name || "upload"}`,
          tier: "-",
          extractor: "Vision",
          forceReviewForNewOrgs: true,
          userNote,
        });

        await say({
          ...bulletMessage(
            "Done!",
            [`${result.added} new`, `${result.merged} merged`, `${result.inMaster} already in Master`, `${result.review} flagged for review`],
            `📊 <${stagingSheetLink()}|Open Data Staging>  •  Run ${result.runId}`
          ),
          thread_ts,
        });
        await react(client, event.channel, event.ts, "white_check_mark");
      } catch (e: any) {
        console.error("[image path] failed:", e.message);
        await say({ text: `Ran into a snag reading that image: ${e.message}`, thread_ts });
        await react(client, event.channel, event.ts, "x");
      }
      break;
    case "pdf":
      await say({
        text: `Got your PDF (${route.file.name})${userNote ? " and your note — I'll factor that in" : ""} — reading through it now, one sec 📄`,
        thread_ts,
      });
      try {
        const buf = await downloadSlackFile(route.file.url_private!, process.env.SLACK_BOT_TOKEN!);
        const { items, truncated } = await extractOrgsFromPdf(buf, userNote);

        const result = await processItems(items, {
          sourceLabel: `PDF via Slack (<@${event.user}>, ${scrapedAtNow()})`,
          sourceUrl: route.file.permalink || route.file.url_private || "internal://slack-pdf-upload",
          sourceSlug: `slack-pdf-${route.file.name || "upload"}`,
          tier: "-",
          extractor: "PDF",
          forceReviewForNewOrgs: true,
          userNote,
        });

        const extraSections = truncated
          ? [`Heads up — Gemini flagged this PDF as too large to read in full, so this may be a partial result.`]
          : [];
        await say({
          ...bulletMessage(
            "Done!",
            [`${result.added} new`, `${result.merged} merged`, `${result.inMaster} already in Master`, `${result.review} flagged for review`],
            `📊 <${stagingSheetLink()}|Open Data Staging>  •  Run ${result.runId}`,
            extraSections
          ),
          thread_ts,
        });
        await react(client, event.channel, event.ts, "white_check_mark");
      } catch (e: any) {
        console.error("[pdf path] failed:", e.message);
        await say({ text: `Ran into a snag reading that PDF: ${e.message}`, thread_ts });
        await react(client, event.channel, event.ts, "x");
      }
      break;
    case "promote":
      await say({
        text: `On it — sweeping data-staging for Approved rows and working through them now, one sec 📋\n\n(I'll ask in here if I need anything from you.)`,
        thread_ts,
      });
      try {
        const result = await runPromotionAgent("on-demand", client, event.channel, thread_ts);
        await say({ ...result.message, thread_ts });
        await react(client, event.channel, event.ts, "white_check_mark");
      } catch (e: any) {
        console.error("[promote path] failed:", e.message);
        await say({ text: `Ran into a snag on the promotion run: ${e.message}`, thread_ts });
        await react(client, event.channel, event.ts, "x");
      }
      break;
    case "approve":
      try {
        const confirmed = await appendSourceTypeToDropdown(route.value);
        await say({
          ...bulletMessage(
            `Done — "${route.value}" is now a live Source Type option.`,
            confirmed,
            `Re-run \`promote\` (or the nightly sweep will pick it up) to use it.`
          ),
          thread_ts,
        });
        await react(client, event.channel, event.ts, "white_check_mark");
      } catch (e: any) {
        console.error("[approve path] failed:", e.message);
        await say({ text: `Couldn't add that Source Type: ${e.message}`, thread_ts });
        await react(client, event.channel, event.ts, "x");
      }
      break;
    case "unsupported_file":
      await say({ text: `Not sure what to do with "${route.file.name}" (${route.file.mimetype || route.file.filetype || "unknown type"}) — I can take a URL, CSV, PDF, image, or Markdown/text file.`, thread_ts });
      break;
    case "chat":
      try {
        const answer = await answerQuestion(route.text);
        await say({ text: answer, thread_ts });
        await react(client, event.channel, event.ts, "white_check_mark");
      } catch (e: any) {
        console.error("[chat path] failed:", e.message);
        await say({ text: `Ran into a snag answering that: ${e.message}`, thread_ts });
        await react(client, event.channel, event.ts, "x");
      }
      break;
    case "none":
      await say({ text: `👋 Mention me with a URL, or attach a CSV, PDF, image, or Markdown/text file.`, thread_ts });
      break;
  }
});

// Wastebasket-react-to-delete: only ever deletes messages this bot itself
// posted (chat.delete can't touch other authors' messages anyway), and only
// responds to the admin user (Tej) — no one else can trigger a delete.
let botUserId: string | undefined;

app.event("reaction_added", async ({ event, client }) => {
  const e = event as any;
  if (e.reaction !== "wastebasket") return;
  if (e.item?.type !== "message") return;
  if (e.item_user !== botUserId) return;
  if (e.user !== process.env.SLACK_ADMIN_USER_ID) return;

  try {
    await client.chat.delete({ channel: e.item.channel, ts: e.item.ts });
    console.log(`[reaction_added] deleted message ${e.item.ts} in ${e.item.channel}`);
  } catch (err: any) {
    console.error("[reaction_added] delete failed:", err.message);
  }
});

// Resumes a held Promotion Agent row (PRD §11.5) — any plain thread reply,
// whenever it arrives, gets matched against persisted pending questions by
// thread_ts and resumes just that one row, no re-triggering `promote` needed.
// Requires the `message.channels` Event Subscription + `channels:history` scope
// (new, not yet granted as of 2026-07-04 — see AGENTS.md §Setup).
app.message(async ({ message, say }) => {
  const m = message as any;
  if (m.subtype || m.bot_id || !m.thread_ts) return;
  // A reply that mentions the bot fires `app_mention` too, which already runs
  // `tryResumePendingQuestion` itself — skip here so it isn't handled twice.
  if (botUserId && (m.text || "").includes(`<@${botUserId}>`)) return;
  await tryResumePendingQuestion(m.thread_ts, m.text || "", say);
});

app.error(async (error) => {
  console.error("[bolt error]", error);
});

// Nightly safety-net sweep (PRD §10.2/§10.6 Q5): run the same promotion job so
// nothing Approved sits forgotten. 02:00 America/Vancouver — reuses time.ts's
// timezone convention rather than hand-rolling offset math. Posts to #tej-bots.
function scheduleNightlyPromotion() {
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!channel) {
    console.warn("[cron] SLACK_CHANNEL_ID not set — skipping nightly promotion sweep");
    return;
  }
  cron.schedule(
    "0 2 * * *",
    async () => {
      console.log("[cron] nightly promotion sweep starting");
      try {
        const posted = await app.client.chat.postMessage({
          channel,
          text: `🌙 Nightly promotion sweep starting.\n\n(I'll ask in here if I need anything.)`,
        });
        const result = await runPromotionAgent("nightly", app.client, channel, posted.ts as string);
        await app.client.chat.postMessage({ channel, thread_ts: posted.ts as string, ...result.message });
      } catch (e: any) {
        console.error("[cron] nightly promotion sweep failed:", e.message);
        await app.client.chat.postMessage({ channel, text: `Nightly promotion sweep hit a snag: ${e.message}` });
      }
    },
    { timezone: "America/Vancouver" }
  );
}

(async () => {
  const auth = await app.client.auth.test();
  botUserId = auth.user_id as string;
  await app.start();
  scheduleNightlyPromotion();
  console.log(`⚡️ VSW Slack Intake Service is running (Socket Mode) as ${botUserId}`);
})();
