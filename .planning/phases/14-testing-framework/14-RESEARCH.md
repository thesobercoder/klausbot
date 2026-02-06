# Phase 14: Testing Framework - Research

**Researched:** 2026-02-07
**Domain:** Testing infrastructure for TypeScript/Node.js Telegram bot
**Confidence:** HIGH

## Summary

The klausbot codebase is a TypeScript ESM project (Node 22, `"type": "module"`) built with tsup, using grammY (Telegram), better-sqlite3 + drizzle-orm (persistence), child_process spawn (Claude Code CLI), croner (cron), and OpenAI (embeddings). No tests or test infrastructure currently exist.

The standard approach for this stack is **Vitest** as the test runner (native ESM, TypeScript, fast), with **v8 coverage** provider, **vi.mock** for module isolation, and **in-memory SQLite** for database tests. The bot layer (grammY) uses the **transformer intercept pattern** to capture outgoing API calls without hitting Telegram.

**Primary recommendation:** Use Vitest with a layered mocking strategy: thin wrappers around external dependencies (Claude CLI spawner, Telegram bot API, OpenAI) enable unit testing of core logic without external services. Focus unit tests on pure-logic modules first (parse, schedule, context, split, queue, store) since they yield highest coverage per effort.

## Standard Stack

### Core

| Library             | Version | Purpose                  | Why Standard                                                               |
| ------------------- | ------- | ------------------------ | -------------------------------------------------------------------------- |
| vitest              | ^3.x    | Test runner + assertions | Native ESM, TS support, no config overhead, vi.mock hoisting               |
| @vitest/coverage-v8 | ^3.x    | Code coverage            | Default provider, no instrumentation step, AST-aware remapping now default |

### Supporting

| Library        | Version             | Purpose           | When to Use                                                 |
| -------------- | ------------------- | ----------------- | ----------------------------------------------------------- |
| better-sqlite3 | (already installed) | In-memory test DB | Database integration tests - use `new Database(':memory:')` |

### Alternatives Considered

| Instead of          | Could Use                 | Tradeoff                                                                                 |
| ------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| Vitest              | Jest                      | Jest requires ESM transforms, `--experimental-vm-modules`, more config for TS ESM        |
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul more precise historically, but v8 AST remapping closes gap; v8 is faster        |
| grammy_tests        | Manual transformer mock   | grammy_tests is Deno-only, not usable; transformer pattern is simple enough to hand-roll |

**Installation:**

```bash
npm install -D vitest @vitest/coverage-v8
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  cron/
  daemon/
  memory/
  ...
tests/
  unit/
    cron/
      parse.test.ts
      schedule.test.ts
      store.test.ts
    daemon/
      queue.test.ts
      spawner.test.ts
    memory/
      conversations.test.ts
      context.test.ts
      search.test.ts
    utils/
      split.test.ts
      telegram-html.test.ts
    config/
      schema.test.ts
    pairing/
      store.test.ts
  e2e/
    gateway.test.ts
    cron-flow.test.ts
    onboard.test.ts
  helpers/
    db.ts          # In-memory DB setup/teardown
    fixtures.ts    # Test data factories
    mocks.ts       # Shared mock implementations
vitest.config.ts
```

### Pattern 1: Vitest Config for tsup ESM Project

