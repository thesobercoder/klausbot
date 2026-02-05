# Phase 2: Core Loop - Research

**Researched:** 2026-01-29
**Domain:** Session context injection, agentic file retrieval, conversation persistence, identity files, spawner modifications
**Confidence:** HIGH (verified via Claude Code official docs + Phase 1 patterns)

## Summary

Phase 2 transforms klausbot from a simple Claude Code proxy into a context-aware assistant with file-based memory. Research validates that Claude Code's `--append-system-prompt` flag (works in print mode) is the correct mechanism for injecting identity context and retrieval instructions. The `cwd` option in Node.js `spawn()` enables running Claude with `~/.klausbot/` as working directory.

Key finding: Claude Code has no `--cwd` CLI flag, but Node.js `spawn()` accepts a `cwd` option in its third argument. Combined with `--append-system-prompt`, this enables the session bootstrap pattern where identity files are loaded and Claude is instructed to agentically retrieve conversation history via its built-in `Read`, `Grep`, and `Glob` tools.

Conversation storage as daily markdown files (`conversations/2026-01-29.md`) aligns with Claude's native strengths - it can grep/read these files directly without custom tooling. The `[!important]` marker pattern is greppable and simple.

**Primary recommendation:** Modify spawner to use `cwd: homedir/.klausbot/` and `--append-system-prompt` to inject identity content + retrieval instructions. Create identity files on first run. Log conversations with timestamp, role, content in markdown. Trust Claude's agentic retrieval over building custom search.

## Standard Stack

### Core (No New Dependencies)

Phase 2 uses existing Phase 1 stack. No new libraries required.

| Library       | Version  | Purpose                    | Notes                              |
| ------------- | -------- | -------------------------- | ---------------------------------- |
| Node.js spawn | built-in | Process spawning with cwd  | `spawn()` accepts `cwd` in options |
| fs module     | built-in | File I/O for conversations | writeFileSync/appendFileSync       |
| path module   | built-in | Path resolution            | join, homedir                      |
| os module     | built-in | Home directory             | `homedir()` for `~/.klausbot/`     |

### Supporting (Already Installed)

| Library | Version | Purpose            | Reuse From |
| ------- | ------- | ------------------ | ---------- |
| pino    | 9.x     | Structured logging | Phase 1    |
| zod     | 3.x     | Config validation  | Phase 1    |

### No New Dependencies

**Rationale:**

- Claude Code provides all retrieval tools (Read, Grep, Glob)
- File operations use Node.js built-ins
- No embedding infrastructure per CONTEXT.md decision
- Markdown format requires no parsing library for write operations

## Architecture Patterns

### Recommended Directory Structure

```
~/.klausbot/
  config/
    config.json           # Gateway configuration (migrated from DATA_DIR)
    pairing.json          # Approved users (migrated)
    queue.json            # Message queue (migrated)
  conversations/
    2026-01-29.md         # One file per day
    2026-01-28.md
  identity/
    SOUL.md               # Core values and boundaries
    IDENTITY.md           # Personality, name, style
    USER.md               # Learned user preferences
```

### Pattern 1: Spawner with Working Directory + System Prompt

**What:** Spawn Claude Code with `cwd` set to `~/.klausbot/` and append system prompt for context injection.

