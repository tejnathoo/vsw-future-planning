import { getAnthropicClient, parseStrictJson } from "../../anthropicClient";
import type { StagingApprovedRow } from "../../types";
import { buildSystemPrompt } from "./systemPrompt";
import { TOOLS, type ToolContext } from "./tools";

// Raised 2026-07-06 from 6 / 90s: every row now does a mandatory Firecrawl
// research pass (search + often a scrape) before writing Why Them, so the old
// budget — sized for a write-only loop — would trip nearly every row into a
// false "held — budget". Firecrawl calls are also seconds each, hence the
// wider wall clock. The MAX_LOOP_ITERATIONS safety net below is unchanged.
const MAX_TOOL_CALLS = 10;
const WALL_CLOCK_BUDGET_MS = 180_000;
const ASK_TEJ_TIMEOUT_MS = 5 * 60_000;
/** Absolute safety net independent of the time/tool budgets — should never be hit in practice. */
const MAX_LOOP_ITERATIONS = 20;

export interface RowOutcome {
  organization: string;
  stagingRowNumber: number;
  outcome: "added" | "merged" | "held" | "failed";
  detail: string;
  tokensUsed: number;
  firecrawlCalls: number;
  transcript: string[];
  /**
   * Whether `ask_tej_on_slack` was actually called during this row (PLAN Stage
   * 7 bug fix, 2026-07-05) — `outcome: "held"` is self-reported by the model in
   * its final JSON and was never actually gated on having asked anything, so a
   * row could go "held" with nothing ever posted to Slack and no pending
   * question created, silently breaking the run summary's "I'll follow up
   * in-thread" promise. Callers (runAgent.ts) use this to be honest about
   * which held rows actually have a question waiting on a reply.
   */
  askCalled: boolean;
}

function rowContext(row: StagingApprovedRow, priorAnswer?: { question: string; answer: string }): string {
  const lines = [
    `Organization: ${row.organization}`,
    `Category: ${row.category}`,
    `Sector: ${row.sector}`,
    `Source (Staging col F): ${row.source}`,
    `Source URL: ${row.sourceUrl}`,
    `Tier: ${row.tier}`,
    `Why Them: ${row.whyThem}`,
    `Warm Lead: ${row.warmLead}`,
    `Duplicate flag: ${row.duplicate === "" ? "(blank — net new)" : row.duplicate}`,
    `Staging row number: ${row.rowNumber}`,
  ];
  if (priorAnswer) {
    lines.push(
      "",
      `You previously asked Tej: "${priorAnswer.question}"`,
      `Tej replied: "${priorAnswer.answer}"`,
      "Use this to finish deciding this row now."
    );
  }
  return lines.join("\n");
}

/**
 * One bounded agent-loop invocation for ONE Approved Staging row (PRD §11.2/11.3).
 * Row-per-invocation, not one continuous conversation across a whole sweep — this
 * keeps guardrails simple to enforce and keeps one row's failure/timeout from
 * ever affecting another (same isolation posture the old deterministic
 * `runPromotion` already had, AGENTS.md golden rule #3).
 *
 * Guardrail note (deviation from a literal "hard stop at 6/90s", logged in PLAN's
 * Execution Log): once a master-prospects write has actually succeeded,
 * `flip_staging_review_status` is always allowed to run even if it would
 * otherwise exceed the cap — the alternative (a write with no flip) risks the
 * SAME row being promoted again on the next sweep and duplicating the Master
 * row, which is worse than one extra tool call.
 */
