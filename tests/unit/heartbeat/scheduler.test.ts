import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Hoisted mocks
const {
  mockGetJsonConfig,
  mockExecuteHeartbeat,
  mockGetLastActiveChatId,
  mockGetMostRecentChatId,
  mockGetPairingStore,
  mockCreateChildLogger,
} = vi.hoisted(() => ({
  mockGetJsonConfig: vi.fn().mockReturnValue({
    heartbeat: { enabled: true, intervalMs: 60000 },
  }),
  mockExecuteHeartbeat: vi.fn().mockResolvedValue({ ok: true }),
  mockGetLastActiveChatId: vi.fn().mockReturnValue(null),
  mockGetMostRecentChatId: vi.fn().mockReturnValue(null),
  mockGetPairingStore: vi.fn().mockReturnValue({
    listApproved: () => [],
  }),
  mockCreateChildLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../../../src/config/index.js", () => ({
  getJsonConfig: mockGetJsonConfig,
}));
vi.mock("../../../src/heartbeat/executor.js", () => ({
  executeHeartbeat: mockExecuteHeartbeat,
}));
vi.mock("../../../src/daemon/gateway.js", () => ({
  getLastActiveChatId: mockGetLastActiveChatId,
}));
vi.mock("../../../src/memory/conversations.js", () => ({
  getMostRecentChatId: mockGetMostRecentChatId,
}));
vi.mock("../../../src/pairing/index.js", () => ({
  getPairingStore: mockGetPairingStore,
}));
vi.mock("../../../src/utils/index.js", () => ({
  createChildLogger: mockCreateChildLogger,
}));

describe("heartbeat scheduler", () => {
  let startHeartbeat: typeof import("../../../src/heartbeat/scheduler.js").startHeartbeat;
  let stopHeartbeat: typeof import("../../../src/heartbeat/scheduler.js").stopHeartbeat;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    // Reset all mocks
    mockGetJsonConfig.mockReset().mockReturnValue({
      heartbeat: { enabled: true, intervalMs: 60000 },
    });
    mockExecuteHeartbeat.mockReset().mockResolvedValue({ ok: true });
    mockGetLastActiveChatId.mockReset().mockReturnValue(null);
    mockGetMostRecentChatId.mockReset().mockReturnValue(null);
    mockGetPairingStore.mockReset().mockReturnValue({
      listApproved: () => [],
    });

    const mod = await import("../../../src/heartbeat/scheduler.js");
    startHeartbeat = mod.startHeartbeat;
    stopHeartbeat = mod.stopHeartbeat;
  });

  afterEach(() => {
    stopHeartbeat();
    vi.useRealTimers();
  });

  it("does not start when disabled in config", () => {
    mockGetJsonConfig.mockReturnValue({
      heartbeat: { enabled: false },
    });
    startHeartbeat();
    vi.advanceTimersByTime(120000);
    expect(mockExecuteHeartbeat).not.toHaveBeenCalled();
  });

  it("starts with setInterval, no immediate tick", () => {
    mockGetLastActiveChatId.mockReturnValue(100);
    startHeartbeat();
    // No immediate execution
    expect(mockExecuteHeartbeat).not.toHaveBeenCalled();
  });

  it("executes after first interval", async () => {
    mockGetLastActiveChatId.mockReturnValue(100);
    startHeartbeat();
    vi.advanceTimersByTime(60000);
    // Allow microtask queue to flush
    await vi.advanceTimersByTimeAsync(0);
    expect(mockExecuteHeartbeat).toHaveBeenCalledWith(100);
  });

  it("resolves target: config chatId > lastActive > mostRecent > firstApproved", async () => {
    // All set — config chatId wins
    mockGetJsonConfig.mockReturnValue({
      heartbeat: { enabled: true, intervalMs: 60000, chatId: 999 },
    });
    mockGetLastActiveChatId.mockReturnValue(100);
    mockGetMostRecentChatId.mockReturnValue(200);
    mockGetPairingStore.mockReturnValue({
      listApproved: () => [{ chatId: 300 }],
    });

    startHeartbeat();
    vi.advanceTimersByTime(60000);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockExecuteHeartbeat).toHaveBeenCalledWith(999);
  });

  it("falls back to lastActive when no config chatId", async () => {
    mockGetJsonConfig.mockReturnValue({
      heartbeat: { enabled: true, intervalMs: 60000 },
    });
    mockGetLastActiveChatId.mockReturnValue(100);

    startHeartbeat();
    vi.advanceTimersByTime(60000);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockExecuteHeartbeat).toHaveBeenCalledWith(100);
  });

  it("stops when config disables on hot reload", async () => {
    mockGetLastActiveChatId.mockReturnValue(100);
    startHeartbeat();

    // First tick: still enabled
    vi.advanceTimersByTime(60000);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockExecuteHeartbeat).toHaveBeenCalledTimes(1);

    // Disable via hot reload
    mockGetJsonConfig.mockReturnValue({
      heartbeat: { enabled: false },
    });
    vi.advanceTimersByTime(60000);
    await vi.advanceTimersByTimeAsync(0);

    // Should not execute again — scheduler stopped itself
    mockExecuteHeartbeat.mockClear();
    vi.advanceTimersByTime(60000);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockExecuteHeartbeat).not.toHaveBeenCalled();
  });

  it("stop clears interval", async () => {
    mockGetLastActiveChatId.mockReturnValue(100);
    startHeartbeat();
    stopHeartbeat();
    vi.advanceTimersByTime(120000);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockExecuteHeartbeat).not.toHaveBeenCalled();
  });
});