**Source:** [Node.js child_process docs](https://nodejs.org/api/child_process.html), [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)

**Example:**

```typescript
import { spawn } from "child_process";
import { homedir } from "os";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const KLAUSBOT_HOME = join(homedir(), ".klausbot");

interface SpawnerOptions {
  timeout?: number;
  model?: string;
}

function buildSystemPrompt(): string {
  const identityDir = join(KLAUSBOT_HOME, "identity");
  const parts: string[] = [];

  // Load identity files if they exist
  const files = ["SOUL.md", "IDENTITY.md", "USER.md"];
  for (const file of files) {
    const filePath = join(identityDir, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8");
      parts.push(`<${file}>\n${content}\n</${file}>`);
    }
  }

  // Add retrieval instructions
  const today = new Date().toISOString().split("T")[0];
  parts.push(`
<instructions>
## Memory System

Your working directory is ~/.klausbot/ which contains:
- conversations/{date}.md - Daily conversation logs (e.g., conversations/${today}.md for today)
- identity/ - Your identity files (SOUL.md, IDENTITY.md, USER.md)

### Before responding:
1. Read today's conversation file to understand recent context
2. If the user refers to past events, use Grep/Glob to search conversation files
3. Filename format is YYYY-MM-DD.md (e.g., "yesterday" = previous date's file)

### During conversation:
- If you learn user preferences, update identity/USER.md
- Mark important messages with [!important] for later retrieval

### Retrieval tips:
- Use Grep for keyword search across all conversations
- Use Glob to list available conversation files
- Search for [!important] to find pinned messages
</instructions>`);

  return parts.join("\n\n");
}

async function queryClaudeCode(
  userMessage: string,
  options: SpawnerOptions = {},
): Promise<ClaudeResponse> {
  const systemPrompt = buildSystemPrompt();

  return new Promise((resolve, reject) => {
    const args = [
      "--dangerously-skip-permissions",
      "-p",
      userMessage,
      "--output-format",
      "json",
      "--append-system-prompt",
      systemPrompt,
    ];

    if (options.model) {
      args.push("--model", options.model);
    }

    const claude = spawn("claude", args, {
      stdio: ["inherit", "pipe", "pipe"], // CRITICAL: stdin inherits (Phase 1 bug)
      cwd: KLAUSBOT_HOME, // Working directory for agentic file access
      env: process.env,
    });

    // ... rest of spawn handling from Phase 1
  });
}
```

**Confidence:** HIGH - verified via official Claude Code docs and Node.js spawn documentation.

### Pattern 2: Conversation Logging Format

**What:** Markdown format for daily conversation files.

**Rationale:** Human-readable, grep-friendly, editable by both human and Claude.

**Example format:**

```markdown
# Conversation Log - 2026-01-29

## 09:15:23

**User:**
What did we discuss about the project architecture yesterday?

**Assistant:**
Based on yesterday's conversation, we discussed three main architectural decisions:

1. Using a message queue for async processing
2. File-based persistence instead of SQLite
3. The pairing flow for security

[!important] User prefers simple file-based solutions over databases.

---

## 09:17:45

**User:**
Great, let's implement the queue today.

**Assistant:**
I'll start implementing the message queue. Based on our discussion, I'll use a JSON file for persistence since you prefer file-based solutions.

---
```

**Implementation:**

```typescript
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const KLAUSBOT_HOME = join(homedir(), ".klausbot");

function getConversationPath(): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return join(KLAUSBOT_HOME, "conversations", `${date}.md`);
}

function formatTime(): string {
  return new Date().toTimeString().split(" ")[0]; // HH:MM:SS
}

function ensureConversationFile(): string {
  const convDir = join(KLAUSBOT_HOME, "conversations");
  if (!existsSync(convDir)) {
    mkdirSync(convDir, { recursive: true });
  }

  const filePath = getConversationPath();
  if (!existsSync(filePath)) {
    const date = new Date().toISOString().split("T")[0];
    appendFileSync(filePath, `# Conversation Log - ${date}\n\n`);
  }

  return filePath;
}

function logConversation(role: "user" | "assistant", content: string): void {
  const filePath = ensureConversationFile();
  const time = formatTime();
  const roleLabel = role === "user" ? "User" : "Assistant";

  const entry = `## ${time}\n\n**${roleLabel}:**\n${content}\n\n---\n\n`;
  appendFileSync(filePath, entry);
}
```

**Confidence:** HIGH - simple file operations, format designed for grep/read.

### Pattern 3: Identity File Initialization

**What:** Create default identity files on first run.

**Example:**

```typescript
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const DEFAULT_SOUL = `# SOUL

## Core Identity

I am Klaus, a personal assistant who values:
- Clarity and directness in communication
- Learning from interactions to improve over time
- Respecting user preferences and context
- Being helpful without being intrusive

## Values

- I adapt my communication style to match user preferences
- I remember context across conversations
- I ask for clarification when uncertain
- I proactively share relevant information from past discussions

## Boundaries

- I only access files within my designated memory directory
- I respect user privacy and do not share information externally
- I acknowledge when I don't know something
`;

const DEFAULT_IDENTITY = `# IDENTITY

## Name
Klaus

## Personality
- Helpful and attentive
- Concise but thorough
- Proactive about relevant context

## Communication Style
- Direct and clear
- Adapts to user's preferred formality level
- Uses markdown formatting when helpful
`;

const DEFAULT_USER = `# USER

## Preferences

(To be learned through conversation)

## Context

(User-specific context will be added here)

## Notes

(Additional observations about user preferences)
`;

