import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StagingApprovedRow } from "../src/types";

const anthropicMocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../src/anthropicClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/anthropicClient")>();
  return { ...actual, getAnthropicClient: () => ({ messages: { create: anthropicMocks.create } }) };
});

const noopHandler = vi.fn().mockResolvedValue({ ok: true });
const appendHandler = vi.fn().mockResolvedValue({ rowNumber: 999 });
const flipHandler = vi.fn().mockResolvedValue({ ok: true });

vi.mock("../src/promote/agent/tools", () => ({
  TOOLS: [
    { name: "noop_tool", description: "d", input_schema: { type: "object", properties: {} }, handler: noopHandler },
    { name: "append_master_row", description: "d", input_schema: { type: "object", properties: {} }, handler: appendHandler },
    { name: "flip_staging_review_status", description: "d", input_schema: { type: "object", properties: {} }, handler: flipHandler },
  ],
}));

const { runRowAgent } = await import("../src/promote/agent/loop");

function row(overrides: Partial<StagingApprovedRow> = {}): StagingApprovedRow {
  return {
    rowNumber: 66, organization: "Acme", orgKey: "acme", domain: "", category: "Tech", sector: "SaaS",
    source: "Viv sponsor CSV", sourceUrl: "internal://x", tier: "1", whyThem: "w", warmLead: "",
    duplicate: "", matchedOrg: "", timesSeen: "1", runId: "r", scrapedAt: "2026-07-04T00:00:00-07:00",
    extractor: "CSV import", reviewStatus: "Approved", ...overrides,
  };
}

const baseCtx = { organization: "Acme", stagingRowNumber: 66, channel: "C1", threadTs: "1000.1", slackClient: { chat: { postMessage: vi.fn() } } };

function toolUseResponse(name: string, id: string, input: any = {}) {
  return { stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "tool_use", id, name, input }] };
}
function finalResponse(outcome: string, detail: string) {
  return { stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "text", text: JSON.stringify({ outcome, detail }) }] };
}

beforeEach(() => {
  anthropicMocks.create.mockReset();
  noopHandler.mockClear();
  appendHandler.mockClear();
  flipHandler.mockClear();
});

describe("runRowAgent — the normal path", () => {
  it("runs a tool call then returns the model's final JSON verbatim", async () => {
    anthropicMocks.create
      .mockResolvedValueOnce(toolUseResponse("noop_tool", "t1"))
      .mockResolvedValueOnce(finalResponse("added", "New Master row created."));

    const result = await runRowAgent(row(), baseCtx as any);
    expect(result.outcome).toBe("added");
    expect(result.detail).toBe("New Master row created.");
    expect(noopHandler).toHaveBeenCalledTimes(1);
    expect(result.tokensUsed).toBe(30);
  });

  it("treats a non-JSON final answer as failed rather than guessing", async () => {
    anthropicMocks.create.mockResolvedValueOnce({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "sure, all done!" }] });
    const result = await runRowAgent(row(), baseCtx as any);
    expect(result.outcome).toBe("failed");
    expect(result.detail).toMatch(/valid JSON/);
  });
});

describe("runRowAgent — tool-call budget (default 6 per row, PRD §11.7)", () => {
  it("holds the row if the budget is exhausted before any write ever happens", async () => {
    anthropicMocks.create.mockImplementation(() => Promise.resolve(toolUseResponse("noop_tool", `t${Math.random()}`)));
    const result = await runRowAgent(row(), baseCtx as any);
    expect(result.outcome).toBe("held");
    expect(noopHandler).toHaveBeenCalledTimes(6); // capped, never a 7th
  });

  it("still allows flip_staging_review_status one extra time right after a successful write, even over budget", async () => {
    let call = 0;
    anthropicMocks.create.mockImplementation(() => {
      call += 1;
      if (call <= 5) return Promise.resolve(toolUseResponse("noop_tool", `t${call}`));
      if (call === 6) return Promise.resolve(toolUseResponse("append_master_row", "t6"));
      if (call === 7) return Promise.resolve(toolUseResponse("flip_staging_review_status", "t7"));
      return Promise.resolve(finalResponse("added", "done"));
    });
    const result = await runRowAgent(row(), baseCtx as any);
    expect(flipHandler).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("added");
  });

  it("never silently reports success if the write happened but the flip never got its grace call used productively", async () => {
    // append succeeds on call 6 (the last one inside budget), then the model
    // keeps calling noop_tool instead of flipping during its one grace shot.
    let call = 0;
    anthropicMocks.create.mockImplementation(() => {
      call += 1;
      if (call <= 5) return Promise.resolve(toolUseResponse("noop_tool", `t${call}`));
      if (call === 6) return Promise.resolve(toolUseResponse("append_master_row", "t6"));
      return Promise.resolve(toolUseResponse("noop_tool", `t${call}`)); // burns the grace call on the wrong tool
    });
    const result = await runRowAgent(row(), baseCtx as any);
    expect(result.outcome).toBe("failed");
    expect(result.detail).toMatch(/never flipping|check it manually|ran out of budget/i);
    expect(flipHandler).not.toHaveBeenCalled();
  });
});
