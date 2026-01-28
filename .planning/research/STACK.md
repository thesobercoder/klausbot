# Technology Stack

**Project:** klausbot
**Researched:** 2026-01-28
**Focus:** Telegram bot wrapping Claude Code as backend

---

## Recommended Stack

### Runtime & Language

| Technology | Version  | Purpose      | Why                                                                                                                                    | Confidence |
| ---------- | -------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Node.js    | 24.x LTS | Runtime      | Current LTS (Krypton). Built-in SQLite, enhanced security via OpenSSL 3.5, V8 updates. Entered LTS Oct 2025, supported until Apr 2028. | HIGH       |
| TypeScript | 5.9.x    | Type safety  | Current stable. Essential for maintainability in file-based systems with complex state.                                                | HIGH       |
| tsx        | 4.21.x   | TS execution | Zero-config TypeScript execution. Replaces ts-node with faster esbuild-based transpilation. Native ESM support.                        | HIGH       |

### Telegram Integration

| Technology | Version | Purpose                | Why                                                                                                                                         | Confidence |
| ---------- | ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| grammY     | 1.39.x  | Telegram bot framework | **Use this.** TypeScript-first design, latest Bot API 9.3 support (Dec 2025), superior documentation, active maintenance, plugin ecosystem. | HIGH       |

**Why not Telegraf?**

- Telegraf 4.16.x supports only Bot API 7.1 (lags behind)
- TypeScript types described as "complex and hard to understand" (per grammY comparison)
- grammY was built TypeScript-first; Telegraf was retrofitted
- grammY has better docs and learning resources

