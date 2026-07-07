import { describe, expect, it, vi, beforeEach } from "vitest";

const sheetsMocks = vi.hoisted(() => ({
  readMasterPromotionIndex: vi.fn(),
  readSourceTypeDropdown: vi.fn(),
  readMasterRowAggregateFields: vi.fn(),
  appendMasterRow: vi.fn(),
  updateMasterAggregateRow: vi.fn(),
  markStagingMergedToMaster: vi.fn(),
  nextMasterRowNumber: vi.fn(),
}));

vi.mock("../src/sheets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/sheets")>();
  return {
    ...actual, // keep the real, pure appendAggregate
    readMasterPromotionIndex: sheetsMocks.readMasterPromotionIndex,
    readSourceTypeDropdown: sheetsMocks.readSourceTypeDropdown,
    readMasterRowAggregateFields: sheetsMocks.readMasterRowAggregateFields,
    appendMasterRow: sheetsMocks.appendMasterRow,
    updateMasterAggregateRow: sheetsMocks.updateMasterAggregateRow,
    markStagingMergedToMaster: sheetsMocks.markStagingMergedToMaster,
    nextMasterRowNumber: sheetsMocks.nextMasterRowNumber,
  };
});

const firecrawlMocks = vi.hoisted(() => ({ firecrawlSearch: vi.fn(), firecrawlScrape: vi.fn() }));
vi.mock("../src/promote/agent/firecrawlClient", () => firecrawlMocks);

const cacheMocks = vi.hoisted(() => ({ getCachedSourceType: vi.fn(), setCachedSourceType: vi.fn() }));
vi.mock("../src/promote/agent/sourceTypeCache", () => cacheMocks);

const pendingMocks = vi.hoisted(() => ({ addPendingQuestion: vi.fn(), pollForAnswer: vi.fn(), markAskActive: vi.fn(), markAskInactive: vi.fn() }));
vi.mock("../src/promote/agent/pendingQuestions", () => pendingMocks);

const { TOOLS } = await import("../src/promote/agent/tools");

function tool(name: string) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
}

