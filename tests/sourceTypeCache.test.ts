import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCachedSourceType, setCachedSourceType } from "../src/promote/agent/sourceTypeCache";

describe("sourceTypeCache — persistent Source -> Source Type memory (PLAN Stage 7A)", () => {
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `source-type-cache-test-${Date.now()}-${Math.random()}.json`);
    process.env.SOURCE_TYPE_CACHE_PATH_OVERRIDE = tmpPath;
  });

  afterEach(() => {
    delete process.env.SOURCE_TYPE_CACHE_PATH_OVERRIDE;
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  });

  it("returns undefined for a Source that's never been classified", () => {
    expect(getCachedSourceType("Some Totally New Source Nobody Has Seen")).toBeUndefined();
  });

  it("remembers a decision across calls, keyed on the exact Source string", () => {
    setCachedSourceType("A Brand New Sponsor List", "Comparable event sponsor");
    expect(getCachedSourceType("A Brand New Sponsor List")).toBe("Comparable event sponsor");
    expect(getCachedSourceType("a brand new sponsor list")).toBeUndefined(); // exact match, not case-folded
  });

  it("seeds from the committed default cache when the override path doesn't exist yet (fresh Railway Volume)", () => {
    // tmpPath is a throwaway path that's never been written to — same shape as
    // a brand-new Volume mount with no source-type-cache.json on it yet.
    expect(getCachedSourceType("Startup TNT Summit")).toBe("Comparable event sponsor");
  });

  it("ignores a blank Source rather than polluting the cache", () => {
    setCachedSourceType("", "Past VSW sponsor");
    setCachedSourceType("   ", "Past VSW sponsor");
    expect(fs.existsSync(tmpPath)).toBe(false);
    expect(getCachedSourceType("")).toBeUndefined();
  });

  it("tolerates a missing/corrupt file by treating it as an empty cache", () => {
    fs.writeFileSync(tmpPath, "{not valid json", "utf-8");
    expect(getCachedSourceType("anything")).toBeUndefined();
  });
});
