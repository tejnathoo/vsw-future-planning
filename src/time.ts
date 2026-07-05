const TZ = "America/Vancouver";

function vancouverParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Run ID = YYYYMMDD-HHmm-<source-slug>, America/Vancouver. */
export function runId(sourceSlug: string, now: Date = new Date()): string {
  const p = vancouverParts(now);
  const slug = sourceSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}-${slug}`;
}

/** Scraped At = ISO datetime, America/Vancouver (with explicit offset, not "Z"). */
export function scrapedAtNow(now: Date = new Date()): string {
  const p = vancouverParts(now);
  // Compute the Vancouver UTC offset for this instant (handles PST/PDT).
  const utcMillis = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour), Number(p.minute), Number(p.second)
  );
  const offsetMinutes = Math.round((utcMillis - now.getTime()) / 60000);
  const sign = offsetMinutes <= 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const offH = String(Math.floor(abs / 60)).padStart(2, "0");
  const offM = String(abs % 60).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${offH}:${offM}`;
}