**What:** Standalone vitest.config.ts (not extending vite.config.ts since project uses tsup)
**When to use:** Always -- this is the project entry point

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/cli/**"],
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        // Start modest, increase as coverage grows
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40,
      },
    },
    // Run tests against source TS, not built dist
    // Vitest uses Vite's ESM pipeline to transform TS directly
  },
});
```

### Pattern 2: In-Memory SQLite for Database Tests

**What:** Create a fresh in-memory DB per test, avoiding filesystem side effects
**When to use:** Any test touching memory/db, cron/store, or conversations

```typescript
// tests/helpers/db.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../src/memory/schema.js";

/**
 * Create a fresh in-memory database with schema applied.
 * Returns both raw sqlite and drizzle instances.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");

  // Apply schema (same SQL as db.ts runMigrations)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      transcript TEXT NOT NULL,
      summary TEXT NOT NULL,
      message_count INTEGER NOT NULL,
      chat_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_ended_at ON conversations(ended_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(chat_id);
  `);

  const db = drizzle(sqlite, { schema });
  return { sqlite, db, close: () => sqlite.close() };
}
```

**Key insight:** Skip sqlite-vec extension in unit tests. The vec_embeddings virtual table requires the native extension and is only needed for semantic search tests. Mock `semanticSearch` instead; test it separately if needed.

### Pattern 3: Module Mocking for External Dependencies

**What:** Use vi.mock to replace modules that spawn processes or call APIs
**When to use:** Testing any module that imports spawner, bot, or OpenAI

```typescript
// Mock the spawner (Claude CLI) for gateway/cron tests
vi.mock("../../src/daemon/spawner.js", () => ({
  queryClaudeCode: vi.fn().mockResolvedValue({
    result: "Mocked response",
    cost_usd: 0,
    session_id: "test-session",
    duration_ms: 100,
    is_error: false,
  }),
  writeMcpConfigFile: vi.fn().mockReturnValue("/tmp/mock-mcp.json"),
  getMcpConfig: vi.fn().mockReturnValue({ mcpServers: {} }),
  getHooksConfig: vi.fn().mockReturnValue({ hooks: {} }),
}));

// Mock the Telegram bot for tests that send messages
vi.mock("../../src/telegram/bot.js", () => ({
  bot: {
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
      sendChatAction: vi.fn().mockResolvedValue(true),
      config: { use: vi.fn() },
    },
    use: vi.fn(),
    command: vi.fn(),
    on: vi.fn(),
    catch: vi.fn(),
  },
  createRunner: vi.fn(),
}));
```

### Pattern 4: grammY Transformer Intercept for E2E Bot Tests

**What:** Install a transformer on `bot.api.config` that captures all outgoing requests
**When to use:** E2E tests that simulate Telegram updates end-to-end

```typescript
interface CapturedRequest {
  method: string;
  payload: Record<string, unknown>;
}

function createTestBot() {
  const outgoing: CapturedRequest[] = [];

  // Intercept all API calls
  bot.api.config.use(async (_prev, method, payload) => {
    outgoing.push({ method, payload: payload as Record<string, unknown> });
    // Return mock success response
    return { ok: true, result: true } as any;
  });

  return { outgoing };
}
```

### Anti-Patterns to Avoid

- **Testing against built `dist/`:** Always test against source `src/` TS files. Vitest transforms them directly via Vite's ESM pipeline.
- **Global singleton pollution:** Modules like `db.ts`, `config/loader.ts`, `pairing/store.ts` use module-level singletons. Each test file must vi.mock or vi.resetModules to prevent state leaking between tests.
- **Testing Claude CLI integration directly:** The spawner calls `spawn("claude", ...)` which requires the Claude CLI installed. Always mock `queryClaudeCode` in tests.
- **Importing `telegram/bot.ts` without mocking config:** `bot.ts` immediately reads `config.TELEGRAM_BOT_TOKEN` on import. Must mock `config` before importing bot.

## Don't Hand-Roll

| Problem                  | Don't Build               | Use Instead                                     | Why                                                  |
| ------------------------ | ------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Test runner              | Custom test harness       | Vitest                                          | Watch mode, parallel, coverage, snapshots built in   |
| Module mocking           | Manual monkey-patching    | vi.mock / vi.spyOn                              | Hoisting, auto-cleanup, type safety                  |
| Assertion library        | Custom assert helpers     | Vitest expect                                   | Comprehensive matchers, async support                |
| Coverage                 | Manual instrumentation    | @vitest/coverage-v8                             | Source-mapped, threshold enforcement, CI integration |
| Test DB lifecycle        | Manual setup/teardown SQL | Helper factory returning fresh `:memory:` DB    | Isolated, no cleanup needed, fast                    |
| Telegram update fixtures | Copy-paste JSON blobs     | Factory function `createUpdate({text, chatId})` | Consistent, type-safe, maintainable                  |

**Key insight:** The codebase has many pure-logic functions (parseSchedule, computeNextRunAtMs, splitMessage, markdownToTelegramHtml, buildConversationContext) that require zero mocking. Prioritize these for immediate high-confidence coverage.

## Common Pitfalls

### Pitfall 1: Module-Level Side Effects on Import

**What goes wrong:** Importing `telegram/bot.ts` triggers `new Bot(config.TELEGRAM_BOT_TOKEN)` immediately. If `TELEGRAM_BOT_TOKEN` is not set, import crashes.
**Why it happens:** grammY validates the token on construction. The singleton `config` proxy loads env vars on first access.
**How to avoid:** Always vi.mock the config module or set env vars BEFORE any import that transitively reaches bot.ts. Use dynamic imports in tests.
**Warning signs:** `Error: Expected a Bot Token` in test output.

### Pitfall 2: better-sqlite3 Native Addon + sqlite-vec Extension

**What goes wrong:** `db.ts` calls `sqliteVec.load(sqliteDb)` which loads a native extension. In test environments, this may fail if the native binary isn't available.
**Why it happens:** sqlite-vec is a C extension distributed as a prebuilt binary. CI environments need it installed.
**How to avoid:** For unit tests, use in-memory DB without vec extension (skip the `sqliteVec.load()` call). Mock the `getDb`/`getDrizzle` functions to return a test DB. Only load vec for dedicated semantic search integration tests.
**Warning signs:** `Error: Cannot find module 'sqlite-vec'` or segfaults.

### Pitfall 3: Singleton State Leaking Between Tests

**What goes wrong:** Tests pass individually but fail when run together. State from test A pollutes test B.
**Why it happens:** Multiple modules use module-level state: `gateway.ts` (queue, isProcessing), `db.ts` (sqliteDb singleton), `config/loader.ts` (\_config), `pairing/store.ts` (PairingStore instance), `heartbeat/scheduler.ts` (heartbeatInterval).
**How to avoid:** Use `vi.resetModules()` in `beforeEach` for stateful modules. Or structure tests to mock the entire module. Use Vitest's `--pool=forks` (default) for process isolation between test files.
**Warning signs:** Flaky tests, "already running" warnings, stale data assertions.

### Pitfall 4: ESM + vi.mock Hoisting Gotchas

**What goes wrong:** Mocks don't take effect; real module code runs instead.
**Why it happens:** `vi.mock()` is hoisted to top of file, but the factory function cannot reference variables declared in the same scope (they're undefined at hoist time).
**How to avoid:** Use `vi.hoisted()` to define values needed in mock factories. Or use `vi.mock(import('./path.js'))` async form.
**Warning signs:** "ReferenceError: Cannot access 'X' before initialization"

```typescript
// WRONG - mockValue not available at hoist time
const mockValue = "test";
vi.mock("./foo.js", () => ({ bar: mockValue })); // mockValue is undefined!

// RIGHT - use vi.hoisted
const { mockValue } = vi.hoisted(() => ({ mockValue: "test" }));
vi.mock("./foo.js", () => ({ bar: mockValue }));
```

### Pitfall 5: Forgetting to Handle Async in beforeAll/afterAll

**What goes wrong:** Database connections or file handles leak, causing warnings or hangs at test exit.
**Why it happens:** `better-sqlite3` keeps file handles open. If `close()` isn't called in `afterAll`, the process may hang.
**How to avoid:** Always close DB in `afterAll`. Use the `createTestDb()` helper which returns a `close` function.
**Warning signs:** Tests complete but process doesn't exit, or "open handles" warnings.

## Code Examples

### Example 1: Pure Logic Unit Test (parseSchedule)

```typescript
// tests/unit/cron/parse.test.ts
import { describe, it, expect } from "vitest";
import { parseSchedule } from "../../../src/cron/parse.js";

describe("parseSchedule", () => {
  it('parses "every 5 minutes"', () => {
    const result = parseSchedule("every 5 minutes");
    expect(result).not.toBeNull();
    expect(result!.schedule.kind).toBe("every");
    expect(result!.schedule.everyMs).toBe(5 * 60 * 1000);
    expect(result!.humanReadable).toBe("every 5 minutes");
  });

  it('parses "every day at 9am"', () => {
    const result = parseSchedule("every day at 9am");
    expect(result).not.toBeNull();
    expect(result!.schedule.kind).toBe("cron");
    expect(result!.schedule.expr).toBe("0 9 * * *");
  });

  it('parses cron expression "30 8 * * 1-5"', () => {
    const result = parseSchedule("30 8 * * 1-5");
    expect(result).not.toBeNull();
    expect(result!.schedule.kind).toBe("cron");
  });

  it("returns null for unparseable input", () => {
    expect(parseSchedule("gobbledygook")).toBeNull();
  });
});
```

### Example 2: Schedule Computation Test (computeNextRunAtMs)

```typescript
// tests/unit/cron/schedule.test.ts
import { describe, it, expect } from "vitest";
import { computeNextRunAtMs } from "../../../src/cron/schedule.js";

describe("computeNextRunAtMs", () => {
  it("returns null for past one-shot", () => {
    const result = computeNextRunAtMs({ kind: "at", atMs: 1000 }, 2000);
    expect(result).toBeNull();
  });

  it("returns future one-shot time", () => {
    const result = computeNextRunAtMs({ kind: "at", atMs: 5000 }, 2000);
    expect(result).toBe(5000);
  });

  it("calculates next interval from anchor", () => {
    const anchor = 1000;
    const every = 300_000; // 5 min
    const now = anchor + every + 1; // just past first tick
    const result = computeNextRunAtMs(
      { kind: "every", everyMs: every, anchorMs: anchor },
      now,
    );
    expect(result).toBe(anchor + 2 * every);
  });
});
```

### Example 3: MessageQueue Unit Test (with Temp Dir)

```typescript
// tests/unit/daemon/queue.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Must mock logger before importing queue
vi.mock("../../../src/utils/logger.js", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { MessageQueue } from "../../../src/daemon/queue.js";

describe("MessageQueue", () => {
  let tmpDir: string;
  let queue: MessageQueue;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "klausbot-test-"));
    queue = new MessageQueue(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds and takes messages", () => {
    const id = queue.add(12345, "hello");
    const msg = queue.take();
    expect(msg).toBeDefined();
    expect(msg!.id).toBe(id);
    expect(msg!.text).toBe("hello");
    expect(msg!.status).toBe("processing");
  });

  it("returns undefined when empty", () => {
    expect(queue.take()).toBeUndefined();
  });

  it("tracks stats correctly", () => {
    queue.add(1, "a");
    queue.add(1, "b");
    const msg = queue.take();
    queue.complete(msg!.id);
    const stats = queue.getStats();
    expect(stats.pending).toBe(1);
    expect(stats.processing).toBe(0);
  });
});
```

### Example 4: Markdown to Telegram HTML Test

````typescript
// tests/unit/utils/telegram-html.test.ts
import { describe, it, expect } from "vitest";
import {
  markdownToTelegramHtml,
  splitTelegramMessage,
  escapeHtml,
} from "../../../src/utils/telegram-html.js";

describe("markdownToTelegramHtml", () => {
  it("converts bold", () => {
    expect(markdownToTelegramHtml("**bold**")).toContain("<b>bold</b>");
  });

  it("converts code blocks", () => {
    const result = markdownToTelegramHtml("```js\nconsole.log(1)\n```");
    expect(result).toContain("<pre><code");
    expect(result).toContain("console.log(1)");
  });

  it("escapes HTML entities in text", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });
});

describe("splitTelegramMessage", () => {
  it("returns single chunk for short text", () => {
    expect(splitTelegramMessage("short", 4096)).toEqual(["short"]);
  });

  it("splits at paragraph boundary", () => {
    const text = "a".repeat(2000) + "\n\n" + "b".repeat(2000);
    const chunks = splitTelegramMessage(text, 4096);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
````

### Example 5: GitHub Actions CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test -- --run --coverage
```

## State of the Art

| Old Approach                     | Current Approach               | When Changed           | Impact                                 |
| -------------------------------- | ------------------------------ | ---------------------- | -------------------------------------- |
| Jest + ts-jest + ESM hacks       | Vitest (native ESM + TS)       | 2023-2024              | No transform config, faster startup    |
| istanbul coverage                | v8 coverage with AST remapping | Vitest 3.x (late 2024) | v8 now as accurate as istanbul, faster |
| Manual mock files (`__mocks__/`) | vi.mock with factory functions | Vitest 1.x+            | Inline, colocated, type-safe           |
| Separate test/build configs      | Vitest reuses Vite transform   | 2023+                  | Zero config for TS projects            |

**Deprecated/outdated:**

- `ts-jest`: Not needed with Vitest; adds complexity for ESM projects
- `@types/jest`: Vitest has its own type definitions via `vitest/globals`
- `jest.config.js` with `transform` section: Not applicable to Vitest

## Testability Assessment by Module

| Module                    | Testability                                | Mocking Needed           | Priority           |
| ------------------------- | ------------------------------------------ | ------------------------ | ------------------ |
| `cron/parse.ts`           | HIGH (pure functions)                      | None                     | P0                 |
| `cron/schedule.ts`        | HIGH (pure functions, accepts nowMs param) | None                     | P0                 |
| `utils/telegram-html.ts`  | HIGH (pure functions)                      | None                     | P0                 |
| `utils/split.ts`          | HIGH (pure functions)                      | None                     | P0                 |
| `config/schema.ts`        | HIGH (Zod schemas, pure validation)        | None                     | P0                 |
| `daemon/queue.ts`         | MEDIUM (filesystem, but temp-dir friendly) | Logger                   | P0                 |
| `pairing/store.ts`        | MEDIUM (filesystem, JSON persistence)      | Logger, home path        | P1                 |
| `memory/conversations.ts` | MEDIUM (DB, but mockable with in-memory)   | DB singleton             | P1                 |
| `memory/context.ts`       | MEDIUM (depends on conversations + FS)     | DB, filesystem           | P1                 |
| `cron/store.ts`           | MEDIUM (JSON file, atomic writes)          | Home path                | P1                 |
| `cron/executor.ts`        | LOW (calls queryClaudeCode + bot.api)      | Spawner, bot             | P2                 |
| `daemon/spawner.ts`       | LOW (spawns child process)                 | child_process            | P2 (mock boundary) |
| `daemon/gateway.ts`       | LOW (orchestrator, many deps)              | Everything               | P2 (E2E only)      |
| `heartbeat/scheduler.ts`  | LOW (timers + many deps)                   | Config, gateway, pairing | P2                 |
| `telegram/bot.ts`         | LOW (immediate side effects on import)     | Config env vars          | P2 (mock only)     |

## Open Questions

1. **sqlite-vec in CI**
   - What we know: sqlite-vec is a native C extension loaded via `sqliteVec.load(db)`. It works locally.
   - What's unclear: Whether the `sqlite-vec` npm package includes prebuilt binaries for `ubuntu-latest` GitHub Actions runners.
   - Recommendation: Skip vec-dependent tests in initial CI. Add a separate integration test job later if needed. Most tests can mock the search layer.

2. **Coverage thresholds**
   - What we know: Starting from zero coverage. Aggressive thresholds will block PRs unnecessarily.
   - What's unclear: What realistic coverage target is achievable in Phase 14.
   - Recommendation: Start at 40% statement coverage. The pure-function modules alone should push past this. Ratchet up after initial suite is stable.

3. **E2E test scope**
   - What we know: Requirements mention "E2E tests cover critical flows (onboard, message handling, cron execution)."
   - What's unclear: How deep E2E should go. True E2E would need Claude CLI + Telegram API.
   - Recommendation: "E2E" here means integration tests that exercise multiple modules together with mocked external boundaries (Claude CLI, Telegram API). Not live service tests.

## Sources

### Primary (HIGH confidence)

- Vitest Getting Started: https://vitest.dev/guide/
- Vitest Mocking Guide: https://vitest.dev/guide/mocking
- Vitest Coverage Guide: https://vitest.dev/guide/coverage
- Vitest Configuration: https://vitest.dev/config/
- Direct codebase inspection (all source files read)

### Secondary (MEDIUM confidence)

- grammY transformer testing pattern: https://github.com/PavloPoliakov/grammy-with-tests
- GitHub Actions CI with Vitest: https://stevekinney.com/courses/testing/continuous-integration
- Vitest child_process mocking discussion: https://github.com/vitest-dev/vitest/discussions/2075

### Tertiary (LOW confidence)

- grammy_tests (Deno-only, not usable): https://github.com/dcdunkan/grammy_tests
- v8 vs istanbul coverage comparison: https://dev.to/stevez/v8-coverage-vs-istanbul-performance-and-accuracy-3ei8

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Vitest is the clear choice for ESM+TS Node projects; no viable contender
- Architecture: HIGH - Based on direct codebase analysis of all 70+ source files and their dependencies
- Pitfalls: HIGH - Identified from actual code patterns (singleton state, import side effects, native extensions)
- Code examples: HIGH - Written against actual module signatures from source inspection

**Research date:** 2026-02-07
**Valid until:** 2026-03-09 (stable domain, 30 days)
