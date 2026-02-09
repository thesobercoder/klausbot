import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Hoisted mocks
const {
  mockPlatform,
  mockArch,
  mockRelease,
  mockExistsSync,
  mockReadFileSync,
} = vi.hoisted(() => ({
  mockPlatform: vi.fn().mockReturnValue("linux"),
  mockArch: vi.fn().mockReturnValue("x64"),
  mockRelease: vi.fn().mockReturnValue("6.1.0-generic"),
  mockExistsSync: vi.fn().mockReturnValue(false),
  mockReadFileSync: vi.fn().mockReturnValue(""),
}));

vi.mock("os", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    default: {
      ...(actual.default as Record<string, unknown>),
      platform: mockPlatform,
      arch: mockArch,
      release: mockRelease,
    },
    platform: mockPlatform,
    arch: mockArch,
    release: mockRelease,
  };
});

vi.mock("fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  };
});

import { detectPlatform, isContainer } from "../../../src/platform/detect.js";

describe("isContainer", () => {
  const origEnv = process.env.KLAUSBOT_CONTAINER;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.KLAUSBOT_CONTAINER;
    } else {
      process.env.KLAUSBOT_CONTAINER = origEnv;
    }
  });

  it("returns true when KLAUSBOT_CONTAINER=1", () => {
    process.env.KLAUSBOT_CONTAINER = "1";
    expect(isContainer()).toBe(true);
  });

  it("returns false when unset", () => {
    delete process.env.KLAUSBOT_CONTAINER;
    expect(isContainer()).toBe(false);
  });
});

describe("detectPlatform", () => {
  beforeEach(() => {
    mockPlatform.mockReset().mockReturnValue("linux");
    mockArch.mockReset().mockReturnValue("x64");
    mockRelease.mockReset().mockReturnValue("6.1.0-generic");
    mockExistsSync.mockReset().mockReturnValue(false);
    mockReadFileSync.mockReset().mockReturnValue("");
  });

  it("detects macOS arm64 (Apple Silicon)", () => {
    mockPlatform.mockReturnValue("darwin");
    mockArch.mockReturnValue("arm64");
    const info = detectPlatform();
    expect(info.platform).toBe("macos");
    expect(info.displayName).toContain("Apple Silicon");
    expect(info.isWSL).toBe(false);
  });

  it("detects macOS x64 (Intel)", () => {
    mockPlatform.mockReturnValue("darwin");
    mockArch.mockReturnValue("x64");
    const info = detectPlatform();
    expect(info.platform).toBe("macos");
    expect(info.displayName).toContain("Intel");
  });

  it("detects native Linux", () => {
    mockPlatform.mockReturnValue("linux");
    mockRelease.mockReturnValue("6.1.0-generic");
    const info = detectPlatform();
    expect(info.platform).toBe("linux");
    expect(info.displayName).toBe("Linux");
    expect(info.isWSL).toBe(false);
  });

  it("detects WSL2 via os.release()", () => {
    mockPlatform.mockReturnValue("linux");
    mockRelease.mockReturnValue("5.15.153.1-microsoft-standard-WSL2");
    const info = detectPlatform();
    expect(info.platform).toBe("wsl2");
    expect(info.displayName).toContain("WSL2");
    expect(info.isWSL).toBe(true);
  });

  it("detects WSL2 via /proc/version fallback", () => {
    mockPlatform.mockReturnValue("linux");
    mockRelease.mockReturnValue("5.15.0-generic");
    // /proc/version readable and contains microsoft
    mockReadFileSync.mockReturnValue(
      "Linux version 5.15.0 (microsoft@microsoft.com)",
    );
    const info = detectPlatform();
    expect(info.platform).toBe("wsl2");
    expect(info.isWSL).toBe(true);
  });

  it("Docker-on-WSL2 is NOT WSL2 (/.dockerenv exists)", () => {
    mockPlatform.mockReturnValue("linux");
    mockRelease.mockReturnValue("5.15.153.1-microsoft-standard-WSL2");
    // /.dockerenv exists
    mockExistsSync.mockReturnValue(true);
    const info = detectPlatform();
    expect(info.platform).toBe("linux");
    expect(info.isWSL).toBe(false);
  });

  it("detects Windows as unsupported", () => {
    mockPlatform.mockReturnValue("win32");
    const info = detectPlatform();
    expect(info.platform).toBe("unsupported");
    expect(info.displayName).toContain("unsupported");
  });

  it("includes arch and nodeVersion in result", () => {
    mockPlatform.mockReturnValue("linux");
    mockArch.mockReturnValue("arm64");
    const info = detectPlatform();
    expect(info.arch).toBe("arm64");
    expect(info.nodeVersion).toBe(process.version);
  });
});
