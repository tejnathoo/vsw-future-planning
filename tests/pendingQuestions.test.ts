import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addPendingQuestion,
  findUnresolvedByThread,
  pollForAnswer,
  resolvePendingQuestion,
} from "../src/promote/agent/pendingQuestions";

describe("pendingQuestions — ask_tej_on_slack persistence (PRD §11.5)", () => {
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `pending-questions-test-${Date.now()}-${Math.random()}.json`);
    process.env.PENDING_QUESTIONS_PATH_OVERRIDE = tmpPath;
  });

  afterEach(() => {
    delete process.env.PENDING_QUESTIONS_PATH_OVERRIDE;
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  });

  it("persists a question immediately, findable by thread_ts before any answer", () => {
    const q = addPendingQuestion({
      id: "1",
      organization: "Startup TNT",
      stagingRowNumber: 746,
      channel: "C1",
      threadTs: "1000.1",
      question: "Is Startup TNT Summit a Comparable event sponsor?",
      askedAt: new Date().toISOString(),
    });
    expect(q.resolved).toBe(false);
    expect(findUnresolvedByThread("1000.1")?.organization).toBe("Startup TNT");
    expect(pollForAnswer("1")).toBeUndefined();
  });

  it("a resolved question is no longer returned as unresolved, and its answer is pollable", () => {
    addPendingQuestion({
      id: "2",
      organization: "BC Tech",
      stagingRowNumber: 796,
      channel: "C1",
      threadTs: "2000.1",
      question: "New Source Type ok?",
      askedAt: new Date().toISOString(),
    });
    resolvePendingQuestion("2", "yes, approve it");
    expect(findUnresolvedByThread("2000.1")).toBeUndefined();
    expect(pollForAnswer("2")).toBe("yes, approve it");
  });

  it("resolving an unknown id is a no-op, not a throw", () => {
    expect(() => resolvePendingQuestion("does-not-exist", "answer")).not.toThrow();
  });

  it("supports multiple independent pending threads at once", () => {
    addPendingQuestion({ id: "a", organization: "Org A", stagingRowNumber: 1, channel: "C1", threadTs: "t-a", question: "q", askedAt: new Date().toISOString() });
    addPendingQuestion({ id: "b", organization: "Org B", stagingRowNumber: 2, channel: "C1", threadTs: "t-b", question: "q", askedAt: new Date().toISOString() });
    resolvePendingQuestion("a", "answer a");
    expect(findUnresolvedByThread("t-a")).toBeUndefined();
    expect(findUnresolvedByThread("t-b")?.organization).toBe("Org B");
  });
});
