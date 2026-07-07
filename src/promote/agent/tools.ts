import { sameOrg } from "../../dedup";
import {
  appendAggregate,
  appendMasterRow,
  markStagingMergedToMaster,
  nextMasterRowNumber,
  readMasterPromotionIndex,
  readMasterRowAggregateFields,
  readSourceTypeDropdown,
  updateMasterAggregateRow,
} from "../../sheets";
import { CATEGORY_ENUM } from "../../types";
import { firecrawlScrape, firecrawlSearch } from "./firecrawlClient";
import { getCachedSourceType, setCachedSourceType } from "./sourceTypeCache";
import { addPendingQuestion, markAskActive, markAskInactive, pollForAnswer } from "./pendingQuestions";

/** Everything a tool handler needs that ISN'T part of the model-visible input — closed over per row. */
export interface ToolContext {
  organization: string;
  stagingRowNumber: number;
  channel: string;
  threadTs: string;
  slackClient: { chat: { postMessage: (args: any) => Promise<any> } };
  usage: { firecrawlCalls: number };
  askTimeoutMs: number; // exposed for tests — default 5 minutes in production
  askPollIntervalMs?: number; // exposed for tests — default 5s in production
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, any>; required?: string[] };
  handler: (input: any, ctx: ToolContext) => Promise<unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const TOOLS: ToolDefinition[] = [
  {
    name: "read_master_index",
    description:
      "Fresh read of every master-prospects row: row number, Organization Name, Why Them, Source Link. Re-reads live every call.",
    input_schema: { type: "object", properties: {} },
    handler: async () => {
      const rows = await readMasterPromotionIndex();
      return rows.map((r) => ({
        rowNumber: r.rowNumber,
        organization: r.organization,
        whyThem: r.whyThem,
        sourceLink: r.sourceLink,
      }));
    },
  },
  {
    name: "match_master_org",
    description:
      "Check whether an organization name matches an existing master-prospects row, using the same variant-tolerant sameOrg() matcher the dedup engine uses (PRD §10.3 — do not eyeball-match names yourself, always use this tool). Returns the matched row if any.",
    input_schema: {
      type: "object",
      properties: { organizationName: { type: "string" } },
      required: ["organizationName"],
    },
    handler: async (input: { organizationName: string }) => {
      const master = await readMasterPromotionIndex();
      const match = master.find((m) => sameOrg(m.organization, input.organizationName));
      if (!match) return { matched: false };
      return {
        matched: true,
        rowNumber: match.rowNumber,
        organization: match.organization,
        whyThem: match.whyThem,
        sourceLink: match.sourceLink,
      };
    },
  },
  {
    name: "read_source_type_dropdown",
    description:
      "Live Source Type values currently allowed on master-prospects col I. Always re-reads fresh — never assume yesterday's list. A value not in this list CANNOT be written by append_master_row.",
    input_schema: { type: "object", properties: {} },
    handler: async () => readSourceTypeDropdown(),
  },
  {
    name: "lookup_source_type_cache",
    description:
      "Check whether this exact Source label has already been classified to a Source Type in a past run, to avoid re-deciding it from scratch.",
    input_schema: { type: "object", properties: { source: { type: "string" } }, required: ["source"] },
    handler: async (input: { source: string }) => {
      const cached = getCachedSourceType(input.source);
      return { cached: cached ?? null };
    },
  },
  {
    name: "firecrawl_search",
    description: "Search the web (Firecrawl /search) to research an unfamiliar org or event name.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    handler: async (input: { query: string }, ctx: ToolContext) => {
      ctx.usage.firecrawlCalls += 1;
      return firecrawlSearch(input.query);
    },
  },
  {
    name: "firecrawl_scrape",
    description: "Scrape one URL (Firecrawl /scrape) to read its content as markdown, e.g. a search result.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    handler: async (input: { url: string }, ctx: ToolContext) => {
      ctx.usage.firecrawlCalls += 1;
      const markdown = await firecrawlScrape(input.url);
      return { markdown };
    },
  },
  {
    name: "append_master_row",
    description:
      "Write ONE new master-prospects row (Path A — net new). Only populates Organization Name/Category/Subsector/Why Them/Source Type/Source Link/Warm Lead?/Warm Lead Path/Notes — every other column stays blank, structurally, no matter what is passed. sourceType MUST already be live in the dropdown (call read_source_type_dropdown first) or this throws.",
    input_schema: {
      type: "object",
      properties: {
        organizationName: { type: "string" },
        category: { type: "string" },
        subsector: { type: "string" },
        whyThem: { type: "string" },
        sourceType: { type: "string" },
        sourceLink: { type: "string" },
        warmLead: {
          type: "boolean",
          description: "The Warm Lead? column is a real checkbox: pass true only if this row's context shows a genuine warm connection / prior relationship (e.g. a past-sponsor/partner history or a named path in), false otherwise. Do not guess true.",
        },
        warmLeadPath: { type: "string" },
        notes: { type: "string" },
        sourceText: { type: "string", description: "The original Staging Source (col F) label — used only to cache this Source Type decision, never written to any cell." },
      },
      required: ["organizationName", "category", "subsector", "whyThem", "sourceType", "sourceLink", "warmLead", "warmLeadPath", "notes"],
    },
    handler: async (input: any) => {
      if (!CATEGORY_ENUM.includes(input.category)) {
        throw new Error(`append_master_row: "${input.category}" is not a valid Category — refuses to write an unvalidated enum value (AGENTS.md golden rule #15).`);
      }
      const liveSourceTypes = await readSourceTypeDropdown();
      if (!liveSourceTypes.includes(input.sourceType)) {
        throw new Error(
          `append_master_row: "${input.sourceType}" is not yet a live Source Type value (live: ${liveSourceTypes.join(", ")}). Ask Tej to approve it first (ask_tej_on_slack) — never write an unconfirmed enum value (AGENTS.md golden rule #15).`
        );
      }
      const master = await readMasterPromotionIndex();
      const rowNumber = nextMasterRowNumber(master);
      // col K is a real checkbox — coerce to an actual boolean so a stray
      // "true"/"Y"/"yes" string from the model still writes a real TRUE, never
      // text that would trip the checkbox validation.
      const warmLead =
        input.warmLead === true ||
        /^(true|y|yes)$/i.test(String(input.warmLead ?? "").trim());
      await appendMasterRow(
        {
          organizationName: input.organizationName,
          category: input.category,
          subsector: input.subsector,
          whyThem: input.whyThem,
          sourceType: input.sourceType,
          sourceLink: input.sourceLink,
          warmLead,
          warmLeadPath: input.warmLeadPath,
          notes: input.notes,
        },
        rowNumber
      );
      if (input.sourceText) setCachedSourceType(input.sourceText, input.sourceType);
      return { rowNumber };
    },
  },
  {
    name: "update_master_aggregate_row",
    description:
      "Aggregate onto an EXISTING master-prospects row (Path B). Only ever touches Why Them (F) + Source Link (J) — re-reads both fresh right before writing and idempotently pipe-joins your addition (skips if already present). Never touches any other column.",
    input_schema: {
      type: "object",
      properties: {
        rowNumber: { type: "number" },
        whyThemAddition: { type: "string" },
        sourceLinkAddition: { type: "string" },
      },
      required: ["rowNumber", "whyThemAddition", "sourceLinkAddition"],
    },
    handler: async (input: { rowNumber: number; whyThemAddition: string; sourceLinkAddition: string }) => {
      const current = await readMasterRowAggregateFields(input.rowNumber);
      const whyThem = appendAggregate(current.whyThem, input.whyThemAddition);
      const sourceLink = appendAggregate(current.sourceLink, input.sourceLinkAddition);
      await updateMasterAggregateRow(input.rowNumber, whyThem, sourceLink);
      return { whyThem, sourceLink };
    },
  },
  {
    name: "flip_staging_review_status",
    description: "Flip a data-staging row's Review Status to Merged-to-Master. Only call this AFTER a real Master write succeeded.",
    input_schema: { type: "object", properties: { rowNumber: { type: "number" } }, required: ["rowNumber"] },
    handler: async (input: { rowNumber: number }) => {
      await markStagingMergedToMaster([input.rowNumber]);
      return { ok: true };
    },
  },
  {
    name: "ask_tej_on_slack",
    description:
      "Post a question in-thread to Tej and wait for a reply (up to 5 minutes in this run). If he doesn't answer in time, this row is held pending — a later reply in the same thread resumes it automatically, so this is safe to use whenever you're genuinely unsure rather than guessing.",
    input_schema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
    handler: async (input: { question: string }, ctx: ToolContext) => {
      await ctx.slackClient.chat.postMessage({
        channel: ctx.channel,
        thread_ts: ctx.threadTs,
        text: `🤔 ${input.question}\n\n(No rush — reply here whenever, even if it's after this run finishes. I'll pick it back up.)`,
      });
      const pending = addPendingQuestion({
        id: `${ctx.stagingRowNumber}-${Date.now()}`,
        organization: ctx.organization,
        stagingRowNumber: ctx.stagingRowNumber,
        channel: ctx.channel,
        threadTs: ctx.threadTs,
        question: input.question,
        askedAt: new Date().toISOString(),
      });

      // Mark this ask as actively awaited in-run so the out-of-thread resume
      // listener (index.ts) leaves the reply to this poll instead of also
      // spawning a second loop for the same row (double-processing race fixed
      // 2026-07-06). Always cleared, even on an early return/throw.
      markAskActive(pending.id);
      try {
        const pollIntervalMs = ctx.askPollIntervalMs ?? 5000;
        const deadline = Date.now() + ctx.askTimeoutMs;
        while (Date.now() < deadline) {
          const answer = pollForAnswer(pending.id);
          if (answer !== undefined) return { answered: true, answer };
          await sleep(Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 0)));
        }
        return { answered: false };
      } finally {
        markAskInactive(pending.id);
      }
    },
  },
];
