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
const askHandler = vi.fn().mockResolvedValue({ answered: false });

vi.mock("../src/promote/agent/tools", () => ({
  TOOLS: [
    { name: "noop_tool", description: "d", input_schema: { type: "object", properties: {} }, handler: noopHandler },
    { name: "append_master_row", description: "d", input_schema: { type: "object", properties: {} }, handler: appendHandler },
    { name: "flip_staging_review_status", description: "d", input_schema: { type: "object", properties: {} }, handler: flipHandler },
    { name: "ask_tej_on_slack", description: "d", input_schema: { type: "object", properties: {} }, handler: askHandler },
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
  askHandler.mockClear();
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
    expect(result.askCalled).toBe(false);
  });

  it("treats a non-JSON final answer as failed rather than guessing", async () => {
    anthropicMocks.create.mockResolvedValueOnce({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "sure, all done!" }] });
    const result = await runRowAgent(row(), baseCtx as any);
    expect(result.outcome).toBe("failed");
    expect(result.detail).toMatch(/valid JSON/);
  });
});

describe("runRowAgent — 'held' requires actually asking (bug fix 2026-07-05)", () => {
  it("nudges the model instead of accepting a silent 'held' with no ask_tej_on_slack call", async () => {
    anthropicMocks.create
      .mockResolvedValueOnce(finalResponse("held", "Not sure about this one."))
      .mockResolvedValueOnce(toolUseResponse("ask_tej_on_slack", "t1", { question: "Is this a duplicate?" }))
      .mockResolvedValueOnce(finalResponse("held", "Asked Tej, waiting on a reply."));

    const result = await runRowAgent(row(), baseCtx as any);
    expect(askHandler).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("held");
    expect(result.askCalled).toBe(true);
  });

  it("accepts a second silent 'held' rather than nudging forever", async () => {
    anthropicMocks.create
      .mockResolvedValueOnce(finalResponse("held", "Not sure about this one."))
      .mockResolvedValueOnce(finalResponse("held", "Still not sure, not asking."));

    const result = await runRowAgent(row(), baseCtx as any);
    expect(askHandler).not.toHaveBeenCalled();
    expect(result.outcome).toBe("held");
    expect(result.askCalled).toBe(false);
  });

  it("accepts 'held' immediately if ask_tej_on_slack was already called earlier in the row", async () => {
    anthropicMocks.create
      .mockResolvedValueOnce(toolUseResponse("ask_tej_on_slack", "t1", { question: "Which Source Type?" }))
      .mockResolvedValueOnce(finalResponse("held", "Asked Tej, waiting on a reply."));

    const result = await runRowAgent(row(), baseCtx as any);
    expect(askHandler).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("held");
    expect(result.askCalled).toBe(true);
  });
});

describe("runRowAgent — tool-call budget (default 10 per row, PRD §11.7; raised from 6 for the mandatory research pass, 2026-07-06)", () => {
  it("holds the row if the budget is exhausted before any write ever happens", async () => {
    anthropicMocks.create.mockImplementation(() => Promise.resolve(toolUseResponse("noop_tool", `t${Math.random()}`)));
    const result = await runRowAgent(row(), baseCtx as any);
    expect(result.outcome).toBe("held");
    expect(noopHandler).toHaveBeenCalledTimes(10); // capped, never an 11th
  });

  it("does NOT count time spent waiting on a Tej reply against the wall-clock budget (bug fix 2026-07-06)", async () => {
    // Simulate a human taking 5 minutes to reply — far beyond the 180s wall
    // clock. Before the fix, the loop tripped 'over budget' the instant the
    // answer arrived and held the row, silently discarding the reply.
    let now = 1_000_000;
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    askHandler.mockImplementationOnce(async () => {
      now += 300_000; // 5 min of human think-time elapses inside the ask
      return { answered: true, answer: "treat it as net-new" };
    });
    anthropicMocks.create
      .mockResolvedValueOnce(toolUseResponse("ask_tej_on_slack", "t1", { question: "net-new?" }))
      .mockResolvedValueOnce(toolUseResponse("append_master_row", "t2"))
      .mockResolvedValueOnce(toolUseResponse("flip_staging_review_status", "t3"))
      .mockResolvedValueOnce(finalResponse("added", "Appended as net-new after Tej confirmed."));

    const result = await runRowAgent(row(), baseCtx as any);
    dateSpy.mockRestore();

    expect(result.outcome).toBe("added"); // would be "held" if the wait counted against budget
    expect(appendHandler).toHaveBeenCalledTimes(1);
    expect(result.askCalled).toBe(true);
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
