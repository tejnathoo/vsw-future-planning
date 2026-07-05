import type { DedupOutcome, MasterIndexEntry, StagingIndexEntry } from "./types";

// Verbatim port of the Phase 6-verified n8n dedup logic (AGENTS.md §Dedup).
// Do NOT tune the matcher without re-running an overlap test (two sources with
// known overlapping orgs -> confirm single row + Times Seen increments; known
// distinct orgs -> confirm no false merge).

const LEGAL =
  /\b(inc|incorporated|ltd|limited|llc|llp|corp|corporation|co|company|society|foundation|assn|association)\b/g;

export const orgKey = (n?: string | null): string =>
  (n || "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, " ")
    .replace(LEGAL, " ")
    .replace(/\s+/g, " ")
    .trim();

export const domainOf = (u?: string | null): string => {
  try {
    const h = new URL(u || "").hostname.replace(/^www\./, "");
    const p = h.split(".");
    return p.length > 2 ? p.slice(-2).join(".") : h;
  } catch {
    return "";
  }
};

const toks = (k: string): Set<string> => new Set(k.split(" ").filter(Boolean));

export const jaccard = (a: string, b: string): number => {
  const A = toks(a), B = toks(b);
  const i = [...A].filter((x) => B.has(x)).length;
  const u = new Set([...A, ...B]).size;
  return u ? i / u : 0;
};

const prefixMatch = (a: string, b: string): boolean =>
  !!a && !!b && (a.startsWith(b) || b.startsWith(a));

/**
 * Same-org variant tolerance (Phase 6): treat () as delimiters, drop a
 * trailing ", <location>", strip legal suffixes, then match on sorted-token
 * key OR tight-key OR a >=12-char prefix. Validated against real near-dupes
 * (Innovation Island / Innovation Island, Nanaimo; SFU VentureLabs / SFU
 * Venture Labs; BC Accelerator Network (BCAN) / BC Accelerator Network) and
 * genuinely-distinct pairs that must NOT merge (entrepreneurship@UBC vs
 * Innovation UBC; Foresight Canada vs Foresight Cleantech Accelerator; bare
 * UBC vs anything longer).
 */
export function sameOrg(a?: string | null, b?: string | null): boolean {
  const clean = (s?: string | null) => (s || "").replace(/\(([^)]*)\)/g, " $1 ").split(",")[0];
  const kA = orgKey(clean(a));
  const kB = orgKey(clean(b));
  const sortedTok = (k: string) => (toks(k).size ? [...toks(k)].sort().join(" ") : k);
  const tight = (k: string) => k.replace(/\s+/g, "");
  if (sortedTok(kA) === sortedTok(kB)) return true;
  if (tight(kA) === tight(kB)) return true;
  const tA = tight(kA), tB = tight(kB);
  if (tA.length >= 12 && tB.length >= 12 && (tA.startsWith(tB) || tB.startsWith(tA))) return true;
  return false;
}

/** Split a pipe-joined Source URL cell (col G) into trimmed parts. */
export function splitSourceUrls(cell: string): string[] {
  return (cell || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "1st" / "2nd" / "3rd" / "4th"... for the Why Them merge note (col I). */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Append a merge-source note to Why Them (AGENTS.md golden rule #4): "<original> (Nth: <source label>)". */
export function appendWhyThemNote(whyThem: string, timesSeen: number, sourceLabel: string): string {
  return `${whyThem} (${ordinal(timesSeen)}: ${sourceLabel})`;
}

/**
 * Decide the dedup outcome for one candidate item against the fresh Staging
 * + Master indexes (both read once per mention/run — see AGENTS.md golden
 * rule #7). Does NOT mutate anything; callers apply the outcome.
 *
 * Algorithm (D9-D11 / Build Spec §7):
 *   1. Exact Staging match (Domain first, else sameOrg) -> merge candidate.
 *      Idempotency guard: if the Source URL is already present, the caller
 *      must skip the append + Times Seen increment (kind stays "merge" with
 *      appendSourceUrl=false so the caller can no-op cleanly).
 *   2. Exact Master match (Org Key only, Master has no Domain col) -> new
 *      row, Duplicate = "In Master".
 *   3. Fuzzy (Jaccard >= 0.8 OR prefix) vs Staging -> new row, Duplicate =
 *      "Review".
 *   4. Else -> clean new row.
 */
export function decideDedup(
  item: { organization: string; org_url?: string | null },
  sourceUrl: string,
  stagingIndex: StagingIndexEntry[],
  masterIndex: MasterIndexEntry[]
): DedupOutcome {
  const key = orgKey(item.organization);
  const domain = domainOf(item.org_url);

  // Step 1: exact Staging match — domain first, else variant-tolerant name match.
  const stagingMatch =
    (domain && stagingIndex.find((s) => s.domain && s.domain === domain)) ||
    stagingIndex.find((s) => sameOrg(s.organization, item.organization));

  if (stagingMatch) {
    const already = splitSourceUrls(stagingMatch.sourceUrl).includes(sourceUrl);
    return { kind: "merge", rowNumber: stagingMatch.rowNumber, appendSourceUrl: !already };
  }

  // Step 2: exact Master match (Org Key only).
  const masterMatch = masterIndex.find((m) => m.orgKey === key);
  if (masterMatch) {
    return { kind: "new", duplicate: "In Master", matchedOrg: masterMatch.organization };
  }

  // Step 3: fuzzy match vs Staging (Jaccard >= 0.8 or prefix).
  const fuzzyMatch = stagingIndex.find((s) => {
    const sKey = orgKey(s.organization);
    return jaccard(sKey, key) >= 0.8 || prefixMatch(sKey, key);
  });
  if (fuzzyMatch) {
    return { kind: "new", duplicate: "Review", matchedOrg: fuzzyMatch.organization };
  }

  // Step 4: clean new row.
  return { kind: "new", duplicate: "", matchedOrg: "" };
}
