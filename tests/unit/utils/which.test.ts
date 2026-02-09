import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn().mockReturnValue(false),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, existsSync: mockExistsSync };
});

import { which } from "../../../src/utils/which.js";

describe("which", () => {
  const origPATH = process.env.PATH;
  const origPlatform = process.platform;

  beforeEach(() => {
    mockExistsSync.mockReset().mockReturnValue(false);
    process.env.PATH = "/usr/bin:/usr/local/bin";
  });

  afterEach(() => {
    process.env.PATH = origPATH;
    Object.defineProperty(process, "platform", { value: origPlatform });
  });

  it("returns full path when found in first PATH dir", () => {
    mockExistsSync.mockImplementation((p: string) => p === "/usr/bin/node");
    expect(which("node")).toBe("/usr/bin/node");
  });

  it("returns full path when found in second PATH dir", () => {
    mockExistsSync.mockImplementation(
      (p: string) => p === "/usr/local/bin/claude",
    );
    expect(which("claude")).toBe("/usr/local/bin/claude");
  });

  it("returns null when not found", () => {
    expect(which("nonexistent")).toBeNull();
  });

  it("returns null for empty PATH", () => {
    process.env.PATH = "";
    expect(which("node")).toBeNull();
  });

  it("tries .exe suffix on win32", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    process.env.PATH = "/mock/bin";
    // On Linux host, join uses '/' — test the .exe fallback logic, not path separators
    mockExistsSync.mockImplementation(
      (p: string) => p === "/mock/bin/node.exe",
    );
    expect(which("node")).toBe("/mock/bin/node.exe");
  });
});
