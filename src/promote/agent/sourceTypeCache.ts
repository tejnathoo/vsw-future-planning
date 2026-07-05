import * as fs from "fs";
import * as path from "path";

/**
 * Persistent Source (data-staging col F) -> Source Type (master-prospects col I)
 * mapping, committed to git (PLAN Stage 7A — not a secret, just decision memory).
 * Avoids re-classifying the same Source string on every run and keeps the answer
 * consistent across runs. Written to only after a real `append_master_row`
 * success (see tools.ts), never speculatively.
 */
/**
 * Default path — resolved via the project root, not `__dirname`-relative,
 * because this file lives under `src/` as committed data, not build output —
 * a plain `__dirname`-relative path (as `pendingQuestions.ts`'s state dir
 * uses) would point at `dist/promote/source-type-cache.json` once this runs
 * from a `tsc` build (Railway), which `tsc` never creates (it only compiles
 * `.ts` files), silently losing every cached decision on deploy.
 */
function defaultCachePath(): string {
  return path.join(__dirname, "..", "..", "..", "src", "promote", "source-type-cache.json");
}

/**
 * `SOURCE_TYPE_CACHE_PATH_OVERRIDE` is used by tests (a throwaway tmp path)
 * AND in production on Railway, pointed at a mounted Volume (e.g.
 * `/data/source-type-cache.json`) so learned decisions survive redeploys —
 * Railway's own filesystem is otherwise wiped on every deploy/restart.
 */
function cachePath(): string {
  return process.env.SOURCE_TYPE_CACHE_PATH_OVERRIDE || defaultCachePath();
}

function readCacheFile(): Record<string, string> {
  const override = process.env.SOURCE_TYPE_CACHE_PATH_OVERRIDE;
  try {
    const raw = fs.readFileSync(cachePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    // A fresh Volume mount has no file yet — seed from the committed default
    // (e.g. the real learned "Startup TNT Summit" entry) instead of starting
    // from a blank cache and losing it.
    if (override) {
      try {
        return JSON.parse(fs.readFileSync(defaultCachePath(), "utf-8"));
      } catch {
        return {};
      }
    }
    return {};
  }
}

function writeCacheFile(cache: Record<string, string>): void {
  fs.writeFileSync(cachePath(), JSON.stringify(cache, null, 2) + "\n", "utf-8");
}

export function getCachedSourceType(source: string): string | undefined {
  const key = (source || "").trim();
  if (!key) return undefined;
  return readCacheFile()[key];
}

export function setCachedSourceType(source: string, sourceType: string): void {
  const key = (source || "").trim();
  if (!key) return;
  const cache = readCacheFile();
  cache[key] = sourceType;
  writeCacheFile(cache);
}
