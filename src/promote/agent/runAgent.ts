import { masterSheetLink, readStagingApprovedRows } from "../../sheets";
import { bulletMessage } from "../../slack/reply";
import type { StagingApprovedRow } from "../../types";
import { appendRunLogBody, createRunLogPage } from "./notionClient";
import { runRowAgent, type RowOutcome } from "./loop";
import type { PendingQuestion } from "./pendingQuestions";

interface SlackClient {
  chat: { postMessage: (args: any) => Promise<any>; getPermalink?: (args: any) => Promise<any> };
}

export interface PromotionAgentResult {
  message: ReturnType<typeof bulletMessage>;
  notionUrl: string | null;
}

/**
 * Full Promotion Agent sweep (PRD §11, replaces the deterministic `runPromotion`
 * as the `promote` command's orchestrator). Reads Approved rows, deterministically
 * pre-filters Duplicate?="Review" rows (PRD §10.6 Q4 — a resolved human-gate rule,
 * NOT left to the agent's discretion, unlike the Path A/B + Source Type decisions
 * which are), runs one bounded agent-loop invocation per remaining row (sequential,
 * not parallel — avoids two rows racing to aggregate onto the same Master org),
 * then writes one Notion run-log row covering the whole sweep.
 */
export async function runPromotionAgent(
  trigger: "on-demand" | "nightly",
  slackClient: SlackClient,
  channel: string,
  threadTs: string
): Promise<PromotionAgentResult> {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${trigger}`;
  const staging = await readStagingApprovedRows();
  const approved = staging.filter((r) => r.reviewStatus === "Approved");

  const skippedReview = approved.filter((r) => r.duplicate === "Review");
  const toProcess = approved.filter((r) => r.duplicate !== "Review");

  const outcomes: RowOutcome[] = [];
  let tokensSpent = 0;
  let firecrawlCalls = 0;

  for (const row of toProcess) {
    const outcome = await runRowAgent(row, {
      organization: row.organization,
      stagingRowNumber: row.rowNumber,
      channel,
      threadTs,
      slackClient,
    });
    outcomes.push(outcome);
    tokensSpent += outcome.tokensUsed;
    firecrawlCalls += outcome.firecrawlCalls;
  }

  const added = outcomes.filter((o) => o.outcome === "added").length;
  const merged = outcomes.filter((o) => o.outcome === "merged").length;
  const held = outcomes.filter((o) => o.outcome === "held").length;
  const failed = outcomes.filter((o) => o.outcome === "failed").length;

  const status = failed > 0 && added + merged === 0 ? "failed" : held + failed > 0 ? "partial" : "success";

  // A real Slack permalink (via chat.getPermalink) rather than a hand-built URL
  // — avoids hardcoding this workspace's subdomain / message-ts encoding.
  let slackThreadUrl: string | undefined;
  try {
    const permalink = await slackClient.chat.getPermalink?.({ channel, message_ts: threadTs });
    slackThreadUrl = permalink?.permalink;
  } catch (e: any) {
    console.error("[promotion agent] chat.getPermalink failed:", e.message);
  }

  let notionUrl: string | null = null;
  try {
    const page = await createRunLogPage({
      runId,
      trigger,
      status,
      added,
      merged,
      skippedReview: skippedReview.length,
      slackThreadUrl,
      // v1 doesn't distinguish *why* a row was held (budget vs. unconfirmed Source
      // Type vs. ambiguous match) at the Notion-property level — "held" is the
      // dominant real-world cause per the redesign that motivated this agent
      // (PRD §10.6 Q3), so it's the closest existing bucket. The exact reason for
      // each held row is always in the page body's per-row detail.
      skippedSourceType: held,
      failed,
      tokensSpent,
      firecrawlCalls,
    });
    notionUrl = page.url;
    const lines = [
      `run: ${runId}`,
      `trigger: ${trigger}`,
      `staging Approved rows: ${approved.length} (${skippedReview.length} blocked — Duplicate="Review", per Q4)`,
      "",
      ...outcomes.flatMap((o) => [`--- ${o.organization} (row ${o.stagingRowNumber}) — ${o.outcome} ---`, o.detail, ...o.transcript, ""]),
    ];
    await appendRunLogBody(page.pageId, lines);
  } catch (e: any) {
    console.error("[promotion agent] Notion run log failed:", e.message);
  }

  const bullets = [`${added} added to Master`, `${merged} merged into existing`];
  if (skippedReview.length > 0) bullets.push(`${skippedReview.length} skipped (need you to confirm the match)`);
  if (held > 0) bullets.push(`${held} held (I need more info or your OK — I'll follow up in-thread)`);
  if (failed > 0) bullets.push(`${failed} failed`);

  const links = [`📋 <${masterSheetLink()}|Open Master Prospects>`];
  if (notionUrl) links.push(`📝 <${notionUrl}|Open Log Entry>`);
  const contextText = `Engine: Promotion Agent  •  ${links.join("  •  ")}`;

  const failures = outcomes.filter((o) => o.outcome === "failed");
  const extraSections = failures.length > 0
    ? [`These didn't go through:\n${failures.map((f) => `• ${f.organization}: ${f.detail}`).join("\n")}`]
    : [];

  const message = bulletMessage("Promotion run done!", bullets, contextText, extraSections);
  return { message, notionUrl };
}

/**
 * Resume exactly ONE previously-held row after Tej replies to its pending
 * ask_tej_on_slack question (PRD §11.5 step 4) — re-reads that Staging row fresh
 * (its Duplicate/Approved state could theoretically have changed) and runs a
 * fresh bounded loop for it, now equipped with Tej's answer. Posts the outcome
 * directly to the same thread; v1 doesn't create a separate Notion row for a
 * resumed single item (the original run's page body already shows it was held).
 */
export async function resumePendingRow(
  pending: PendingQuestion,
  slackClient: SlackClient
): Promise<RowOutcome | null> {
  const staging = await readStagingApprovedRows();
  const row = staging.find((r: StagingApprovedRow) => r.rowNumber === pending.stagingRowNumber);
  if (!row || row.reviewStatus !== "Approved") return null;

  return runRowAgent(
    row,
    { organization: row.organization, stagingRowNumber: row.rowNumber, channel: pending.channel, threadTs: pending.threadTs, slackClient },
    { question: pending.question, answer: pending.answer || "" }
  );
}
