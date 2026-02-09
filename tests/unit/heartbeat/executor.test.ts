import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted mocks
const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockQueryClaudeCode,
  mockGetHomePath,
  mockCreateChildLogger,
  mockMarkdownToTelegramHtml,
  mockBotSendMessage,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn().mockReturnValue(true),
  mockReadFileSync: vi
    .fn()
    .mockReturnValue("# Heartbeat\n## Active Items\n(No items yet)"),
  mockWriteFileSync: vi.fn(),
  mockQueryClaudeCode: vi.fn(),
  mockGetHomePath: vi.fn((...segments: string[]) =>
    ["/mock/.klausbot", ...segments].join("/"),
  ),
  mockCreateChildLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  mockMarkdownToTelegramHtml: vi.fn((s: string) => s),
  mockBotSendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  };
});

vi.mock("../../../src/daemon/spawner.js", () => ({
  queryClaudeCode: mockQueryClaudeCode,
}));

vi.mock("../../../src/memory/index.js", () => ({
  getHomePath: mockGetHomePath,
}));

vi.mock("../../../src/utils/index.js", () => ({
  createChildLogger: mockCreateChildLogger,
  markdownToTelegramHtml: mockMarkdownToTelegramHtml,
}));

// Dynamic import mock for telegram bot
vi.mock("../../../src/telegram/index.js", () => ({
  bot: { api: { sendMessage: mockBotSendMessage } },
}));

import {
  executeHeartbeat,
  getHeartbeatPath,
} from "../../../src/heartbeat/executor.js";

describe("getHeartbeatPath", () => {
  it("returns path under identity/HEARTBEAT.md", () => {
    const path = getHeartbeatPath();
    expect(path).toContain("HEARTBEAT.md");
    expect(path).toContain("identity");
  });
});

describe("executeHeartbeat", () => {
  beforeEach(() => {
    mockExistsSync.mockReset().mockReturnValue(true);
    mockReadFileSync
      .mockReset()
      .mockReturnValue("# Heartbeat\n## Active Items\n- [ ] Check server");
    mockWriteFileSync.mockReset();
    mockQueryClaudeCode.mockReset();
    mockBotSendMessage.mockReset().mockResolvedValue({ message_id: 1 });
    mockMarkdownToTelegramHtml.mockReset().mockImplementation((s: string) => s);
  });

  it("creates HEARTBEAT.md when file missing", async () => {
    mockExistsSync.mockReturnValue(false);
    // After write, next existsSync returns true (for readFileSync to work)
    mockExistsSync.mockReturnValueOnce(false);
    mockQueryClaudeCode.mockResolvedValue({ result: "HEARTBEAT_OK" });

    await executeHeartbeat(123);
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("suppresses HEARTBEAT_OK — no Telegram send", async () => {
    mockQueryClaudeCode.mockResolvedValue({ result: "HEARTBEAT_OK" });

    const result = await executeHeartbeat(123);
    expect(result.ok).toBe(true);
    expect(result.suppressed).toBe(true);
    expect(mockBotSendMessage).not.toHaveBeenCalled();
  });

  it("sends non-OK response to target chat with [Heartbeat] prefix", async () => {
    mockQueryClaudeCode.mockResolvedValue({
      result: "Your server is down!",
    });

    const result = await executeHeartbeat(456);
    expect(result.ok).toBe(true);
    expect(result.suppressed).toBe(false);
    expect(result.response).toBe("Your server is down!");
    expect(mockBotSendMessage).toHaveBeenCalledWith(
      456,
      expect.stringContaining("[Heartbeat]"),
      expect.objectContaining({ parse_mode: "HTML" }),
    );
  });

  it("calls markdownToTelegramHtml on response", async () => {
    mockQueryClaudeCode.mockResolvedValue({ result: "**bold**" });

    await executeHeartbeat(123);
    expect(mockMarkdownToTelegramHtml).toHaveBeenCalledWith("**bold**");
  });

  it("handles queryClaudeCode error gracefully", async () => {
    mockQueryClaudeCode.mockRejectedValue(new Error("timeout"));

    const result = await executeHeartbeat(789);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timeout");
  });

  it("Telegram send failure doesn't throw", async () => {
    mockQueryClaudeCode.mockResolvedValue({ result: "Alert!" });
    mockBotSendMessage.mockRejectedValue(new Error("network error"));

    // Should not throw
    const result = await executeHeartbeat(123);
    expect(result.ok).toBe(true);
  });

  it("trims whitespace from response before comparing to HEARTBEAT_OK", async () => {
    mockQueryClaudeCode.mockResolvedValue({ result: "  HEARTBEAT_OK  \n" });

    const result = await executeHeartbeat(123);
    expect(result.suppressed).toBe(true);
  });
});
