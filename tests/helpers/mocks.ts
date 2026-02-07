/**
 * Shared mock implementations for tests
 * Provides mock logger, spawner results, and bot API
 */

import { vi } from "vitest";

/**
 * Create a mock pino Logger
 * Matches the Logger interface used throughout the codebase
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    level: "info" as string,
    child: vi.fn().mockReturnThis(),
  };
}

/**
 * Create a mock ClaudeResponse (from src/daemon/spawner.ts)
 * Defaults to successful response with sensible values
 */
export function mockSpawnerResult(
  overrides?: Partial<{
    result: string;
    cost_usd: number;
    session_id: string;
    duration_ms: number;
    is_error: boolean;
  }>,
) {
  return {
    result: "Mock response",
    cost_usd: 0,
    session_id: "test-session",
    duration_ms: 100,
    is_error: false,
    ...overrides,
  };
}

/**
 * Create a mock Grammy bot.api object
 * Covers sendMessage and sendChatAction used in handlers
 */
export function mockBotApi() {
  return {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
    sendChatAction: vi.fn().mockResolvedValue(true),
  };
}
