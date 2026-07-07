import * as fs from "fs";
import * as path from "path";

/**
 * A single held `ask_tej_on_slack` question (PRD §11.5). Persisted immediately
 * on creation — NOT just held in memory — so a reply arriving after the run's
 * own 5-minute wait has ended can still resume the right row via the `message`
 * event listener (index.ts), regardless of how much time has passed.
 */
export interface PendingQuestion {
  id: string;
  organization: string;
  stagingRowNumber: number;
  channel: string;
  threadTs: string;
  question: string;
  askedAt: string;
  resolved: boolean;
  answer?: string;
  answeredAt?: string;
}

/** Overridable for tests only — never set in production (see .env.example). */
function storePath(): string {
  return process.env.PENDING_QUESTIONS_PATH_OVERRIDE || path.join(__dirname, "..", "..", "..", "state", "pending-questions.json");
}

function readStore(): PendingQuestion[] {
  try {
    const raw = fs.readFileSync(storePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeStore(list: PendingQuestion[]): void {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(list, null, 2) + "\n", "utf-8");
}

export function addPendingQuestion(q: Omit<PendingQuestion, "resolved">): PendingQuestion {
  const list = readStore();
  const full: PendingQuestion = { ...q, resolved: false };
  list.push(full);
  writeStore(list);
  return full;
}

/** Used by the `message` event listener to match a reply to the item it resumes. */
export function findUnresolvedByThread(threadTs: string): PendingQuestion | undefined {
  return readStore().find((q) => q.threadTs === threadTs && !q.resolved);
}

export function findById(id: string): PendingQuestion | undefined {
  return readStore().find((q) => q.id === id);
}

export function resolvePendingQuestion(id: string, answer: string): void {
  const list = readStore();
  const q = list.find((x) => x.id === id);
  if (!q) return;
  q.resolved = true;
  q.answer = answer;
  q.answeredAt = new Date().toISOString();
  writeStore(list);
}

/** Polled by `ask_tej_on_slack` during its own synchronous wait window (§11.5 step 2). */
export function pollForAnswer(id: string): string | undefined {
  return findById(id)?.answer;
}

/**
 * In-memory set of questions whose `ask_tej_on_slack` call is *right now* still
 * blocking inside a live run, waiting on a reply (added 2026-07-06). This is
 * deliberately in-process, not persisted: it exists only to stop the SAME reply
 * from being handled twice — once by the in-run poll that's already waiting, and
 * once by index.ts's out-of-thread `message`/`app_mention` resume listener. The
 * bot runs as a single Socket-Mode worker, so both live in this one process. If
 * an ask is still active, the in-run loop owns the reply (its poll will pick up
 * the stored answer); the listener only resumes rows whose run already moved on.
 * A process restart correctly clears this — any then-in-flight run is gone too.
 */
const activeAsks = new Set<string>();
export function markAskActive(id: string): void {
  activeAsks.add(id);
}
export function markAskInactive(id: string): void {
  activeAsks.delete(id);
}
export function isAskActive(id: string): boolean {
  return activeAsks.has(id);
}
