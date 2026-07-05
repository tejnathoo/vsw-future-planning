import { getAnthropicClient } from "../anthropicClient";
import { matchEasterEgg } from "./easterEggs";
import { buildChatSystemPrompt } from "./systemPrompt";
import { CHAT_TOOLS } from "./tools";

const MAX_TOOL_CALLS = 4;
const WALL_CLOCK_BUDGET_MS = 30_000;

/**
 * Answers one plain-chat mention (PRD §12). Checks the easter eggs first
 * (free, instant, no model call), then runs a small bounded read-only tool
 * loop — same shape as the Promotion Agent's loop but far smaller, since this
 * one never writes anything and only needs to look things up to answer a
 * question.
 */
export async function answerQuestion(text: string): Promise<string> {
  const egg = matchEasterEgg(text);
  if (egg) return egg;

  const anthropic = getAnthropicClient();
  const model = process.env.CHAT_AGENT_MODEL || "claude-sonnet-5";
  const anthropicTools = CHAT_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  const messages: any[] = [{ role: "user", content: text }];

  const startedAt = Date.now();
  let toolCallCount = 0;

  for (let iteration = 0; iteration < MAX_TOOL_CALLS + 1; iteration++) {
    if (Date.now() - startedAt > WALL_CLOCK_BUDGET_MS) {
      return "That's taking longer than it should to look up — try asking again in a moment.";
    }

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: buildChatSystemPrompt(),
      tools: anthropicTools,
      messages,
    });

    const toolUses = response.content.filter((b: any) => b.type === "tool_use");
    const textBlocks = response.content.filter((b: any) => b.type === "text");

    if (toolUses.length === 0 || toolCallCount >= MAX_TOOL_CALLS) {
      const answer = textBlocks.map((b: any) => b.text).join("\n").trim();
      return answer || "Not sure how to answer that one.";
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: any[] = [];
    for (const toolUse of toolUses as any[]) {
      toolCallCount++;
      const tool = CHAT_TOOLS.find((t) => t.name === toolUse.name);
      let result: unknown;
      try {
        result = tool ? await tool.handler(toolUse.input) : { error: `unknown tool ${toolUse.name}` };
      } catch (e: any) {
        result = { error: e.message };
      }
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "Not sure how to answer that one.";
}
