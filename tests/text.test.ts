import { describe, expect, it } from "vitest";
import { postCheckOrgs } from "../src/paths/text";

describe("postCheckOrgs — D12 anti-hallucination substring check", () => {
  const sourceText = "Our sponsors include KPMG Canada and Fasken Martineau. Thanks to VIATEC for hosting.";

  it("keeps orgs that are genuinely present (case-insensitive)", () => {
    const result = postCheckOrgs(
      [
        { organization: "KPMG Canada" },
        { organization: "viatec" }, // different casing than source
      ],
      sourceText
    );
    expect(result.items).toHaveLength(2);
    expect(result.dropped).toBe(0);
  });

  it("drops a fabricated org not present in the text and counts it", () => {
    const result = postCheckOrgs(
      [{ organization: "KPMG Canada" }, { organization: "Totally Invented Sponsor Inc" }],
      sourceText
    );
    expect(result.items).toEqual([{ organization: "KPMG Canada" }]);
    expect(result.dropped).toBe(1);
  });

  it("drops an item with no organization field", () => {
    const result = postCheckOrgs([{ organization: "" }], sourceText);
    expect(result.items).toHaveLength(0);
    expect(result.dropped).toBe(1);
  });
});
