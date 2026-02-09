import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted mocks
const {
  mockExistsSync,
  mockReadFileSync,
  mockStatSync,
  mockWriteFileSync,
  mockMkdirSync,
  mockHomedir,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn().mockReturnValue(false),
  mockReadFileSync: vi.fn().mockReturnValue("{}"),
  mockStatSync: vi.fn().mockReturnValue({ mtimeMs: 1000 }),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockHomedir: vi.fn().mockReturnValue("/mock/home"),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    statSync: mockStatSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
  };
});

vi.mock("os", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    homedir: mockHomedir,
    default: {
      ...(actual.default as Record<string, unknown>),
      homedir: mockHomedir,
    },
  };
});

describe("loadJsonConfig", () => {
  // Reset module cache each test to clear the module-level configCache
  let loadJsonConfig: typeof import("../../../src/config/json.js").loadJsonConfig;

  beforeEach(async () => {
    vi.resetModules();
    mockExistsSync.mockReset().mockReturnValue(false);
    mockReadFileSync.mockReset().mockReturnValue("{}");
    mockStatSync.mockReset().mockReturnValue({ mtimeMs: 1000 });
    mockWriteFileSync.mockReset();
    mockMkdirSync.mockReset();

    const mod = await import("../../../src/config/json.js");
    loadJsonConfig = mod.loadJsonConfig;
  });

  it("seeds defaults when file missing", () => {
    mockExistsSync.mockReturnValue(false);
    const config = loadJsonConfig();
    expect(config.model).toBe("claude-opus-4-6");
    expect(config.heartbeat.enabled).toBe(true);
    // Should have tried to write defaults
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("seed failure is non-fatal", () => {
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockImplementation(() => {
      throw new Error("EACCES");
    });
    // Should not throw — returns in-memory defaults
    const config = loadJsonConfig();
    expect(config.model).toBe("claude-opus-4-6");
  });

  it("loads valid JSON from file", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ model: "claude-sonnet-4-5-20250929" }),
    );
    const config = loadJsonConfig();
    expect(config.model).toBe("claude-sonnet-4-5-20250929");
  });

  it("returns cache when mtime unchanged", () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ mtimeMs: 5000 });
    mockReadFileSync.mockReturnValue(JSON.stringify({ model: "first" }));

    const first = loadJsonConfig();
    expect(first.model).toBe("first");

    // Second call — same mtime, should not re-read
    mockReadFileSync.mockReturnValue(JSON.stringify({ model: "second" }));
    const second = loadJsonConfig();
    expect(second.model).toBe("first"); // cached
  });

  it("reloads when mtime changes", () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ mtimeMs: 5000 });
    mockReadFileSync.mockReturnValue(JSON.stringify({ model: "first" }));

    loadJsonConfig();

    // Mtime changes
    mockStatSync.mockReturnValue({ mtimeMs: 6000 });
    mockReadFileSync.mockReturnValue(JSON.stringify({ model: "updated" }));
    const updated = loadJsonConfig();
    expect(updated.model).toBe("updated");
  });

  it("throws on invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("{not valid json}");
    expect(() => loadJsonConfig()).toThrow("Invalid JSON");
  });

  it("throws on schema validation failure (unknown key)", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ unknownKey: true }));
    expect(() => loadJsonConfig()).toThrow("Config validation failed");
  });

  it("fills defaults for partial config", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ model: "custom" }));
    const config = loadJsonConfig();
    expect(config.model).toBe("custom");
    // Defaults filled
    expect(config.streaming.enabled).toBe(true);
    expect(config.heartbeat.intervalMs).toBe(1800000);
  });
});
