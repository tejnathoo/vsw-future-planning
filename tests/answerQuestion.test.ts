import { describe, expect, it, vi } from "vitest";

const anthropicMocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../src/anthropicClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/anthropicClient")>();
  return { ...actual, getAnthropicClient: () => ({ messages: { create: anthropicMocks.create } }) };
});

const snapshotHandler = vi.fn().mockResolvedValue({ count: 1, rows: [{ organization: "Acme" }] });
vi.mock("../src/chat/tools", () => ({
  CHAT_TOOLS: [
    { name: "read_master_snapshot", description: "d", input_schema: { type: "object", properties: {} }, handler: snapshotHandler },
  ],
}));

const { answerQuestion } = await import("../src/chat/answerQuestion");

function toolUseResponse(name: string, id: string, input: any = {}) {
  return { stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "tool_use", id, name, input }] };
}
function finalResponse(text: string) {
  return { stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "text", text }] };
}

describe("answerQuestion", () => {
  it("answers the easter egg without ever calling the model", async () => {
    const answer = await answerQuestion("will you be my friend");
    expect(answer).toBe("Yes :) already have you on my very short list.");
    expect(anthropicMocks.create).not.toHaveBeenCalled();
  });

  it("returns the model's direct text answer when no tool call is needed", async () => {
    anthropicMocks.create.mockResolvedValueOnce(finalResponse("This bot dedupes prospect leads into a Google Sheet."));
    const answer = await answerQuestion("what does this bot do?");
    expect(answer).toBe("This bot dedupes prospect leads into a Google Sheet.");
  });

  it("calls a read tool then returns the final answer", async () => {
    anthropicMocks.create
      .mockResolvedValueOnce(toolUseResponse("read_master_snapshot", "t1"))
      .mockResolvedValueOnce(finalResponse("There's 1 org in Master: Acme."));
    const answer = await answerQuestion("how many orgs are in master?");
    expect(snapshotHandler).toHaveBeenCalled();
    expect(answer).toBe("There's 1 org in Master: Acme.");
  });
});
