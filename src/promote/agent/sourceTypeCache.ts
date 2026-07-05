import * as fs from "fs";
import * as path from "path";

/**
 * Persistent Source (data-staging col F) -> Source Type (master-prospects col I)
 * mapping, committed to git (PLAN Stage 7A — not a secret, just decision memory).
 * Avoids re-classifying the same Source string on every run and keeps the answer
 * consistent across runs. Written to only after a real `append_master_row`
 * success (see tools.ts), never speculatively.
 */
/** Overridable for tests only — never set in production (see .env.example). */
function cachePath(): string {
  return process.env.SOURCE_TYPE_CACHE_PATH_OVERRIDE || path.join(__dirname, "..", "source-type-cache.json");
}

function readCacheFile(): Record<string, string> {
  try {
    const raw = fs.readFileSync(cachePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
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
