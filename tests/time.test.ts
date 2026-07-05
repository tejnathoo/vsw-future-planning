import { describe, expect, it } from "vitest";
import { runId, scrapedAtNow } from "../src/time";

describe("runId", () => {
  it("formats as YYYYMMDD-HHmm-<slug> in America/Vancouver", () => {
    // 2026-07-03T22:00:00Z -> Vancouver PDT (UTC-7) -> 2026-07-03 15:00
    const d = new Date("2026-07-03T22:00:00Z");
    expect(runId("Viv Sponsor CSV", d)).toBe("20260703-1500-viv-sponsor-csv");
  });
  it("slugifies punctuation and collapses separators", () => {
    const d = new Date("2026-07-03T22:00:00Z");
    expect(runId("Web Summit Vancouver — Exhibitors!!", d)).toBe("20260703-1500-web-summit-vancouver-exhibitors");
  });
});

describe("scrapedAtNow", () => {
  it("uses the -07:00 offset in July (PDT)", () => {
    const d = new Date("2026-07-03T22:00:00Z");
    expect(scrapedAtNow(d)).toBe("2026-07-03T15:00:00-07:00");
  });
  it("uses the -08:00 offset in January (PST)", () => {
    const d = new Date("2026-01-15T20:00:00Z");
    expect(scrapedAtNow(d)).toBe("2026-01-15T12:00:00-08:00");
  });
});
