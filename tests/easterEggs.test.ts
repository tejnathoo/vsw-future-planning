import { describe, expect, it } from "vitest";
import { matchEasterEgg } from "../src/chat/easterEggs";

describe("matchEasterEgg", () => {
  it("answers 'will you be my friend'", () => {
    expect(matchEasterEgg("will you be my friend")).toBe("Yes :) already have you on my very short list.");
  });
  it("is case-insensitive and tolerates surrounding text", () => {
    expect(matchEasterEgg("hey bot, Will You Be My Friend?")).toBeTruthy();
  });
  it("returns undefined for unrelated text", () => {
    expect(matchEasterEgg("how many rows are in master")).toBeUndefined();
  });
});
