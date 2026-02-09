import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createMockChildProcess } from "../../helpers/mocks.js";

// Hoisted mocks
const {
  mockSpawn,
  mockCreateChildLogger,
  mockBuildSystemPrompt,
  mockWriteMcpConfigFile,
  mockGetHooksConfig,
} = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockCreateChildLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  mockBuildSystemPrompt: vi.fn().mockReturnValue("system prompt"),
  mockWriteMcpConfigFile: vi.fn().mockReturnValue("/tmp/mcp.json"),
  mockGetHooksConfig: vi.fn().mockReturnValue({}),
}));

vi.mock("child_process", () => ({ spawn: mockSpawn }));
vi.mock("../../../src/utils/index.js", () => ({
  createChildLogger: mockCreateChildLogger,
}));
vi.mock("../../../src/memory/index.js", () => ({
  KLAUSBOT_HOME: "/mock/.klausbot",
  buildSystemPrompt: mockBuildSystemPrompt,
}));
vi.mock("../../../src/daemon/index.js", () => ({
  writeMcpConfigFile: mockWriteMcpConfigFile,
  getHooksConfig: mockGetHooksConfig,
}));

import {
  streamClaudeResponse,
  canStreamToChat,
} from "../../../src/telegram/streaming.js";

describe("canStreamToChat", () => {
  it("returns true for private chat", async () => {
    const bot = {
      api: { getChat: vi.fn().mockResolvedValue({ type: "private" }) },
    };
    expect(await canStreamToChat(bot as any, 123)).toBe(true);
  });

  it("returns true for supergroup", async () => {
    const bot = {
      api: { getChat: vi.fn().mockResolvedValue({ type: "supergroup" }) },
    };
    expect(await canStreamToChat(bot as any, 123)).toBe(true);
  });

  it("returns false for group", async () => {
    const bot = {
      api: { getChat: vi.fn().mockResolvedValue({ type: "group" }) },
    };
    expect(await canStreamToChat(bot as any, 123)).toBe(false);
  });

  it("returns false when getChat throws", async () => {
    const bot = {
      api: { getChat: vi.fn().mockRejectedValue(new Error("forbidden")) },
    };
    expect(await canStreamToChat(bot as any, 123)).toBe(false);
  });
});

describe("streamClaudeResponse", () => {
  let mockProc: ReturnType<typeof createMockChildProcess>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockProc = createMockChildProcess();
    mockSpawn.mockReset().mockReturnValue(mockProc.proc);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accumulates text from content_block_delta events", async () => {
    const chunks: string[] = [];

    const promise = streamClaudeResponse("hello", {}, (text) => {
      chunks.push(text);
    });

    mockProc.feedLines([
      JSON.stringify({
        type: "content_block_delta",
        delta: { text: "Hello " },
      }),
      JSON.stringify({ type: "content_block_delta", delta: { text: "world" } }),
      JSON.stringify({ type: "result", result: "Hello world" }),
    ]);

    const result = await promise;
    expect(chunks).toEqual(["Hello ", "world"]);
    expect(result.result).toBe("Hello world");
  });

  it("parses tool use from start+delta+stop events", async () => {
    const promise = streamClaudeResponse("test", {}, () => {});

    mockProc.feedLines([
      JSON.stringify({
        type: "content_block_start",
        content_block: { type: "tool_use", name: "search_memories" },
      }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "input_json_delta", partial_json: '{"query":' },
      }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "input_json_delta", partial_json: '"test"}' },
      }),
      JSON.stringify({ type: "content_block_stop" }),
      JSON.stringify({ type: "result", result: "done" }),
    ]);

    const result = await promise;
    expect(result.toolUse).toHaveLength(1);
    expect(result.toolUse![0].name).toBe("search_memories");
    expect(result.toolUse![0].input).toEqual({ query: "test" });
  });

  it("extracts cost_usd from legacy field", async () => {
    const promise = streamClaudeResponse("test", {}, () => {});

    mockProc.feedLines([
      JSON.stringify({ type: "result", result: "ok", cost_usd: 0.05 }),
    ]);

    const result = await promise;
    expect(result.cost_usd).toBe(0.05);
  });

  it("prefers total_cost_usd over cost_usd", async () => {
    const promise = streamClaudeResponse("test", {}, () => {});

    mockProc.feedLines([
      JSON.stringify({
        type: "result",
        result: "ok",
        cost_usd: 0.05,
        total_cost_usd: 0.12,
      }),
    ]);

    const result = await promise;
    expect(result.cost_usd).toBe(0.12);
  });

  it("extracts session_id from result event", async () => {
    const promise = streamClaudeResponse("test", {}, () => {});

    mockProc.feedLines([
      JSON.stringify({ type: "result", result: "ok", session_id: "abc-123" }),
    ]);

    const result = await promise;
    expect(result.session_id).toBe("abc-123");
  });

  it("skips malformed NDJSON lines", async () => {
    const chunks: string[] = [];
    const promise = streamClaudeResponse("test", {}, (text) => {
      chunks.push(text);
    });

    mockProc.feedLines([
      "not json at all",
      JSON.stringify({ type: "content_block_delta", delta: { text: "ok" } }),
      JSON.stringify({ type: "result", result: "ok" }),
    ]);

    const result = await promise;
    expect(chunks).toEqual(["ok"]);
    expect(result.result).toBe("ok");
  });

  it("timeout kills process and returns partial result with notice", async () => {
    const promise = streamClaudeResponse("test", {}, () => {});

    // Write a delta, but don't end the stream
    mockProc.writeLine(
      JSON.stringify({
        type: "content_block_delta",
        delta: { text: "partial" },
      }),
    );

    // Advance past the 90s timeout
    vi.advanceTimersByTime(91000);

    const result = await promise;
    expect(result.result).toContain("partial");
    expect(result.result).toContain("[Response timed out");
    expect(mockProc.proc.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("abort signal kills process", async () => {
    const controller = new AbortController();

    const promise = streamClaudeResponse(
      "test",
      { signal: controller.signal },
      () => {},
    );

    mockProc.writeLine(
      JSON.stringify({
        type: "content_block_delta",
        delta: { text: "partial" },
      }),
    );

    controller.abort();

    // The stream should close after abort kills the process
    // We need to manually end since our mock kill ends stdout
    const result = await promise;
    expect(mockProc.proc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(result.result).toContain("partial");
  });

  it("passes chatId as KLAUSBOT_CHAT_ID env var", () => {
    const promise = streamClaudeResponse("test", { chatId: 42 }, () => {});
    mockProc.feedLines([JSON.stringify({ type: "result", result: "ok" })]);

    // Check the spawn call's env
    const spawnCall = mockSpawn.mock.calls[0];
    const env = spawnCall[2].env;
    expect(env.KLAUSBOT_CHAT_ID).toBe("42");

    return promise; // let it resolve
  });

  it("parses MCP tool calls from assistant message events", async () => {
    const promise = streamClaudeResponse("test", {}, () => {});

    mockProc.feedLines([
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "search_memories",
              input: { query: "hello" },
            },
          ],
        },
      }),
      JSON.stringify({ type: "result", result: "done" }),
    ]);

    const result = await promise;
    expect(result.toolUse).toHaveLength(1);
    expect(result.toolUse![0].name).toBe("search_memories");
  });
});
