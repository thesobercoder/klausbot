import { describe, expect, it, beforeEach, vi } from "vitest";
import { createConversationRecord } from "../../helpers/fixtures.js";

// ---- Hoisted mock state ----
const { mockGetConversationsForContext, mockExistsSync, mockReadFileSync } =
  vi.hoisted(() => ({
    mockGetConversationsForContext: vi.fn().mockReturnValue([]),
    mockExistsSync: vi.fn().mockReturnValue(false),
    mockReadFileSync: vi.fn().mockReturnValue(""),
  }));

// ---- Module mocks (same as context.test.ts) ----
vi.mock("../../../src/memory/conversations.js", () => ({
  getConversationsForContext: mockGetConversationsForContext,
  parseTranscript: vi.fn((content: string) => {
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

import {
  buildConversationContext,
  getOrchestrationInstructions,
} from "../../../src/memory/context.js";

describe("buildConversationContext — extended", () => {
  beforeEach(() => {
    mockGetConversationsForContext.mockReset();
  });

  it("3-conversation thread chain (all within 30min gaps)", () => {
    const now = new Date();
    // 3 conversations each 10 min apart — all part of one thread
    const conv3 = createConversationRecord({
      sessionId: "c3",
      startedAt: new Date(now.getTime() - 6 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });
    const conv2 = createConversationRecord({
      sessionId: "c2",
      startedAt: new Date(now.getTime() - 16 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    });
    const conv1 = createConversationRecord({
      sessionId: "c1",
      startedAt: new Date(now.getTime() - 26 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    });

    // Sorted DESC by endedAt
    mockGetConversationsForContext.mockReturnValue([conv3, conv2, conv1]);

    const result = buildConversationContext(12345);
    expect(result).toContain("CONTINUATION");
    // All 3 should be included as full conversations (not summary)
    expect(result).not.toContain('summary="true"');
  });

  it("gap >30min breaks thread chain", () => {
    const now = new Date();
    // Recent conv: 5 min ago
    const recent = createConversationRecord({
      sessionId: "recent",
      startedAt: new Date(now.getTime() - 6 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    });
    // Old conv: 2 hours ago (gap > 30min → not part of thread)
    const old = createConversationRecord({
      sessionId: "old",
      startedAt: new Date(now.getTime() - 121 * 60 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
    });

    mockGetConversationsForContext.mockReturnValue([recent, old]);

    const result = buildConversationContext(12345);
    expect(result).toContain("CONTINUATION");
    // Both should still appear (old is "today non-thread" tier 2), neither as summary
  });

  it("yesterday label for conversations from yesterday", () => {
    const now = new Date();
    // Build a date that is definitely "yesterday" in calendar terms:
    // same time of day, but exactly 1 calendar day back
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayEnd = yesterdayDate.toISOString();
    const yesterdayStart = new Date(
      yesterdayDate.getTime() - 60000,
    ).toISOString();

    const yesterday = createConversationRecord({
      sessionId: "yesterday",
      startedAt: yesterdayStart,
      endedAt: yesterdayEnd,
      summary: "Yesterday's chat",
    });

    mockGetConversationsForContext.mockReturnValue([yesterday]);

    const result = buildConversationContext(12345);
    expect(result).toContain('relative="yesterday"');
    expect(result).toContain('summary="true"');
  });

  it("older conversations get day-name label", () => {
    const now = new Date();
    // 4 days ago
    const older = createConversationRecord({
      sessionId: "older",
      startedAt: new Date(
        now.getTime() - 4 * 24 * 60 * 60 * 1000 - 60000,
      ).toISOString(),
      endedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      summary: "Older chat summary",
    });

    mockGetConversationsForContext.mockReturnValue([older]);

    const result = buildConversationContext(12345);
    // Should have a day name (Monday, Tuesday, etc), not "today" or "yesterday"
    expect(result).not.toContain('relative="today"');
    expect(result).not.toContain('relative="yesterday"');
    expect(result).toContain('summary="true"');
    expect(result).toContain("Older chat summary");
  });

  it("empty conversations returns empty string", () => {
    mockGetConversationsForContext.mockReturnValue([]);
    expect(buildConversationContext(12345)).toBe("");
  });
});

describe("getOrchestrationInstructions — key phrases", () => {
  it("contains start_background_task mention", () => {
    expect(getOrchestrationInstructions()).toContain("start_background_task");
  });

  it("contains 60 SECONDS kill warning", () => {
    expect(getOrchestrationInstructions()).toContain("60 SECONDS");
  });

  it("contains search before delegating mandate", () => {
    expect(getOrchestrationInstructions()).toContain(
      "Search Before Delegating",
    );
  });
});
