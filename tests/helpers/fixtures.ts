/**
 * Test data factories
 * Produce typed objects with sensible defaults, overridable per-test
 */

import type { ConversationRecord } from "../../src/memory/conversations.js";
import type { CronJob } from "../../src/cron/types.js";

/**
 * Create a ConversationRecord with sensible defaults
 * Transcript is valid JSONL with one user + one assistant entry
 */
export function createConversationRecord(
  overrides?: Partial<ConversationRecord>,
): ConversationRecord {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return {
    sessionId: "test-session-1",
    startedAt: oneHourAgo.toISOString(),
    endedAt: now.toISOString(),
    transcript: [
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "Hello" }] },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hi there!" }],
        },
      }),
    ].join("\n"),
    summary: "Test conversation",
    messageCount: 2,
    chatId: 12345,
    ...overrides,
  };
}

/**
 * Create a CronJob with sensible defaults
 * Schedule: every 5 minutes interval
 */
export function createCronJob(overrides?: Partial<CronJob>): CronJob {
  const now = Date.now();

  return {
    id: "test-job-1",
    name: "Test Job",
    schedule: { kind: "every", everyMs: 300_000, anchorMs: now },
    instruction: "Test instruction",
    chatId: 12345,
    createdAt: now,
    nextRunAtMs: now + 300_000,
    lastRunAtMs: null,
    lastStatus: null,
    lastError: null,
    lastDurationMs: null,
    enabled: true,
    humanSchedule: "every 5 minutes",
    ...overrides,
  };
}