Source: [grammY comparison](https://grammy.dev/resources/comparison), [grammY docs](https://grammy.dev/)

### Claude Code Integration

| Technology            | Version | Purpose          | Why                                                                                                                                               | Confidence |
| --------------------- | ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Claude Code CLI       | latest  | AI backend       | Direct CLI spawning via `-p` flag with `--output-format json`. No SDK needed; subprocess model gives clean process isolation.                     | HIGH       |
| Node.js child_process | native  | Process spawning | Use `spawn()` with promise wrapper. Native solution avoids deps. Alternatively: `spawn-async` or `promisify-child-process` if cleaner API needed. | HIGH       |

**Key CLI Flags for Automation:**

```bash
claude -p "prompt" \
  --output-format json \
  --dangerously-skip-permissions \  # Only in sandboxed VM
  --max-turns 10 \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep"
```

**Session Management:**

- `--session-id UUID` for deterministic session IDs
- `-c` / `--continue` for resuming sessions
- `-r session-name` for named sessions
- `--no-session-persistence` for ephemeral queries

Source: [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)

### Data Storage

| Technology     | Version      | Purpose         | Why                                                                                                                                     | Confidence |
| -------------- | ------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| node:sqlite    | native (v24) | Structured data | Built-in since Node 24. Stability 1.1 (Active Dev). Sync API only but sufficient for bot workloads. No deps, no native compilation.     | MEDIUM     |
| Markdown files | -            | Memory system   | Human-readable, git-friendly, diff-able. Aligns with RLM-inspired memory (MEMORY.md, daily notes). Claude Code can read/write natively. | HIGH       |

**Storage Strategy:**

- **SQLite**: Sessions, user prefs, task queue, cron schedules
- **Markdown**: Identity files (SOUL.md, IDENTITY.md, USER.md), daily notes, memory distillation
- **JSON**: Ephemeral state, skill definitions, temporary caches

**Alternative:** `better-sqlite3` v12.6.x if native node:sqlite proves too limiting (async needs, WAL mode, etc.)

Source: [Node.js SQLite docs](https://nodejs.org/api/sqlite.html)

### Scheduling

| Technology | Version | Purpose         | Why                                                                                              | Confidence |
| ---------- | ------- | --------------- | ------------------------------------------------------------------------------------------------ | ---------- |
| node-cron  | 4.2.x   | Task scheduling | Lightweight, zero deps (practically). Pure JS cron syntax. Sufficient for in-process scheduling. | HIGH       |

**Why not alternatives?**

- `cron` package: Has external deps, no advantage
- `agenda`/`bree`: Overkill (require MongoDB/Redis) for single-node bot
- System cron: Harder to manage programmatically; node-cron keeps scheduling in-process

**Note:** node-cron has no persistence. If bot restarts, schedules must be reloaded from SQLite.

Source: [node-cron npm](https://www.npmjs.com/package/node-cron), [Better Stack comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/)

### Process Management

| Technology | Version        | Purpose               | Why                                                                                                    | Confidence |
| ---------- | -------------- | --------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| systemd    | native         | Process supervision   | Already available in VM. Handles restarts, logging, boot startup. Lighter than PM2 for single-process. | MEDIUM     |
| PM2        | 5.x (optional) | Advanced process mgmt | Use if clustering, monitoring dashboard, or log rotation needed. Otherwise systemd sufficient.         | LOW        |

**Recommended:** Start with systemd unit file. Add PM2 later only if monitoring/scaling needed.

### Validation

| Technology | Version | Purpose           | Why                                                                                                               | Confidence |
| ---------- | ------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| zod        | 4.3.x   | Schema validation | Runtime type validation for configs, API responses, Claude output parsing. TypeScript inference. Standard choice. | HIGH       |

### Dev Dependencies

| Technology  | Version | Purpose        | Confidence |
| ----------- | ------- | -------------- | ---------- |
| @types/node | 25.x    | Node type defs | HIGH       |
| vitest      | latest  | Testing        | HIGH       |
| eslint      | 9.x     | Linting        | HIGH       |
| prettier    | 3.x     | Formatting     | HIGH       |

---

## Alternatives Considered

| Category  | Recommended | Alternative    | Why Not                                                                              |
| --------- | ----------- | -------------- | ------------------------------------------------------------------------------------ |
| Telegram  | grammY      | Telegraf       | Lags behind Bot API, weaker TS types, retrofitted not native                         |
| Telegram  | grammY      | GramIO         | Newer, less ecosystem, less proven                                                   |
| Claude    | CLI spawn   | Anthropic SDK  | SDK is for API calls; CLI gives full Claude Code capabilities (file ops, bash, etc.) |
| SQLite    | node:sqlite | better-sqlite3 | Native reduces deps; upgrade if async/WAL needed                                     |
| SQLite    | node:sqlite | lowdb          | JSON-based, poor for concurrent access                                               |
| Scheduler | node-cron   | BullMQ         | Needs Redis, overkill for single-node                                                |
| Process   | systemd     | PM2            | Additional dependency when systemd suffices                                          |

---

## Installation

```bash
# Core dependencies
npm install grammy zod node-cron

# Dev dependencies
npm install -D typescript tsx @types/node vitest eslint prettier

# Optional (if native sqlite insufficient)
# npm install better-sqlite3
# npm install -D @types/better-sqlite3
```

### tsconfig.json essentials

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### package.json scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node --env-file=.env dist/index.js",
    "build": "tsc",
    "test": "vitest"
  }
}
```

---

## Architecture Implications

### Claude Code Spawning Pattern

```typescript
import { spawn } from "child_process";

interface ClaudeResponse {
  result: string;
  cost_usd: number;
  session_id: string;
}

async function queryClaudeCode(
  prompt: string,
  sessionId?: string,
): Promise<ClaudeResponse> {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--dangerously-skip-permissions",
  ];

  if (sessionId) {
    args.push("--session-id", sessionId);
  }

  return new Promise((resolve, reject) => {
    const claude = spawn("claude", args);
    let stdout = "";
    let stderr = "";

    claude.stdout.on("data", (data) => {
      stdout += data;
    });
    claude.stderr.on("data", (data) => {
      stderr += data;
    });

    claude.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Claude exited ${code}: ${stderr}`));
      } else {
        resolve(JSON.parse(stdout));
      }
    });
  });
}
```

### Memory File Structure

```
.memory/
  SOUL.md           # Bot's core identity (rarely changes)
  IDENTITY.md       # Personality, voice, behaviors
  USER.md           # User-specific preferences
  daily/
    2026-01-28.md   # Today's running context
    2026-01-27.md   # Yesterday (auto-loaded)
  MEMORY.md         # Distilled long-term knowledge
```

### Telegram + Claude Flow

```
User Message
    |
    v
grammY Handler
    |
    +--> Load context (SOUL.md, IDENTITY.md, USER.md, daily notes)
    |
    v
Build prompt with context
    |
    v
Spawn Claude Code session
    |
    v
Parse JSON response
    |
    +--> Update daily notes
    |
    v
Send response via grammY
```

---

## Security Considerations

1. **Telegram has no E2E encryption with bots** - All messages pass through Telegram servers
2. **Sandbox Claude Code** - Use `--dangerously-skip-permissions` ONLY in isolated VM
3. **Rate limit users** - Prevent abuse via grammY's built-in rate limiting or custom middleware
4. **Validate all inputs** - Use zod for message validation before passing to Claude
5. **Whitelist allowed tools** - Use `--allowedTools` to restrict Claude's capabilities

---

## Version Verification Sources

| Package        | Verified Version | Source                                                               |
| -------------- | ---------------- | -------------------------------------------------------------------- |
| Node.js 24 LTS | 24.11.0+         | [nodejs.org releases](https://nodejs.org/en/about/previous-releases) |
| grammY         | 1.39.3           | npm registry (verified 2026-01-28)                                   |
| Telegraf       | 4.16.3           | npm registry (verified 2026-01-28)                                   |
| TypeScript     | 5.9.3            | npm registry (verified 2026-01-28)                                   |
| tsx            | 4.21.0           | npm registry (verified 2026-01-28)                                   |
| node-cron      | 4.2.1            | npm registry (verified 2026-01-28)                                   |
| zod            | 4.3.6            | npm registry (verified 2026-01-28)                                   |
| better-sqlite3 | 12.6.2           | npm registry (verified 2026-01-28)                                   |
| node:sqlite    | native           | Node.js 24+ (Stability 1.1)                                          |

---

## What NOT to Use

| Technology                    | Why Avoid                                                |
| ----------------------------- | -------------------------------------------------------- |
| Telegraf                      | Behind on Bot API, weaker TypeScript                     |
| node-telegram-bot-api         | Callback-based, outdated patterns                        |
| Anthropic SDK directly        | Gives API access, not Claude Code's full toolset         |
| MongoDB/Redis for persistence | Overkill for single-node bot                             |
| Docker for dev                | Adds complexity; systemd in VM is simpler                |
| Express/Fastify for webhooks  | Polling is simpler for personal bot; add later if needed |

---

## Open Questions

1. **Native SQLite stability** - node:sqlite is Stability 1.1. May need fallback to better-sqlite3 if issues arise.
2. **Claude Code rate limits** - Need to verify if CLI has different limits than API; may need queue for burst protection.
3. **Session persistence across restarts** - Claude Code sessions persist by default; need to verify behavior with `--session-id`.