function initializeIdentity(): void {
  const identityDir = join(KLAUSBOT_HOME, "identity");

  if (!existsSync(identityDir)) {
    mkdirSync(identityDir, { recursive: true });
  }

  const defaults: Record<string, string> = {
    "SOUL.md": DEFAULT_SOUL,
    "IDENTITY.md": DEFAULT_IDENTITY,
    "USER.md": DEFAULT_USER,
  };

  for (const [filename, content] of Object.entries(defaults)) {
    const filePath = join(identityDir, filename);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content);
    }
  }
}
```

**Confidence:** HIGH - straightforward file creation.

### Pattern 4: Guidance Stripping from Logs

**What:** Log only the user's actual message, not the injected guidance.

**Rationale:** From CONTEXT.md: "Guidance stripped from conversation log (only user's actual message saved)"

**Implementation:**

```typescript
// In gateway.ts processMessage()

async function processMessage(msg: QueuedMessage): Promise<void> {
  // Log user's original message (NOT the system-prompted version)
  logConversation("user", msg.text);

  // Build full prompt with system context (Claude sees this)
  const response = await queryClaudeCode(msg.text);

  // Log Claude's response
  logConversation("assistant", response.result);

  // ... rest of processing
}
```

**Note:** The system prompt is passed via `--append-system-prompt`, not prepended to the user message, so no explicit stripping needed.

**Confidence:** HIGH - natural separation due to CLI flag design.

### Pattern 5: CLI Subcommand Pattern

**What:** Refactor CLI from single entry to subcommand pattern.

**Source:** CONTEXT.md decision: "Subcommand pattern: `klausbot gateway`, `klausbot pair`, etc."

**Example:**

```typescript
// src/index.ts
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "gateway"; // Default to gateway

  switch (command) {
    case "gateway":
      const { startGateway } = await import("./daemon/gateway.js");
      await startGateway();
      break;

    case "pair":
    case "pairing":
      await handlePairing(args.slice(1));
      break;

    case "init":
      await initializeKlausbot();
      break;

    case "version":
    case "--version":
    case "-v":
      console.log(`klausbot v${getVersion()}`);
      break;

    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
klausbot - Personal assistant gateway

Commands:
  klausbot gateway              Start the gateway daemon (default)
  klausbot pair approve <code>  Approve pairing request
  klausbot pair reject <code>   Reject pairing request
  klausbot pair list            List pending/approved users
  klausbot pair revoke <chatId> Revoke user access
  klausbot init                 Initialize ~/.klausbot/ directory
  klausbot help                 Show this help
  klausbot version              Show version

Environment:
  TELEGRAM_BOT_TOKEN  Telegram bot token (required)
  LOG_LEVEL           Log level (default: info)
`);
}
```

**Confidence:** HIGH - simple switch-based dispatch, already partially implemented in Phase 1.

### Anti-Patterns to Avoid

- **Stuffing full conversation history in prompt:** Use `--append-system-prompt` for instructions only, let Claude read files agentically
- **Building custom search/retrieval:** Trust Claude's Grep/Glob tools
- **UTC dates without consideration:** Use local timezone for filename to match user's "yesterday"
- **Modifying system prompt per message:** Keep same guidance every session (per CONTEXT.md)
- **Complex markdown parsing:** Keep format simple for grep compatibility

## Don't Hand-Roll

| Problem           | Don't Build          | Use Instead                  | Why                                     |
| ----------------- | -------------------- | ---------------------------- | --------------------------------------- |
| File search       | Custom search index  | Claude's Grep tool           | Claude optimizes retrieval naturally    |
| Date parsing      | Complex date library | ISO string split             | `date.toISOString().split('T')[0]`      |
| Config migration  | Manual file copy     | ensureDataDir with migration | Handles both old and new locations      |
| Prompt templating | String interpolation | Simple template literals     | Keep prompts readable, avoid complexity |
| Embedding search  | Vector DB            | Grep + keywords              | CONTEXT.md defers embeddings            |

**Key insight:** Phase 2's power comes from Claude's native agentic capabilities, not custom tooling. The less we build, the more we leverage Claude's strengths.

## Common Pitfalls

### Pitfall 1: Working Directory Not Set

**What goes wrong:** Claude can't find conversation/identity files.
**Why it happens:** Forgot to set `cwd` in spawn options.
**How to avoid:** Always pass `cwd: KLAUSBOT_HOME` to spawn().
**Warning signs:** "File not found" errors in Claude's output, empty context.

### Pitfall 2: System Prompt Too Long

**What goes wrong:** Identity content + instructions exceed token limits or degrade performance.
**Why it happens:** Loading verbose identity files into every prompt.
**How to avoid:** Keep identity files concise. Use progressive disclosure - Claude can read more detail from files if needed.
**Warning signs:** Slow responses, Claude ignoring instructions, high token costs.

### Pitfall 3: Date Format Mismatch

**What goes wrong:** Claude can't find "yesterday's" conversation.
**Why it happens:** Using UTC dates but user expects local time.
**How to avoid:** Use local date for filenames: `new Date().toLocaleDateString('en-CA')` returns YYYY-MM-DD in local timezone.
**Warning signs:** "No conversations found" when user knows they chatted.

### Pitfall 4: Not Initializing Directory

**What goes wrong:** First run fails because ~/.klausbot/ doesn't exist.
**Why it happens:** No initialization step before spawning Claude.
**How to avoid:** Call ensureDataDir() and initializeIdentity() at gateway startup.
**Warning signs:** ENOENT errors on first run.

### Pitfall 5: Logging Injected Context

**What goes wrong:** Conversation logs contain system prompts and instructions.
**Why it happens:** Logging the full prompt instead of user's original message.
**How to avoid:** Log `msg.text` before calling queryClaudeCode(), not the constructed prompt.
**Warning signs:** Conversation files full of repeated instructions.

### Pitfall 6: Blocking on Large Files

**What goes wrong:** Gateway hangs when reading large identity files.
**Why it happens:** Using sync file reads in hot path.
**How to avoid:** Read identity files once at startup, cache content. Re-read only on explicit reload.
**Warning signs:** Slow response times, blocking on file I/O.

## Code Examples

### Complete Session Bootstrap

```typescript
// Source: Combined from Claude Code docs + Node.js spawn

import { spawn } from "child_process";
import { homedir } from "os";
import { join } from "path";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  appendFileSync,
} from "fs";

const KLAUSBOT_HOME = join(homedir(), ".klausbot");

// Cache identity content at startup
let identityCache: string | null = null;

export function loadIdentity(): string {
  if (identityCache) return identityCache;

  const identityDir = join(KLAUSBOT_HOME, "identity");
  const parts: string[] = [];

  for (const file of ["SOUL.md", "IDENTITY.md", "USER.md"]) {
    const path = join(identityDir, file);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      parts.push(`<${file}>\n${content}\n</${file}>`);
    }
  }

  identityCache = parts.join("\n\n");
  return identityCache;
}

export function getRetrievalInstructions(): string {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
  return `
<memory-instructions>
Working directory: ~/.klausbot/

## Files Available
- conversations/${today}.md - Today's conversation
- conversations/*.md - Past conversations (YYYY-MM-DD.md format)
- identity/USER.md - User preferences (you can update this)

## Retrieval Workflow
1. Read today's conversation file before responding
2. For "yesterday" references, calculate the date and read that file
3. Use Grep to search keywords across all conversations
4. Search for [!important] markers for pinned messages

## Preference Learning
When user states a preference, update identity/USER.md with:
- What the preference is
- When you learned it
- Any relevant context
</memory-instructions>`;
}

export function buildSystemPrompt(): string {
  return loadIdentity() + "\n\n" + getRetrievalInstructions();
}
```

### Conversation Logger Module

```typescript
// src/memory/logger.ts

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const KLAUSBOT_HOME = join(homedir(), ".klausbot");
const CONVERSATIONS_DIR = join(KLAUSBOT_HOME, "conversations");

function getToday(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
}

function getTime(): string {
  return new Date().toLocaleTimeString("en-GB"); // HH:MM:SS
}

function ensureConversationsDir(): void {
  if (!existsSync(CONVERSATIONS_DIR)) {
    mkdirSync(CONVERSATIONS_DIR, { recursive: true });
  }
}

function getConversationPath(): string {
  return join(CONVERSATIONS_DIR, `${getToday()}.md`);
}

function ensureConversationFile(): string {
  ensureConversationsDir();
  const path = getConversationPath();

  if (!existsSync(path)) {
    appendFileSync(path, `# Conversation Log - ${getToday()}\n\n`);
  }

  return path;
}

export function logUserMessage(content: string): void {
  const path = ensureConversationFile();
  const entry = `## ${getTime()}\n\n**User:**\n${content}\n\n---\n\n`;
  appendFileSync(path, entry);
}

export function logAssistantMessage(content: string): void {
  const path = ensureConversationFile();
  const entry = `## ${getTime()}\n\n**Assistant:**\n${content}\n\n---\n\n`;
  appendFileSync(path, entry);
}
```

### Data Directory Initialization

```typescript
// src/memory/init.ts

import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { Logger } from "pino";

const KLAUSBOT_HOME = join(homedir(), ".klausbot");

const DIRS = ["config", "conversations", "identity"];

const DEFAULT_IDENTITY = {
  "SOUL.md": `# SOUL

## Core Values

I am Klaus, a helpful personal assistant who:
- Remembers context from past conversations
- Learns and respects user preferences
- Communicates clearly and directly
- Asks for clarification when needed

## Principles

- I proactively use past context when relevant
- I adapt my communication style to user preferences
- I acknowledge uncertainty honestly
- I respect boundaries and privacy
`,

  "IDENTITY.md": `# IDENTITY

## Name
Klaus

## Style
- Concise but thorough
- Friendly but professional
- Proactive about helpful context
`,

  "USER.md": `# USER

## Preferences
(Learned through conversation)

## Context
(User-specific information)

## Notes
(Additional observations)
`,
};

export function initializeKlausbotHome(logger: Logger): void {
  // Create directories
  for (const dir of DIRS) {
    const path = join(KLAUSBOT_HOME, dir);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      logger.info({ path }, "Created directory");
    }
  }

  // Create identity files if missing
  for (const [filename, content] of Object.entries(DEFAULT_IDENTITY)) {
    const path = join(KLAUSBOT_HOME, "identity", filename);
    if (!existsSync(path)) {
      writeFileSync(path, content);
      logger.info({ path }, "Created identity file");
    }
  }

  logger.info({ home: KLAUSBOT_HOME }, "Klausbot home initialized");
}

export function migrateFromDataDir(oldDataDir: string, logger: Logger): void {
  // Migrate config files from old DATA_DIR to new location
  const migrations = [
    { from: "pairing.json", to: "config/pairing.json" },
    { from: "queue.json", to: "config/queue.json" },
  ];

  for (const { from, to } of migrations) {
    const oldPath = join(oldDataDir, from);
    const newPath = join(KLAUSBOT_HOME, to);

    if (existsSync(oldPath) && !existsSync(newPath)) {
      copyFileSync(oldPath, newPath);
      logger.info({ from: oldPath, to: newPath }, "Migrated file");
    }
  }
}
```

## State of the Art

| Old Approach              | Current Approach        | When Changed     | Impact                                        |
| ------------------------- | ----------------------- | ---------------- | --------------------------------------------- |
| Full history in context   | Agentic file retrieval  | RLM paper (2024) | Infinite memory without context bloat         |
| Vector embeddings         | Grep + keyword search   | Simplified       | No infrastructure, Claude optimizes naturally |
| --system-prompt (replace) | --append-system-prompt  | Claude Code 2.x  | Keep default behaviors, add custom            |
| Custom search tools       | Claude's built-in tools | Always           | Let Claude decide how to search               |
| Complex identity schemas  | Simple markdown files   | moltbot pattern  | Human-editable, git-trackable                 |

**Current best practices:**

- Use `--append-system-prompt` not `--system-prompt` (preserves Claude's defaults)
- Keep system prompt concise - load detailed content from files
- Trust Claude's agentic capabilities over building custom tools
- Local timezone dates for user-facing files

## Open Questions

1. **System prompt size limits**
   - What we know: `--append-system-prompt` works in print mode
   - What's unclear: Practical limit before performance degradation
   - Recommendation: Keep identity files under 2KB each, monitor token costs

2. **Date calculation edge cases**
   - What we know: "yesterday" should map to previous date file
   - What's unclear: How Claude handles timezone edge cases (user says "yesterday" at 1am)
   - Recommendation: Use local date consistently, document in instructions

3. **USER.md update frequency**
   - What we know: Claude can write to USER.md
   - What's unclear: How often Claude will proactively update preferences
   - Recommendation: Include explicit instruction to update, test empirically

4. **Conversation file growth**
   - What we know: Retained forever per CONTEXT.md
   - What's unclear: Performance impact when searching years of logs
   - Recommendation: Monitor, consider archival strategy if issues arise

## Sources

### Primary (HIGH confidence)

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) - `--append-system-prompt`, `-p` flags
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) - CLAUDE.md patterns, system prompt guidance
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) - spawn() `cwd` option

### Secondary (MEDIUM confidence)

- [Phase 1 Research](../01-foundation/01-RESEARCH.md) - Spawn workaround, existing patterns
- CONTEXT.md decisions - Data home, conversation format, identity files

### Tertiary (LOW confidence - needs validation)

- System prompt size practical limits - test empirically
- Local vs UTC date handling edge cases - test during implementation

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - no new dependencies, all built-in Node.js
- Architecture patterns: HIGH - verified via official Claude Code docs
- Pitfalls: MEDIUM - some require empirical validation
- Code examples: HIGH - based on official patterns and Phase 1 code

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - stable patterns, Claude Code CLI may update)
