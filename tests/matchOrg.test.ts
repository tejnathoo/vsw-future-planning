import { describe, expect, it, vi } from "vitest";
import { matchMasterOrg } from "../src/contact/matchOrg";
import type { MasterPromotionEntry } from "../src/types";

function entry(organization: string, rowNumber: number): MasterPromotionEntry {
  return { rowNumber, organization, orgKey: organization.toLowerCase(), whyThem: "", sourceLink: "" };
}

describe("matchMasterOrg — deterministic pass (sameOrg, no LLM call needed)", () => {
  it("matches an exact name without calling the LLM fallback", async () => {
    const llmFallback = vi.fn();
    const result = await matchMasterOrg("Aritzia", [entry("Aritzia", 10), entry("Lululemon", 11)], llmFallback);
    expect(result).toEqual({ status: "matched", rowNumber: 10, organization: "Aritzia" });
    expect(llmFallback).not.toHaveBeenCalled();
  });

  it("matches a known same-org variant (legal suffix / casing) deterministically", async () => {
    const llmFallback = vi.fn();
    const result = await matchMasterOrg("BC Accelerator Network (BCAN)", [entry("BC Accelerator Network", 5)], llmFallback);
    expect(result).toEqual({ status: "matched", rowNumber: 5, organization: "BC Accelerator Network" });
    expect(llmFallback).not.toHaveBeenCalled();
  });

  it("does NOT merge genuinely-distinct known-pitfall orgs (bare UBC vs a longer UBC name)", async () => {
    const llmFallback = vi.fn().mockResolvedValue(null);
    const result = await matchMasterOrg("UBC", [entry("entrepreneurship@UBC", 7)], llmFallback);
    expect(result).toEqual({ status: "none" });
  });

  it("falls back to the LLM matcher only when no deterministic match exists", async () => {
    const llmFallback = vi.fn().mockResolvedValue("Aritzia Inc.");
    const result = await matchMasterOrg("Pacific Can", [entry("Aritzia Inc.", 20)], llmFallback);
    expect(llmFallback).toHaveBeenCalledWith("Pacific Can", ["Aritzia Inc."]);
    expect(result).toEqual({ status: "matched", rowNumber: 20, organization: "Aritzia Inc." });
  });

  it("returns none when the LLM fallback also can't confidently resolve it", async () => {
    const llmFallback = vi.fn().mockResolvedValue(null);
    const result = await matchMasterOrg("Some Unknown Co", [entry("Aritzia", 1)], llmFallback);
    expect(result).toEqual({ status: "none" });
  });

  it("returns ambiguous when the guess collides with two distinct rows via sameOrg's legal-suffix stripping", async () => {
    const llmFallback = vi.fn();
    // "Inc"/"Society" are stripped by orgKey, so both rows tight-match "foresightcanada".
    const result = await matchMasterOrg("Foresight Canada", [entry("Foresight Canada Inc", 1), entry("Foresight Canada Society", 2)], llmFallback);
    expect(result).toEqual({ status: "ambiguous", candidates: ["Foresight Canada Inc", "Foresight Canada Society"] });
    expect(llmFallback).not.toHaveBeenCalled();
  });
});
