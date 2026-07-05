import { describe, expect, it } from "vitest";
import { chunkText } from "../src/paths/text";

describe("chunkText", () => {
  it("returns a single chunk when the text fits within the limit", () => {
    const text = "short paragraph one.\n\nshort paragraph two.";
    expect(chunkText(text, 1000)).toEqual([text]);
  });

  it("splits on paragraph boundaries when the text exceeds the limit", () => {
    const p1 = "a".repeat(50);
    const p2 = "b".repeat(50);
    const chunks = chunkText(`${p1}\n\n${p2}`, 60);
    expect(chunks).toEqual([p1, p2]);
  });

  it("groups multiple small paragraphs into one chunk up to the limit", () => {
    const chunks = chunkText("one\n\ntwo\n\nthree", 100);
    expect(chunks).toEqual(["one\n\ntwo\n\nthree"]);
  });

  it("hard-splits a single paragraph that alone exceeds the limit", () => {
    const huge = "x".repeat(250);
    const chunks = chunkText(huge, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toBe(huge);
  });

  it("never drops any content across chunks", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Paragraph ${i} about Org${i} Inc.`).join("\n\n");
    const chunks = chunkText(text, 80);
    expect(chunks.join("\n\n")).toContain("Org19 Inc");
    expect(chunks.every((c) => c.length <= 80 || !c.includes("\n\n"))).toBe(true);
  });
});
