import { describe, expect, it } from "vitest";
import { coerceBoolean } from "../src/sheets";
import { MASTER_FIELD_KEYS } from "../src/types";

describe("coerceBoolean (Warm Lead? checkbox coercion)", () => {
  it.each(["true", "TRUE", "y", "Y", "yes", "Yes", "warm"])("%s -> true", (v) => {
    expect(coerceBoolean(v)).toBe(true);
  });
  it.each(["false", "FALSE", "n", "no", "", "not warm", "unknown"])("%s -> false", (v) => {
    expect(coerceBoolean(v)).toBe(false);
  });
  it("treats 'make this a warm pathway' style phrasing correctly once reduced to 'warm'", () => {
    // The model is expected to normalize free text like "make this a warm
    // pathway" down to a coercible value ("warm"/"true") before this runs —
    // this just locks in that the coercion itself accepts that reduced form.
    expect(coerceBoolean("warm")).toBe(true);
  });
});

describe("MASTER_FIELD_KEYS", () => {
  it("does not include contact-block or append-only fields (those go through separate flows)", () => {
    const excluded = ["primaryName", "primaryTitle", "primaryEmail", "primaryLinkedin", "secondaryName", "secondaryTitle", "secondaryLinkedin", "secondaryEmail", "genericIntakeEmail", "whyThem", "notes"];
    for (const key of excluded) {
      expect(MASTER_FIELD_KEYS).not.toContain(key);
    }
  });
  it("includes warmLead, the field this feature was extended to support", () => {
    expect(MASTER_FIELD_KEYS).toContain("warmLead");
  });
});
