import { describe, expect, it } from "vitest";
import { deriveSourceType, mapStagingToMaster } from "../src/promote/mapper";
import type { StagingApprovedRow } from "../src/types";

function approvedRow(overrides: Partial<StagingApprovedRow> = {}): StagingApprovedRow {
  return {
    rowNumber: 5,
    organization: "Acme Corp",
    orgKey: "acme",
    domain: "acme.com",
    category: "Tech",
    sector: "SaaS",
    source: "Viv sponsor CSV",
    sourceUrl: "internal://viv-sponsor-csv",
    tier: "1",
    whyThem: "Sponsored 2019, 2023.",
    warmLead: "Past VSW sponsor: 2019, 2023",
    duplicate: "",
    matchedOrg: "",
    timesSeen: "2",
    runId: "20260704-1200-slack-csv",
    scrapedAt: "2026-07-04T12:00:00-07:00",
    extractor: "CSV import",
    reviewStatus: "Approved",
    ...overrides,
  };
}

describe("deriveSourceType — the 4 confirmed live values (PRD §10.6 Q3)", () => {
  it("maps Viv/past-sponsor sources to Past VSW sponsor", () => {
    expect(deriveSourceType("Viv sponsor CSV")).toBe("Past VSW sponsor");
    expect(deriveSourceType("Past VSW sponsor list")).toBe("Past VSW sponsor");
  });
  it("maps speaker/partner sources to Past VSW event partner", () => {
    expect(deriveSourceType("2024 speaker roster")).toBe("Past VSW event partner");
    expect(deriveSourceType("VSW event partner sheet")).toBe("Past VSW event partner");
  });
  it("maps comparable-event sources to Comparable event sponsor", () => {
    expect(deriveSourceType("Comparable event sponsor grid")).toBe("Comparable event sponsor");
  });
  it("maps BC ecosystem directories to BC ecosystem directory", () => {
    expect(deriveSourceType("BC Tech directory")).toBe("BC ecosystem directory");
    expect(deriveSourceType("New Ventures BC list")).toBe("BC ecosystem directory");
    expect(deriveSourceType("Innovate BC members")).toBe("BC ecosystem directory");
  });
  it("throws (does not guess) on an unrecognized Source", () => {
    expect(() => deriveSourceType("Some brand new source")).toThrow(/unrecognized Source/);
    expect(() => deriveSourceType("Some brand new source")).toThrow(/Some brand new source/);
  });
});

describe("mapStagingToMaster — PRD §10.5 column mapping", () => {
  it("maps the populated columns and leaves the rest to the appender's blanks", () => {
    const m = mapStagingToMaster(approvedRow());
    expect(m.organizationName).toBe("Acme Corp");
    expect(m.category).toBe("Tech");
    expect(m.subsector).toBe("SaaS");
    expect(m.whyThem).toBe("Sponsored 2019, 2023.");
    expect(m.sourceType).toBe("Past VSW sponsor");
    expect(m.sourceLink).toBe("internal://viv-sponsor-csv");
  });

  it("Warm Lead? = Y when Warm Lead is non-empty, Unknown otherwise (never N)", () => {
    expect(mapStagingToMaster(approvedRow({ warmLead: "Past sponsor 2019" })).warmLead).toBe("Y");
    expect(mapStagingToMaster(approvedRow({ warmLead: "" })).warmLead).toBe("Unknown");
    expect(mapStagingToMaster(approvedRow({ warmLead: "   " })).warmLead).toBe("Unknown");
  });

  it("copies Warm Lead free-text into Warm Lead Path", () => {
    expect(mapStagingToMaster(approvedRow({ warmLead: "Knows the CEO" })).warmLeadPath).toBe("Knows the CEO");
  });

  it("builds the traceability Notes line", () => {
    const m = mapStagingToMaster(approvedRow());
    expect(m.notes).toBe(
      "Promoted from data-staging · Tier 1 · CSV import · Run 20260704-1200-slack-csv · 2026-07-04T12:00:00-07:00"
    );
  });

  it("throws through when the Source is unmapped (same posture as the Category validator)", () => {
    expect(() => mapStagingToMaster(approvedRow({ source: "mystery source" }))).toThrow(/unrecognized Source/);
  });
});
