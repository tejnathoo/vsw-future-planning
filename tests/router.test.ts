import { describe, expect, it } from "vitest";
import { detectRoute } from "../src/router";

describe("detectRoute — files take priority over text", () => {
  it("routes a CSV by filetype", () => {
    const r = detectRoute({ text: "here's the sheet", files: [{ name: "sponsors.csv", filetype: "csv" }] });
    expect(r.kind).toBe("csv");
  });
  it("routes a CSV by mimetype when filetype is missing", () => {
    const r = detectRoute({ text: "", files: [{ name: "data", mimetype: "text/csv" }] });
    expect(r.kind).toBe("csv");
  });
  it("routes a PDF", () => {
    const r = detectRoute({ text: "", files: [{ name: "deck.pdf", filetype: "pdf" }] });
    expect(r.kind).toBe("pdf");
  });
  it("routes an image by mimetype prefix", () => {
    const r = detectRoute({ text: "", files: [{ name: "logos.png", mimetype: "image/png" }] });
    expect(r.kind).toBe("image");
  });
  it("routes markdown and plain text files", () => {
    expect(detectRoute({ text: "", files: [{ name: "orgs.md", filetype: "markdown" }] }).kind).toBe("text");
    expect(detectRoute({ text: "", files: [{ name: "orgs.txt", filetype: "text" }] }).kind).toBe("text");
  });
  it("flags an unrecognized file type instead of guessing", () => {
    const r = detectRoute({ text: "", files: [{ name: "archive.zip", mimetype: "application/zip" }] });
    expect(r.kind).toBe("unsupported_file");
  });
  it("ignores a URL in the text if a file is also attached", () => {
    const r = detectRoute({ text: "see https://example.com too", files: [{ name: "sponsors.csv", filetype: "csv" }] });
    expect(r.kind).toBe("csv");
  });
});

describe("detectRoute — URL forwarding", () => {
  it("extracts a single URL from plain text", () => {
    const r = detectRoute({ text: "check out https://example.com/sponsors please", files: [] });
    expect(r).toEqual({ kind: "url", urls: ["https://example.com/sponsors"] });
  });
  it("extracts multiple URLs", () => {
    const r = detectRoute({ text: "https://a.com and https://b.com", files: [] });
    expect(r).toEqual({ kind: "url", urls: ["https://a.com", "https://b.com"] });
  });
  it("strips Slack's <url|label> link wrapper", () => {
    const r = detectRoute({ text: "see <https://example.com/page|this page>", files: [] });
    expect(r).toEqual({ kind: "url", urls: ["https://example.com/page"] });
  });
  it("strips Slack's bare <url> wrapper", () => {
    const r = detectRoute({ text: "see <https://example.com/page>", files: [] });
    expect(r).toEqual({ kind: "url", urls: ["https://example.com/page"] });
  });
});

describe("detectRoute — promote command (PRD §10.2)", () => {
  it("routes a bare 'promote' mention", () => {
    expect(detectRoute({ text: "promote", files: [] })).toEqual({ kind: "promote" });
  });
  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(detectRoute({ text: "  PROMOTE  ", files: [] })).toEqual({ kind: "promote" });
  });
  it("routes when the message starts with 'promote '", () => {
    expect(detectRoute({ text: "promote now please", files: [] })).toEqual({ kind: "promote" });
  });
  it("does not treat a word merely containing 'promote' as the command", () => {
    expect(detectRoute({ text: "promoted these already", files: [] })).toEqual({
      kind: "chat",
      text: "promoted these already",
    });
  });
  it("prefers an attached file over the promote command", () => {
    const r = detectRoute({ text: "promote", files: [{ name: "sponsors.csv", filetype: "csv" }] });
    expect(r.kind).toBe("csv");
  });
});

describe("detectRoute — approve command (PRD §11.4, gated dropdown-add)", () => {
  it("routes 'approve <value>' with the value's original casing preserved", () => {
    expect(detectRoute({ text: "approve BC ecosystem directory", files: [] })).toEqual({
      kind: "approve",
      value: "BC ecosystem directory",
    });
  });
  it("is case-insensitive on the command keyword only", () => {
    expect(detectRoute({ text: "APPROVE Comparable event sponsor", files: [] })).toEqual({
      kind: "approve",
      value: "Comparable event sponsor",
    });
  });
  it("trims surrounding whitespace from the value", () => {
    expect(detectRoute({ text: "approve   Past VSW sponsor   ", files: [] })).toEqual({
      kind: "approve",
      value: "Past VSW sponsor",
    });
  });
  it("does not treat a word merely containing 'approve' as the command", () => {
    expect(detectRoute({ text: "approved these already", files: [] }).kind).not.toBe("approve");
  });
  it("prefers an attached file over the approve command", () => {
    const r = detectRoute({ text: "approve Foo", files: [{ name: "sponsors.csv", filetype: "csv" }] });
    expect(r.kind).toBe("csv");
  });
});

describe("detectRoute — chat (PRD §12, conversational Q&A)", () => {
  it("routes plain text with no URL and no file to chat", () => {
    expect(detectRoute({ text: "hey what's up", files: [] })).toEqual({
      kind: "chat",
      text: "hey what's up",
    });
  });
  it("preserves original casing/whitespace of the chat text", () => {
    expect(detectRoute({ text: "  How many rows are In Master right now?  ", files: [] })).toEqual({
      kind: "chat",
      text: "How many rows are In Master right now?",
    });
  });
});

describe("detectRoute — nothing to do", () => {
  it("returns none for an empty mention", () => {
    expect(detectRoute({ text: "", files: [] })).toEqual({ kind: "none" });
  });
  it("returns none for a mention with only whitespace", () => {
    expect(detectRoute({ text: "   ", files: [] })).toEqual({ kind: "none" });
  });
});
