/**
 * Shared mock implementations for tests
 * Provides mock logger, spawner results, and bot API
 */

import { vi } from "vitest";
import { PassThrough } from "stream";
import { EventEmitter } from "events";

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

/**
 * Create a mock child process for streaming tests
 * Returns a ChildProcess-like object with PassThrough stdout/stderr
 */
export function createMockChildProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const proc = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
    pid: number;
  };
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.kill = vi.fn(() => {
    proc.killed = true;
    stdout.end();
  });
  proc.killed = false;
  proc.pid = 12345;

  return {
    proc,
    /** Write NDJSON lines to stdout, then end the stream */
    feedLines(lines: string[]) {
      for (const line of lines) {
        stdout.write(line + "\n");
      }
      stdout.end();
    },
    /** Write a single NDJSON line without ending */
    writeLine(line: string) {
      stdout.write(line + "\n");
    },
    /** End the stdout stream */
    end() {
      stdout.end();
    },
  };
}
