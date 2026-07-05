import { describe, expect, it } from "vitest";
import { AmbiguousOrgColumnError, mapCsvRows, parseCsvBuffer } from "../src/paths/csv";

describe("parseCsvBuffer", () => {
  it("splits headers and rows", () => {
    const buf = Buffer.from("Organization,2023,2024\nAcme Inc,TRUE,FALSE\n");
    const { headers, rows } = parseCsvBuffer(buf);
    expect(headers).toEqual(["Organization", "2023", "2024"]);
    expect(rows).toEqual([["Acme Inc", "TRUE", "FALSE"]]);
  });
});

describe("mapCsvRows — general shape (no year columns)", () => {
  it("maps a plain org list with no LLM-bypassing fields", () => {
    const headers = ["Company Name", "Website"];
    const rows = [["Acme Inc", "acme.com"], ["Beta Corp", "beta.com"]];
    const result = mapCsvRows(headers, rows);
    expect(result.shape).toBe("general");
    expect(result.items).toEqual([{ organization: "Acme Inc" }, { organization: "Beta Corp" }]);
  });

  it("throws AmbiguousOrgColumnError rather than guessing when no org-like column exists", () => {
    const headers = ["Foo", "Bar"];
    expect(() => mapCsvRows(headers, [["a", "b"]])).toThrow(AmbiguousOrgColumnError);
  });
});

describe("mapCsvRows — Viv shape (org + per-year boolean columns)", () => {
  const headers = ["Organization", "Notes", "2019", "2023", "2026"];

  it("builds warmLead from TRUE years and whyThemOverride citing them + the note", () => {
    const rows = [["Fasken", "VIK-only sponsor, no cash since", "TRUE", "FALSE", "TRUE"]];
    const result = mapCsvRows(headers, rows);
    expect(result.shape).toBe("viv");
    expect(result.items).toEqual([
      {
        organization: "Fasken",
        warmLead: "Past VSW sponsor: 2019, 2026",
        whyThemOverride: "Sponsored 2019, 2026 — VIK-only sponsor, no cash since.",
      },
    ]);
  });

  it("leaves warmLead blank and uses the note (or a fallback) when no year is TRUE", () => {
    const rows = [["Never Sponsored Co", "", "FALSE", "FALSE", "FALSE"]];
    const result = mapCsvRows(headers, rows);
    expect(result.items[0].warmLead).toBe("");
    expect(result.items[0].whyThemOverride).toBe("Listed in the sponsor history CSV; no confirmed sponsor year on file.");
  });

  it("prefixes known upgrade candidates with 'Upgrade candidate:'", () => {
    const rows = [["TransLink", "cash sponsor", "TRUE", "FALSE", "FALSE"]];
    const result = mapCsvRows(headers, rows);
    expect(result.items[0].whyThemOverride).toMatch(/^Upgrade candidate: /);
  });

  it("flags brief-named upgrade candidates missing from this specific CSV rather than guessing", () => {
    const rows = [["Fasken", "", "TRUE", "FALSE", "FALSE"]];
    const result = mapCsvRows(headers, rows);
    expect(result.missingUpgradeCandidates).toContain("PLT");
    expect(result.missingUpgradeCandidates).toContain("SweetWater");
    expect(result.missingUpgradeCandidates).not.toContain("Fasken"); // not even a real candidate name, sanity check
  });

  it("skips rows with a blank organization", () => {
    const rows = [["", "", "TRUE", "FALSE", "FALSE"], ["Real Org", "", "TRUE", "FALSE", "FALSE"]];
    const result = mapCsvRows(headers, rows);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].organization).toBe("Real Org");
  });
});
