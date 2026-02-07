import { describe, expect, it, beforeEach, vi } from "vitest";
import { createConversationRecord } from "../../helpers/fixtures.js";

// ---- Hoisted mock state ----
const { mockGetConversationsForContext, mockExistsSync, mockReadFileSync } =
  vi.hoisted(() => ({
    mockGetConversationsForContext: vi.fn().mockReturnValue([]),
    mockExistsSync: vi.fn().mockReturnValue(false),
    mockReadFileSync: vi.fn().mockReturnValue(""),
  }));

// ---- Module mocks ----
vi.mock("../../../src/memory/conversations.js", () => ({
  getConversationsForContext: mockGetConversationsForContext,
  parseTranscript: vi.fn((content: string) => {
    // Lightweight parse for tests — same logic as real parseTranscript
    return content
      .split("\n")
      .filter((l: string) => l.trim())
      .map((l: string) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }),
}));

vi.mock("../../../src/memory/home.js", () => ({
  KLAUSBOT_HOME: "/tmp/klausbot-test",
  getHomePath: (...segments: string[]) =>
    ["/tmp/klausbot-test", ...segments].join("/"),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  };
});

// Import after mocks
import {
  getRetrievalInstructions,
  getSkillReminder,
  getAgentReminder,
  getToolGuidance,
  getOrchestrationInstructions,
  getMemoryFirstBookend,
  getMemoryFirstReminder,
  buildConversationContext,
  loadIdentity,
  invalidateIdentityCache,
  reloadIdentity,
  buildSystemPrompt,
} from "../../../src/memory/context.js";

describe("static instruction functions", () => {
  describe("getRetrievalInstructions", () => {
    it("returns string containing memory-instructions XML tag", () => {
      const result = getRetrievalInstructions();
      expect(result).toContain("<memory-instructions>");
      expect(result).toContain("</memory-instructions>");
    });

    it("contains search_memories tool mention", () => {
      expect(getRetrievalInstructions()).toContain("search_memories");
    });

    it("contains MANDATORY enforcement text", () => {
      expect(getRetrievalInstructions()).toContain("MANDATORY");
    });
  });

  describe("getSkillReminder", () => {
    it("returns string wrapped in skill-folder tags", () => {
      const result = getSkillReminder();
      expect(result).toContain("<skill-folder>");
      expect(result).toContain("</skill-folder>");
    });
  });

  describe("getAgentReminder", () => {
    it("returns string wrapped in agent-folder tags", () => {
      const result = getAgentReminder();
      expect(result).toContain("<agent-folder>");
      expect(result).toContain("</agent-folder>");
    });
  });

  describe("getToolGuidance", () => {
    it("returns string wrapped in tool-guidance tags", () => {
      const result = getToolGuidance();
      expect(result).toContain("<tool-guidance>");
      expect(result).toContain("</tool-guidance>");
    });
  });

  describe("getOrchestrationInstructions", () => {
    it("contains start_background_task mention", () => {
      expect(getOrchestrationInstructions()).toContain("start_background_task");
    });

    it("contains 60 SECONDS kill warning", () => {
      expect(getOrchestrationInstructions()).toContain("60 SECONDS");
    });
  });

  describe("getMemoryFirstBookend", () => {
    it("returns string with memory-first tag", () => {
      const result = getMemoryFirstBookend();
      expect(result).toContain("<memory-first>");
      expect(result).toContain("</memory-first>");
    });
  });

  describe("getMemoryFirstReminder", () => {
    it("returns string with system-reminder tag", () => {
      const result = getMemoryFirstReminder();
      expect(result).toContain("<system-reminder>");
      expect(result).toContain("</system-reminder>");
    });
  });
});

describe("buildConversationContext", () => {
  beforeEach(() => {
    mockGetConversationsForContext.mockReset();
  });

  it("no conversations returns empty string", () => {
    mockGetConversationsForContext.mockReturnValue([]);
    expect(buildConversationContext(12345)).toBe("");
  });

  it("active thread (within 30min) returns CONTINUATION status", () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    mockGetConversationsForContext.mockReturnValue([
      createConversationRecord({
        sessionId: "recent-1",
        startedAt: new Date(fiveMinAgo.getTime() - 60000).toISOString(),
        endedAt: fiveMinAgo.toISOString(),
      }),
    ]);

    const result = buildConversationContext(12345);
    expect(result).toContain("<thread-status>CONTINUATION");
    expect(result).toContain("<conversation-history");
  });

  it("new conversation (>30min gap) returns NEW CONVERSATION status", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    mockGetConversationsForContext.mockReturnValue([
      createConversationRecord({
        sessionId: "old-1",
        startedAt: new Date(twoHoursAgo.getTime() - 60000).toISOString(),
        endedAt: twoHoursAgo.toISOString(),
      }),
    ]);

    const result = buildConversationContext(12345);
    expect(result).toContain("<thread-status>NEW CONVERSATION");
  });

  it("tiered output: thread full, today full, yesterday summary, older summary", () => {
    const now = new Date();

    // Tier 1: Active thread (5 min ago)
    const threadConv = createConversationRecord({
      sessionId: "thread-conv",
      startedAt: new Date(now.getTime() - 6 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });

    // Tier 2: Today non-thread (2 hours ago)
    const todayConv = createConversationRecord({
      sessionId: "today-conv",
      startedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    });

    // Tier 3: Yesterday (30 hours ago)
    const yesterdayConv = createConversationRecord({
      sessionId: "yesterday-conv",
      startedAt: new Date(now.getTime() - 31 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
      summary: "Yesterday summary text",
    });

    // Tier 4: Older (4 days ago)
    const olderConv = createConversationRecord({
      sessionId: "older-conv",
      startedAt: new Date(
        now.getTime() - 4 * 24 * 60 * 60 * 1000 - 60000,
      ).toISOString(),
      endedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      summary: "Older summary text",
    });

    // sorted DESC by endedAt
    mockGetConversationsForContext.mockReturnValue([
      threadConv,
      todayConv,
      yesterdayConv,
      olderConv,
    ]);

    const result = buildConversationContext(12345);

    // Thread conv has full conversation (not summary="true")
    expect(result).toContain("<conversation-history");
    expect(result).toContain("CONTINUATION");

    // Yesterday and older use summary attribute
    expect(result).toContain('summary="true"');
    expect(result).toContain("Yesterday summary text");
    expect(result).toContain("Older summary text");
  });

  it("budget enforcement: very long transcript truncated", () => {
    const now = new Date();

    // Create conversation with massive transcript
    const longText = "x".repeat(130_000); // exceeds 120K char budget
    const longTranscript = JSON.stringify({
      type: "user",
      timestamp: now.toISOString(),
      message: {
        role: "user",
        content: [{ type: "text", text: longText }],
      },
    });

    mockGetConversationsForContext.mockReturnValue([
      createConversationRecord({
        sessionId: "long-conv",
        startedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        endedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
        transcript: longTranscript,
      }),
    ]);

    const result = buildConversationContext(12345);
    expect(result).toContain("[...truncated...]");
    // Total should be under 120K chars plus overhead
    expect(result.length).toBeLessThan(130_000);
  });
});

describe("identity loading", () => {
  beforeEach(() => {
    // Reset module-level identity cache
    invalidateIdentityCache();
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it("loadIdentity returns XML-wrapped content when identity files exist", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("Test soul content");

    const result = loadIdentity();
    expect(result).toContain("<SOUL.md>");
    expect(result).toContain("Test soul content");
    expect(result).toContain("</SOUL.md>");
  });

  it("invalidateIdentityCache + loadIdentity reloads fresh content", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("Original content");

    const first = loadIdentity();
    expect(first).toContain("Original content");

    // Change what readFileSync returns
    mockReadFileSync.mockReturnValue("Updated content");

    // Without invalidation, still cached
    const cached = loadIdentity();
    expect(cached).toContain("Original content");

    // After invalidation, reloads
    invalidateIdentityCache();
    const fresh = loadIdentity();
    expect(fresh).toContain("Updated content");
  });

  it("reloadIdentity forces fresh read", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("First load");

    loadIdentity();

    mockReadFileSync.mockReturnValue("Reloaded content");
    const result = reloadIdentity();
    expect(result).toContain("Reloaded content");
  });
});

describe("buildSystemPrompt", () => {
  beforeEach(() => {
    invalidateIdentityCache();
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it("when BOOTSTRAP.md exists returns its content only", () => {
    // existsSync returns true for bootstrap path specifically
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("Bootstrap prompt content here");

    const result = buildSystemPrompt();
    expect(result).toBe("Bootstrap prompt content here");
  });

  it("when no BOOTSTRAP.md + identity files exist returns combined prompt", () => {
    // First call: BOOTSTRAP.md check -> false
    // Subsequent calls: identity file checks -> true
    let callCount = 0;
    mockExistsSync.mockImplementation(() => {
      callCount++;
      // First call is for BOOTSTRAP.md -> false
      return callCount > 1;
    });
    mockReadFileSync.mockReturnValue("Identity content");

    const result = buildSystemPrompt();

    // Should contain all sections
    expect(result).toContain("<memory-first>");
    expect(result).toContain("<tool-guidance>");
    expect(result).toContain("<skill-folder>");
    expect(result).toContain("<agent-folder>");
    expect(result).toContain("<memory-instructions>");
    expect(result).toContain("<system-reminder>");
    // Identity content should be present
    expect(result).toContain("Identity content");
  });
});