export async function runRowAgent(
  row: StagingApprovedRow,
  ctx: Omit<ToolContext, "usage" | "askTimeoutMs">,
  priorAnswer?: { question: string; answer: string }
): Promise<RowOutcome> {
  const anthropic = getAnthropicClient();
  const model = process.env.PROMOTION_AGENT_MODEL || "claude-sonnet-5";
  const toolCtx: ToolContext = { ...ctx, usage: { firecrawlCalls: 0 }, askTimeoutMs: ASK_TEJ_TIMEOUT_MS };

  const anthropicTools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  const messages: any[] = [{ role: "user", content: rowContext(row, priorAnswer) }];
  const transcript: string[] = [`row: ${row.organization} (Staging row ${row.rowNumber}, Duplicate="${row.duplicate}")`];
  console.log(`[promotion agent] starting row ${row.rowNumber} "${row.organization}" (Duplicate="${row.duplicate}", Source="${row.source}")`);

  let tokensUsed = 0;
  let toolCallCount = 0;
  let masterWriteSucceeded = false;
  let flipCalled = false;
  let flipGraceUsed = false;
  let askCalled = false;
  let heldWithoutAskingNudgeUsed = false;
  // Time spent *inside* ask_tej_on_slack waiting on a human reply. Excluded from
  // the wall-clock budget below (bug fixed 2026-07-06): otherwise a row that
  // asked Tej a question and got an answer ~1 min later would immediately trip
  // "over budget" on the very next iteration and be held as "budget exceeded",
  // silently throwing away the answer it just received. Human think-time is not
  // the agent's compute budget.
  let askWaitMs = 0;
  const startedAt = Date.now();

  for (let iteration = 0; iteration < MAX_LOOP_ITERATIONS; iteration++) {
    const elapsed = Date.now() - startedAt - askWaitMs;
    const overBudget = toolCallCount >= MAX_TOOL_CALLS || elapsed >= WALL_CLOCK_BUDGET_MS;
    if (overBudget) {
      if (masterWriteSucceeded && flipCalled) {
        // Wrap-up only: the real risk (the write + the flip) is already done —
        // let the model give its final text answer, but no further tool calls
        // will be honored (enforced below), so this can't run away.
      } else if (masterWriteSucceeded && !flipGraceUsed) {
        // Exactly one extra iteration, ONLY to give the model a chance to call
        // flip_staging_review_status — never to keep researching/writing.
        // Never silently treat "wrote but never flipped" as a normal outcome:
        // that state risks a duplicate Master row on the next sweep.
        flipGraceUsed = true;
      } else if (masterWriteSucceeded) {
        transcript.push("budget exceeded after a successful write, but flip_staging_review_status was never called");
        return { organization: row.organization, stagingRowNumber: row.rowNumber, outcome: "failed", detail: "Wrote to master-prospects but ran out of budget before flipping this Staging row's Review Status — check it manually before re-running promote, or it may be promoted twice.", tokensUsed, firecrawlCalls: toolCtx.usage.firecrawlCalls, transcript, askCalled };
      } else {
        transcript.push(`budget exceeded (${toolCallCount} tool calls, ${elapsed}ms) with no write yet — holding this row`);
        return { organization: row.organization, stagingRowNumber: row.rowNumber, outcome: "held", detail: "Hit the tool-call/time budget before reaching a confident decision.", tokensUsed, firecrawlCalls: toolCtx.usage.firecrawlCalls, transcript, askCalled };
      }
    }

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages,
      tools: anthropicTools,
    });
    tokensUsed += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    if (response.stop_reason !== "tool_use") {
      const finalBlock: any = response.content.find((b) => b.type === "text");
      const finalText = finalBlock?.text || "";
      transcript.push(`final: ${finalText}`);
      try {
        const parsed = parseStrictJson<{ outcome: RowOutcome["outcome"]; detail: string }>(finalText);

        // Structural guard, not just a prompt request (PLAN Stage 7 bug fix,
        // 2026-07-05): "held" is self-reported by the model and was never
        // actually gated on having asked Tej anything — a row could go held
        // with nothing posted to Slack and no pending question created,
        // silently breaking the run summary's "I'll follow up in-thread"
        // promise. Give it exactly one chance to actually ask (or reconsider)
        // before accepting a silent hold as terminal.
        if (parsed.outcome === "held" && !askCalled && !heldWithoutAskingNudgeUsed) {
          heldWithoutAskingNudgeUsed = true;
          transcript.push(`model reported "held" without ever calling ask_tej_on_slack — nudging it to actually ask or reconsider`);
          messages.push({ role: "assistant", content: response.content });
          messages.push({
            role: "user",
            content:
              "You reported outcome \"held\" but never called ask_tej_on_slack, so nothing was actually communicated. If you're unsure, call ask_tej_on_slack with your specific question now. If you can decide confidently instead, do that.",
          });
          continue;
        }

        console.log(`[promotion agent] ${row.organization} (row ${row.rowNumber}) -> ${parsed.outcome}: ${parsed.detail}`);
        return { organization: row.organization, stagingRowNumber: row.rowNumber, outcome: parsed.outcome, detail: parsed.detail, tokensUsed, firecrawlCalls: toolCtx.usage.firecrawlCalls, transcript, askCalled };
      } catch {
        return { organization: row.organization, stagingRowNumber: row.rowNumber, outcome: "failed", detail: `Model's final answer wasn't valid JSON: ${finalText.slice(0, 200)}`, tokensUsed, firecrawlCalls: toolCtx.usage.firecrawlCalls, transcript, askCalled };
      }
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: any[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const isFlipAfterWrite = masterWriteSucceeded && !flipCalled && block.name === "flip_staging_review_status";
      if (toolCallCount >= MAX_TOOL_CALLS && !isFlipAfterWrite) {
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Tool-call budget exhausted for this row.", is_error: true });
        continue;
      }

      toolCallCount += 1;
      const def = TOOLS.find((t) => t.name === block.name);
      if (!def) {
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `Unknown tool "${block.name}" — not in the allowlist.`, is_error: true });
        continue;
      }
      try {
        const handlerStart = Date.now();
        const result = await def.handler(block.input, toolCtx);
        if (block.name === "append_master_row" || block.name === "update_master_aggregate_row") masterWriteSucceeded = true;
        if (block.name === "flip_staging_review_status") flipCalled = true;
        if (block.name === "ask_tej_on_slack") {
          askCalled = true;
          // The vast majority of this call is blocking on a human reply — don't
          // charge that wait to the wall-clock budget (see askWaitMs above).
          askWaitMs += Date.now() - handlerStart;
        }
        console.log(`[promotion agent] ${row.organization}: ${block.name}(${JSON.stringify(block.input).slice(0, 200)}) -> ${JSON.stringify(result).slice(0, 200)}`);
        transcript.push(`tool: ${block.name}(${JSON.stringify(block.input)}) -> ${JSON.stringify(result).slice(0, 300)}`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      } catch (e: any) {
        console.log(`[promotion agent] ${row.organization}: ${block.name}(${JSON.stringify(block.input).slice(0, 200)}) -> ERROR: ${e.message}`);
        transcript.push(`tool: ${block.name}(${JSON.stringify(block.input)}) -> ERROR: ${e.message}`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: e.message, is_error: true });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  transcript.push("hit the absolute iteration safety net without a final answer");
  const detail = masterWriteSucceeded && !flipCalled
    ? "Wrote to master-prospects but hit the loop's absolute iteration cap before flipping this Staging row's Review Status — check it manually before re-running promote, or it may be promoted twice."
    : "Hit the loop's absolute iteration cap without reaching a final answer.";
  return { organization: row.organization, stagingRowNumber: row.rowNumber, outcome: "failed", detail, tokensUsed, firecrawlCalls: toolCtx.usage.firecrawlCalls, transcript, askCalled };
}
