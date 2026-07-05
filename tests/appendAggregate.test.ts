import { describe, expect, it } from "vitest";
import { appendAggregate } from "../src/sheets";

describe("appendAggregate — idempotent pipe-joined append (PRD §10.4 step 5)", () => {
  it("appends onto a non-empty cell with ' | '", () => {
    expect(appendAggregate("Old reason", "New reason")).toBe("Old reason | New reason");
  });

  it("returns the addition alone when the cell is empty", () => {
    expect(appendAggregate("", "New reason")).toBe("New reason");
  });

  it("is a no-op when the value is already present (exact member of the pipe-split list)", () => {
    expect(appendAggregate("A | B | C", "B")).toBe("A | B | C");
  });

  it("trims parts before the membership check", () => {
    expect(appendAggregate("A |  B  | C", "B")).toBe("A |  B  | C");
  });

  it("trims the addition before comparing and appending", () => {
    expect(appendAggregate("A | B", "  B  ")).toBe("A | B");
    expect(appendAggregate("A", "  C  ")).toBe("A | C");
  });

  it("returns the existing cell unchanged when the addition is blank", () => {
    expect(appendAggregate("A | B", "")).toBe("A | B");
    expect(appendAggregate("A | B", "   ")).toBe("A | B");
  });

  it("does not partial-match a substring (only whole pipe-parts count as present)", () => {
    expect(appendAggregate("Acme Corporation", "Acme")).toBe("Acme Corporation | Acme");
  });
});
