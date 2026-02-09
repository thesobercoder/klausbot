import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Hoisted mocks
const { mockWhich, mockExecSync, mockIsContainer } = vi.hoisted(() => ({
  mockWhich: vi.fn(),
  mockExecSync: vi.fn(),
  mockIsContainer: vi.fn().mockReturnValue(false),
}));

vi.mock("../../../src/utils/which.js", () => ({ which: mockWhich }));
vi.mock("child_process", () => ({ execSync: mockExecSync }));
vi.mock("../../../src/platform/detect.js", () => ({
  isContainer: mockIsContainer,
}));

import {
  capabilities,
  checkAllCapabilities,
} from "../../../src/platform/capabilities.js";

describe("capabilities", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    mockWhich.mockReset().mockReturnValue("/usr/bin/claude");
    mockExecSync.mockReset();
    mockIsContainer.mockReset().mockReturnValue(false);

    // Save and set env vars
    for (const key of [
      "TELEGRAM_BOT_TOKEN",
      "OPENAI_API_KEY",
      "CLAUDE_CODE_OAUTH_TOKEN",
      "KLAUSBOT_CONTAINER",
    ]) {
      savedEnv[key] = process.env[key];
    }
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "test-oauth";
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it("all OK when everything is configured", async () => {
    const results = await checkAllCapabilities();
    expect(results.every((r) => r.status === "ok")).toBe(true);
  });

  it("telegram: missing when no token", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const results = await checkAllCapabilities();
    const telegram = results.find((r) => r.capability.id === "telegram");
    expect(telegram?.status).toBe("missing");
  });

  it("claude: missing when not in PATH", async () => {
    mockWhich.mockReturnValue(null);
    const results = await checkAllCapabilities();
    const claude = results.find((r) => r.capability.id === "claude");
    expect(claude?.status).toBe("missing");
  });

  it("claude: missing when --version throws", async () => {
    mockWhich.mockReturnValue("/usr/bin/claude");
    mockExecSync.mockImplementation(() => {
      throw new Error("timeout");
    });
    const results = await checkAllCapabilities();
    const claude = results.find((r) => r.capability.id === "claude");
    expect(claude?.status).toBe("missing");
  });

  it("container-oauth: ok when not a container (skips check)", async () => {
    mockIsContainer.mockReturnValue(false);
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const results = await checkAllCapabilities();
    const oauth = results.find((r) => r.capability.id === "container-oauth");
    expect(oauth?.status).toBe("ok");
  });

  it("container-oauth: missing in container without token", async () => {
    mockIsContainer.mockReturnValue(true);
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const results = await checkAllCapabilities();
    const oauth = results.find((r) => r.capability.id === "container-oauth");
    expect(oauth?.status).toBe("missing");
  });

  it("container-oauth: ok in container with token", async () => {
    mockIsContainer.mockReturnValue(true);
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "real-token";
    const results = await checkAllCapabilities();
    const oauth = results.find((r) => r.capability.id === "container-oauth");
    expect(oauth?.status).toBe("ok");
  });

  it("openai: optional and missing without key", async () => {
    delete process.env.OPENAI_API_KEY;
    const results = await checkAllCapabilities();
    const openai = results.find((r) => r.capability.id === "openai");
    expect(openai?.capability.severity).toBe("optional");
    expect(openai?.status).toBe("missing");
  });

  it("returns results array with 4 entries", async () => {
    const results = await checkAllCapabilities();
    expect(results).toHaveLength(capabilities.length);
  });
});