function baseCtx(overrides: Partial<any> = {}) {
  return {
    organization: "Acme Corp",
    stagingRowNumber: 66,
    channel: "C1",
    threadTs: "1000.1",
    slackClient: { chat: { postMessage: vi.fn().mockResolvedValue({}) } },
    usage: { firecrawlCalls: 0 },
    askTimeoutMs: 200,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("no tool ever accepts a Contact-shaped field (AGENTS.md golden rule #2)", () => {
  it("has no input_schema property whose name looks like a contact field", () => {
    const forbidden = /contact|email|linkedin|title|phone/i;
    for (const t of TOOLS) {
      for (const prop of Object.keys(t.input_schema.properties)) {
        expect(prop, `${t.name}.${prop}`).not.toMatch(forbidden);
      }
    }
  });
});

describe("append_master_row — enum validation before any write (golden rule #15)", () => {
  it("rejects an invalid Category without ever touching Sheets", async () => {
    await expect(
      tool("append_master_row").handler(
        { organizationName: "Acme", category: "Not A Real Category", subsector: "SaaS", whyThem: "x", sourceType: "Past VSW sponsor", sourceLink: "x", warmLead: "Y", warmLeadPath: "x", notes: "x" },
        baseCtx()
      )
    ).rejects.toThrow(/not a valid Category/);
    expect(sheetsMocks.appendMasterRow).not.toHaveBeenCalled();
  });

  it("rejects a Source Type that isn't live in the dropdown yet", async () => {
    sheetsMocks.readSourceTypeDropdown.mockResolvedValue(["Past VSW sponsor", "Past VSW event partner", "Comparable event sponsor"]);
    await expect(
      tool("append_master_row").handler(
        { organizationName: "Acme", category: "Tech", subsector: "SaaS", whyThem: "x", sourceType: "BC ecosystem directory", sourceLink: "x", warmLead: "Y", warmLeadPath: "x", notes: "x" },
        baseCtx()
      )
    ).rejects.toThrow(/not yet a live Source Type/);
    expect(sheetsMocks.appendMasterRow).not.toHaveBeenCalled();
  });

  it("writes at the freshly-computed next row and caches the Source Type decision", async () => {
    sheetsMocks.readSourceTypeDropdown.mockResolvedValue(["Past VSW sponsor"]);
    sheetsMocks.readMasterPromotionIndex.mockResolvedValue([{ rowNumber: 176, organization: "X", orgKey: "x", whyThem: "", sourceLink: "" }]);
    sheetsMocks.nextMasterRowNumber.mockReturnValue(177);
    sheetsMocks.appendMasterRow.mockResolvedValue(undefined);

    const result: any = await tool("append_master_row").handler(
      { organizationName: "Acme", category: "Tech", subsector: "SaaS", whyThem: "x", sourceType: "Past VSW sponsor", sourceLink: "x", warmLead: "Y", warmLeadPath: "x", notes: "x", sourceText: "Viv sponsor CSV" },
      baseCtx()
    );

    expect(result.rowNumber).toBe(177);
    expect(sheetsMocks.appendMasterRow).toHaveBeenCalledWith(expect.objectContaining({ organizationName: "Acme", sourceType: "Past VSW sponsor" }), 177);
    expect(cacheMocks.setCachedSourceType).toHaveBeenCalledWith("Viv sponsor CSV", "Past VSW sponsor");
  });

  it("coerces Warm Lead? to a real boolean (checkbox column) — string/Y/yes → true, falsy → false", async () => {
    sheetsMocks.readSourceTypeDropdown.mockResolvedValue(["Past VSW sponsor"]);
    sheetsMocks.readMasterPromotionIndex.mockResolvedValue([]);
    sheetsMocks.nextMasterRowNumber.mockReturnValue(177);
    sheetsMocks.appendMasterRow.mockResolvedValue(undefined);
    const base = { organizationName: "Acme", category: "Tech", subsector: "SaaS", whyThem: "x", sourceType: "Past VSW sponsor", sourceLink: "x", warmLeadPath: "x", notes: "x" };

    for (const [input, expected] of [[true, true], ["Y", true], ["yes", true], [false, false], ["Unknown", false], ["", false]] as const) {
      sheetsMocks.appendMasterRow.mockClear();
      await tool("append_master_row").handler({ ...base, warmLead: input }, baseCtx());
      expect(sheetsMocks.appendMasterRow).toHaveBeenCalledWith(expect.objectContaining({ warmLead: expected }), 177);
    }
  });
});

describe("update_master_aggregate_row — re-reads fresh, never trusts stale context", () => {
  it("applies the idempotent pipe-join against a freshly-read current value", async () => {
    sheetsMocks.readMasterRowAggregateFields.mockResolvedValue({ whyThem: "Existing reason", sourceLink: "https://a.com" });
    sheetsMocks.updateMasterAggregateRow.mockResolvedValue(undefined);

    const result: any = await tool("update_master_aggregate_row").handler(
      { rowNumber: 6, whyThemAddition: "New reason", sourceLinkAddition: "https://b.com" },
      baseCtx()
    );

    expect(result.whyThem).toBe("Existing reason | New reason");
    expect(result.sourceLink).toBe("https://a.com | https://b.com");
    expect(sheetsMocks.updateMasterAggregateRow).toHaveBeenCalledWith(6, "Existing reason | New reason", "https://a.com | https://b.com");
  });

  it("is a true no-op when the addition is already present (idempotency)", async () => {
    sheetsMocks.readMasterRowAggregateFields.mockResolvedValue({ whyThem: "Already there | Existing", sourceLink: "https://a.com" });
    const result: any = await tool("update_master_aggregate_row").handler(
      { rowNumber: 6, whyThemAddition: "Already there", sourceLinkAddition: "https://a.com" },
      baseCtx()
    );
    expect(result.whyThem).toBe("Already there | Existing");
    expect(result.sourceLink).toBe("https://a.com");
  });
});

describe("match_master_org — reuses sameOrg(), never a hand-rolled string compare", () => {
  it("finds a variant-tolerant match", async () => {
    sheetsMocks.readMasterPromotionIndex.mockResolvedValue([
      { rowNumber: 40, organization: "Innovation Island Corp.", orgKey: "innovation island", whyThem: "w", sourceLink: "s" },
    ]);
    const result: any = await tool("match_master_org").handler({ organizationName: "Innovation Island" }, baseCtx());
    expect(result.matched).toBe(true);
    expect(result.rowNumber).toBe(40);
  });

  it("reports no match for a genuinely distinct org", async () => {
    sheetsMocks.readMasterPromotionIndex.mockResolvedValue([{ rowNumber: 1, organization: "Foresight Cleantech Accelerator", orgKey: "x", whyThem: "", sourceLink: "" }]);
    const result: any = await tool("match_master_org").handler({ organizationName: "Foresight Canada" }, baseCtx());
    expect(result.matched).toBe(false);
  });
});

describe("flip_staging_review_status", () => {
  it("only ever flips the one row it was called with", async () => {
    sheetsMocks.markStagingMergedToMaster.mockResolvedValue(undefined);
    await tool("flip_staging_review_status").handler({ rowNumber: 66 }, baseCtx());
    expect(sheetsMocks.markStagingMergedToMaster).toHaveBeenCalledWith([66]);
  });
});

describe("firecrawl tools — increment the per-row cost counter", () => {
  it("firecrawl_search counts a call", async () => {
    firecrawlMocks.firecrawlSearch.mockResolvedValue([{ title: "t", url: "u", description: "d" }]);
    const ctx = baseCtx();
    await tool("firecrawl_search").handler({ query: "Startup TNT Summit" }, ctx);
    expect(ctx.usage.firecrawlCalls).toBe(1);
  });
  it("firecrawl_scrape counts a call", async () => {
    firecrawlMocks.firecrawlScrape.mockResolvedValue("markdown content");
    const ctx = baseCtx();
    await tool("firecrawl_scrape").handler({ url: "https://example.com" }, ctx);
    expect(ctx.usage.firecrawlCalls).toBe(1);
  });
});

describe("ask_tej_on_slack — posts, persists, and waits within its own budget", () => {
  it("returns answered:false if nothing arrives before the timeout", async () => {
    pendingMocks.addPendingQuestion.mockReturnValue({ id: "abc" });
    pendingMocks.pollForAnswer.mockReturnValue(undefined);
    const ctx = baseCtx({ askTimeoutMs: 50, askPollIntervalMs: 10 });
    const result: any = await tool("ask_tej_on_slack").handler({ question: "Is this a Comparable event sponsor?" }, ctx);
    expect(result.answered).toBe(false);
    expect(ctx.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C1", thread_ts: "1000.1" })
    );
  });

  it("returns the answer as soon as it's resolved, without waiting out the full timeout", async () => {
    pendingMocks.addPendingQuestion.mockReturnValue({ id: "abc" });
    pendingMocks.pollForAnswer.mockReturnValueOnce(undefined).mockReturnValueOnce("yes, that's right");
    const ctx = baseCtx({ askTimeoutMs: 60_000, askPollIntervalMs: 10 });
    const result: any = await tool("ask_tej_on_slack").handler({ question: "q" }, ctx);
    expect(result).toEqual({ answered: true, answer: "yes, that's right" });
  });
});
