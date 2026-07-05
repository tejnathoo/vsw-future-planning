import { describe, expect, it } from "vitest";
import { appendWhyThemNote, decideDedup, domainOf, jaccard, ordinal, orgKey, sameOrg, splitSourceUrls } from "../src/dedup";
import type { MasterIndexEntry, StagingIndexEntry } from "../src/types";

describe("ordinal", () => {
  it.each([
    [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"],
    [11, "11th"], [12, "12th"], [13, "13th"], [21, "21st"], [22, "22nd"], [23, "23rd"], [101, "101st"],
  ])("%i -> %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe("appendWhyThemNote", () => {
  it("appends an ordinal + source label note to the existing Why Them text", () => {
    expect(appendWhyThemNote("Runs the top pitch competition.", 3, "VIATEC sponsor list")).toBe(
      "Runs the top pitch competition. (3rd: VIATEC sponsor list)"
    );
  });
});

describe("sameOrg — real pairs from the n8n Phase 6 build (must merge)", () => {
  it.each([
    ["Innovation Island", "Innovation Island, Nanaimo"],
    ["SFU VentureLabs", "SFU Venture Labs"],
    ["BC Accelerator Network (BCAN)", "BC Accelerator Network"],
    ["Accelerate Okanagan", "Accelerate Okanagan Technology Association"],
  ])("%s ~ %s", (a, b) => {
    expect(sameOrg(a, b)).toBe(true);
  });
});

describe("sameOrg — real pairs that must stay DISTINCT (no false merge)", () => {
  it.each([
    ["entrepreneurship@UBC", "Innovation UBC"],
    ["Foresight Canada", "Foresight Cleantech Accelerator"],
    ["UBC", "GrowthZone"],
    ["UBC", "University of British Columbia Okanagan"],
  ])("%s !~ %s", (a, b) => {
    expect(sameOrg(a, b)).toBe(false);
  });
});

describe("orgKey normalization", () => {
  it("strips legal suffixes, punctuation, and case", () => {
    expect(orgKey("KPMG Canada, Inc.")).toBe("kpmg canada");
    expect(orgKey("Fasken Martineau DuMoulin LLP")).toBe("fasken martineau dumoulin");
  });
  it("handles null/empty", () => {
    expect(orgKey(null)).toBe("");
    expect(orgKey(undefined)).toBe("");
  });
});

describe("domainOf", () => {
  it("extracts eTLD+1 and strips www", () => {
    expect(domainOf("https://www.viatec.ca/members")).toBe("viatec.ca");
    expect(domainOf("https://sub.example.co.uk/path")).toBe("co.uk"); // documented limitation: naive eTLD+1
  });
  it("returns empty for invalid/missing URLs", () => {
    expect(domainOf(null)).toBe("");
    expect(domainOf("not a url")).toBe("");
  });
});

describe("jaccard", () => {
  it("is 1.0 for identical token sets, 0 for disjoint", () => {
    expect(jaccard("bc tech", "bc tech")).toBe(1);
    expect(jaccard("bc tech", "totally different")).toBe(0);
  });
});

describe("splitSourceUrls — idempotency guard", () => {
  it("splits and trims pipe-joined cells", () => {
    expect(splitSourceUrls("https://a.com | https://b.com")).toEqual(["https://a.com", "https://b.com"]);
  });
  it("handles a single URL or empty", () => {
    expect(splitSourceUrls("https://a.com")).toEqual(["https://a.com"]);
    expect(splitSourceUrls("")).toEqual([]);
  });
});

describe("decideDedup — full algorithm against fresh indexes", () => {
  const staging: StagingIndexEntry[] = [
    { rowNumber: 5, organization: "New Ventures BC", orgKey: orgKey("New Ventures BC"), domain: "newventuresbc.com", sourceUrl: "https://newventuresbc.com/sponsors", whyThem: "Runs the province's top early-stage pitch competition.", timesSeen: 1 },
    { rowNumber: 9, organization: "KPMG Canada", orgKey: orgKey("KPMG Canada"), domain: "", sourceUrl: "https://example.com/kpmg", whyThem: "Big 4 firm active in the local startup scene.", timesSeen: 1 },
  ];
  const master: MasterIndexEntry[] = [
    { organization: "Fasken", orgKey: orgKey("Fasken") },
  ];

  it("merges on exact Staging name match (cross-source dedup proof: New Ventures BC)", () => {
    const outcome = decideDedup(
      { organization: "New Ventures BC", org_url: null },
      "https://viatec.ca/members",
      staging,
      master
    );
    expect(outcome).toEqual({ kind: "merge", rowNumber: 5, appendSourceUrl: true });
  });

  it("is idempotent — re-running the identical source URL does not re-append", () => {
    const outcome = decideDedup(
      { organization: "New Ventures BC", org_url: null },
      "https://newventuresbc.com/sponsors", // same URL already on the row
      staging,
      master
    );
    expect(outcome).toEqual({ kind: "merge", rowNumber: 5, appendSourceUrl: false });
  });

  it("merges on domain match even if the name differs", () => {
    const outcome = decideDedup(
      { organization: "New Ventures British Columbia", org_url: "https://www.newventuresbc.com/about" },
      "https://another-source.com/list",
      staging,
      master
    );
    expect(outcome).toEqual({ kind: "merge", rowNumber: 5, appendSourceUrl: true });
  });

  it("flags In Master for an org only found in Master", () => {
    const outcome = decideDedup(
      { organization: "Fasken", org_url: null },
      "https://example.com/newsource",
      staging,
      master
    );
    expect(outcome).toEqual({ kind: "new", duplicate: "In Master", matchedOrg: "Fasken" });
  });

  it("flags Review for a fuzzy/prefix match vs Staging", () => {
    const outcome = decideDedup(
      { organization: "KPMG Canada Advisory Services", org_url: null },
      "https://example.com/newsource2",
      staging,
      master
    );
    expect(outcome.kind).toBe("new");
    if (outcome.kind === "new") {
      expect(outcome.duplicate).toBe("Review");
      expect(outcome.matchedOrg).toBe("KPMG Canada");
    }
  });

  it("produces a clean new row for a genuinely distinct org", () => {
    const outcome = decideDedup(
      { organization: "Totally Unrelated Org", org_url: null },
      "https://example.com/newsource3",
      staging,
      master
    );
    expect(outcome).toEqual({ kind: "new", duplicate: "", matchedOrg: "" });
  });
});
