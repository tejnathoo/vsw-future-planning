import { describe, expect, it } from "vitest";
import { decideContactSlot } from "../src/contact/contactSlot";

const blank = {
  primaryName: "",
  primaryTitle: "",
  primaryEmail: "",
  primaryLinkedin: "",
  secondaryName: "",
  secondaryTitle: "",
  secondaryLinkedin: "",
  secondaryEmail: "",
};

describe("decideContactSlot", () => {
  it("assigns primary when N/O/P/Q are all blank", () => {
    expect(decideContactSlot(blank)).toBe("primary");
  });
  it("assigns secondary when primary is filled but the secondary block is blank", () => {
    expect(
      decideContactSlot({ ...blank, primaryName: "Jane Doe", primaryTitle: "VP Marketing" })
    ).toBe("secondary");
  });
  it("returns ambiguous when both primary and secondary are already filled", () => {
    expect(
      decideContactSlot({ ...blank, primaryName: "Jane Doe", secondaryName: "John Smith" })
    ).toBe("ambiguous");
  });
  it("treats a partially-filled primary (e.g. just an email) as taken", () => {
    expect(decideContactSlot({ ...blank, primaryEmail: "jane@aritzia.ca" })).toBe("secondary");
  });
  it("treats a partially-filled secondary (e.g. just a title, name still blank) as taken", () => {
    expect(
      decideContactSlot({ ...blank, primaryName: "Jane Doe", secondaryTitle: "Sales Lead" })
    ).toBe("ambiguous");
  });
});
