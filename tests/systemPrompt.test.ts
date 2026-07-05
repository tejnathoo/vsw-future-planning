import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../src/promote/agent/systemPrompt";
import { CATEGORY_ENUM } from "../src/types";

describe("buildSystemPrompt — the rules live in context, not external branching code (PRD §11.2)", () => {
  const prompt = buildSystemPrompt();

  it("lists the full live Category enum so the model can't invent one", () => {
    for (const c of CATEGORY_ENUM) expect(prompt).toContain(c);
  });

  it("states the Contact rule (golden rule #2 — opportunistic, never a target)", () => {
    expect(prompt.toLowerCase()).toMatch(/contact/);
    expect(prompt.toLowerCase()).toMatch(/not your job to look for a contact/);
  });

  it("requires flip_staging_review_status only after a real write succeeded", () => {
    expect(prompt).toMatch(/only call flip_staging_review_status after/i);
  });

  it("instructs a strict JSON final answer with the expected outcome enum", () => {
    expect(prompt).toMatch(/"outcome"/);
    expect(prompt).toMatch(/"added" \| "merged" \| "held" \| "failed"/);
  });

  it("tells the model to research or ask rather than guess when unsure", () => {
    expect(prompt.toLowerCase()).toMatch(/ask_tej_on_slack/);
    expect(prompt.toLowerCase()).toMatch(/firecrawl/);
  });
});
