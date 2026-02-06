# Phase 12: Heartbeat System - Research

**Researched:** 2026-02-05
**Domain:** Periodic awareness system with file-based reminders
**Confidence:** HIGH

## Summary

The heartbeat system is an internal periodic checker that reads HEARTBEAT.md and invokes Claude to interpret and act on reminders. Unlike cron (scheduled tasks with fixed instructions), heartbeat is awareness-focused: Claude reads context, decides what needs attention, and can execute actions via tools.

Implementation follows established patterns from the cron scheduler (setInterval tick loop), spawner (Claude invocation), and identity file system (markdown files in ~/.klausbot/). The note collection feature hooks into existing conversation processing.

**Primary recommendation:** Implement as a parallel scheduler service alongside cron, using the same spawner infrastructure but with distinct prompt structure and response parsing (HEARTBEAT_OK suppression).

## Standard Stack

### Core

| Library             | Version  | Purpose                                 | Why Standard                        |
| ------------------- | -------- | --------------------------------------- | ----------------------------------- |
| Node.js setInterval | built-in | Periodic tick loop                      | Matches cron scheduler pattern      |
| fs module           | built-in | HEARTBEAT.md read/write                 | Matches identity file pattern       |
| Existing spawner    | internal | Claude invocation                       | Already handles timeout, MCP, hooks |
| Existing config     | internal | heartbeat.intervalMs, heartbeat.enabled | Hot reload via mtime                |

### Supporting

| Library          | Version  | Purpose                | When to Use                |
| ---------------- | -------- | ---------------------- | -------------------------- |
| pino logger      | existing | Structured logging     | All heartbeat operations   |
| Telegram bot API | existing | Send messages to users | Non-OK heartbeat responses |

### Alternatives Considered

| Instead of         | Could Use       | Tradeoff                                                      |
| ------------------ | --------------- | ------------------------------------------------------------- |
| setInterval        | node-cron       | Overkill - we only need fixed interval, not cron expressions  |
| Separate scheduler | Merge with cron | Conceptually distinct - heartbeat is awareness, cron is tasks |
| JSON file          | Markdown file   | User decisions specify free-form markdown                     |

**Installation:**
No new packages needed - all infrastructure exists.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── heartbeat/
│   ├── index.ts       # Re-exports
│   ├── scheduler.ts   # Tick loop, interval management
│   ├── executor.ts    # Claude invocation, response parsing
│   └── notes.ts       # Note collection from conversations
└── config/
    └── schema.ts      # Extended with heartbeat config
```

### Pattern 1: Parallel Scheduler Service

**What:** Heartbeat scheduler runs alongside cron scheduler, both started in gateway.ts
**When to use:** Always - they're independent services
**Example:**

```typescript
// gateway.ts startup
startScheduler(); // cron
startHeartbeat(); // heartbeat

// gateway.ts shutdown
stopScheduler(); // cron
stopHeartbeat(); // heartbeat
```

### Pattern 2: First Interval Wait (No Immediate Check)

**What:** Unlike cron which runs immediately to recover missed jobs, heartbeat waits for first interval
**When to use:** Always - per user decision in CONTEXT.md
**Example:**

```typescript
// heartbeat/scheduler.ts
export function startHeartbeat(): void {
  const config = getJsonConfig();
  if (!config.heartbeat?.enabled) {
    log.info("Heartbeat disabled in config");
    return;
  }

  const intervalMs = config.heartbeat?.intervalMs ?? 1800000; // 30 min default

  // Note: NO immediate tick() call like cron has
  heartbeatInterval = setInterval(tick, intervalMs);
  log.info({ intervalMs }, "Heartbeat scheduler started");
}
```

### Pattern 3: HEARTBEAT_OK Suppression

**What:** Parse Claude response for exact string, suppress Telegram message if matches
**When to use:** Every heartbeat response
**Example:**

```typescript
// heartbeat/executor.ts
const HEARTBEAT_OK = "HEARTBEAT_OK";

export async function executeHeartbeat(): Promise<HeartbeatResult> {
  const response = await queryClaudeCode(prompt, { timeout: 300000 });

  // Suppress if OK (no message to user)
  if (response.result.trim() === HEARTBEAT_OK) {
    return { ok: true, suppressed: true };
  }

  // Send non-OK response to all approved users
  const store = getPairingStore();
  const approved = store.listApproved();
  for (const user of approved) {
    await bot.api.sendMessage(user.chatId, `[Heartbeat]\n${response.result}`);
  }

  return { ok: true, suppressed: false, response: response.result };
}
```

### Pattern 4: Note Collection via Conversation Hook

**What:** Detect trigger phrases during normal message processing, append to HEARTBEAT.md
**When to use:** In gateway processMessage flow, before Claude invocation
**Example:**

```typescript
// heartbeat/notes.ts
const TRIGGER_PHRASES = [
  /remind me/i,
  /don't forget/i,
  /check on/i,
  /remember to/i,
  /heartbeat:/i,
];

export function shouldCollectNote(text: string): boolean {
  return TRIGGER_PHRASES.some((p) => p.test(text));
}

// This adds to additionalInstructions, not direct file write
// Claude interprets and stores cleaned note
export function getNoteCollectionInstructions(text: string): string {
  return `<heartbeat-note-request>
The user is asking to add something to heartbeat reminders.
Their message: "${text}"

1. Interpret their intent
2. Write a cleaned/structured note to ~/.klausbot/HEARTBEAT.md
3. Respond with a brief confirmation like "Added to heartbeat reminders"

HEARTBEAT.md format is free-form markdown. Include any expiry dates if mentioned.
</heartbeat-note-request>`;
}
```

### Pattern 5: Auto-Create with Template

**What:** Create HEARTBEAT.md with template on first heartbeat check if missing
**When to use:** At start of each heartbeat tick
**Example:**

```typescript
// heartbeat/executor.ts
const HEARTBEAT_TEMPLATE = `# Heartbeat Reminders

Things to check and remember during periodic heartbeat checks.

## Format

Add items with optional expiry dates:
- [ ] Check something [expires: 2026-02-15]
- [ ] Recurring reminder (no expiry = permanent)

## Active Items

(No items yet)
`;

function ensureHeartbeatFile(): void {
  const path = getHomePath("HEARTBEAT.md");
  if (!existsSync(path)) {
    writeFileSync(path, HEARTBEAT_TEMPLATE);
    log.info({ path }, "Created HEARTBEAT.md template");
  }
}
```

### Anti-Patterns to Avoid

- **Merging with cron scheduler:** Conceptually distinct - heartbeat has no schedule expressions
- **Immediate check on startup:** User explicitly wanted wait-for-first-interval
- **Verbatim note storage:** User decided Claude interprets and cleans notes
- **Multiple heartbeat files:** Single file with multiple items inside
- **Per-user heartbeat files:** One global HEARTBEAT.md for all reminders

## Don't Hand-Roll

| Problem             | Don't Build         | Use Instead                   | Why                                 |
| ------------------- | ------------------- | ----------------------------- | ----------------------------------- |
| Interval scheduling | Custom timer logic  | setInterval + config          | Standard Node.js pattern            |
| Claude invocation   | New spawner         | Existing queryClaudeCode      | Already handles timeout, MCP, etc.  |
| File persistence    | Custom store        | Direct fs read/write          | Simple markdown, no structured data |
| User messaging      | Custom notification | Existing bot.api.sendMessage  | Already works for cron              |
| Config hot reload   | New config loader   | Extend existing getJsonConfig | mtime-based reload already works    |

**Key insight:** This phase is mostly wiring - almost all infrastructure exists.

## Common Pitfalls

### Pitfall 1: Not Waiting for First Interval

**What goes wrong:** Immediate heartbeat on startup could spam user
**Why it happens:** Cron pattern includes immediate recovery check
**How to avoid:** No tick() call in startHeartbeat(), only setInterval
**Warning signs:** User gets heartbeat message immediately on daemon start

### Pitfall 2: Strict HEARTBEAT_OK Parsing

**What goes wrong:** Whitespace or case variations cause false positives
**Why it happens:** Claude might return "Heartbeat_OK" or "HEARTBEAT_OK\n"
**How to avoid:** Use .trim() and exact match, not includes()
**Warning signs:** Suppression works inconsistently

### Pitfall 3: Note Collection During Bootstrap

**What goes wrong:** User says "remind me" before identity files exist
**Why it happens:** Bootstrap mode hasn't created ~/.klausbot/ structure
**How to avoid:** Check needsBootstrap() before note collection, skip if true
**Warning signs:** File write errors or missing directories

### Pitfall 4: Missing Chat ID for Messages

**What goes wrong:** Heartbeat can't send messages without knowing who to send to
**Why it happens:** Unlike cron jobs, heartbeat isn't associated with a specific chat
**How to avoid:** Send to all approved users from PairingStore
**Warning signs:** "chatId undefined" errors

### Pitfall 5: No Timeout on Heartbeat Check

**What goes wrong:** Stuck Claude invocation blocks next heartbeat
**Why it happens:** Forgot to set timeout in queryClaudeCode options
**How to avoid:** Always pass timeout: 300000 (5 minutes, per CONTEXT.md)
**Warning signs:** Heartbeat never completes, missed intervals

## Code Examples

### Config Schema Extension

```typescript
// config/schema.ts
export const jsonConfigSchema = z
  .object({
    model: z.string().optional(),
    streaming: z.object({...}).default({...}),
    heartbeat: z
      .object({
        enabled: z.boolean().default(true),
        intervalMs: z.number().min(60000).default(1800000), // 30 min
      })
      .default({ enabled: true, intervalMs: 1800000 }),
  })
  .strict();
```

### Heartbeat Prompt Structure

```typescript
// heartbeat/executor.ts
function buildHeartbeatPrompt(heartbeatContent: string): string {
  const now = new Date().toISOString();
  return `<heartbeat-check>
Current time: ${now}

Review your HEARTBEAT.md reminders below and take appropriate action:

<heartbeat-file>
${heartbeatContent}
</heartbeat-file>

Instructions:
1. Read each item and decide if action is needed
2. For expired items: remove them from the file
3. For actionable items: execute using tools (check email, call APIs, etc.)
4. If nothing requires attention: respond with exactly "HEARTBEAT_OK"
5. If anything needs user attention: respond with a combined summary

You have full tool access. Take actions, don't just report.
</heartbeat-check>`;
}
```

### Scheduler Module

```typescript
// heartbeat/scheduler.ts
import { getJsonConfig } from "../config/index.js";
import { executeHeartbeat } from "./executor.js";
import { createChildLogger } from "../utils/index.js";

const log = createChildLogger("heartbeat");

let heartbeatInterval: NodeJS.Timeout | null = null;
let isExecuting = false;

export function startHeartbeat(): void {
  const config = getJsonConfig();

  if (!config.heartbeat?.enabled) {
    log.info("Heartbeat disabled");
    return;
  }

  const intervalMs = config.heartbeat.intervalMs ?? 1800000;

  // No immediate tick - wait for first interval
  heartbeatInterval = setInterval(tick, intervalMs);
  log.info({ intervalMs }, "Heartbeat started");
}

export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    log.info("Heartbeat stopped");
  }
}

async function tick(): Promise<void> {
  // Prevent concurrent execution
  if (isExecuting) {
    log.debug("Heartbeat already executing, skipping");
    return;
  }

  // Re-check config (hot reload support)
  const config = getJsonConfig();
  if (!config.heartbeat?.enabled) {
    log.info("Heartbeat disabled via hot reload, stopping");
    stopHeartbeat();
    return;
  }

  isExecuting = true;
  try {
    await executeHeartbeat();
  } catch (err) {
    log.error({ err }, "Heartbeat tick error");
  } finally {
    isExecuting = false;
  }
}
```

## State of the Art

| Old Approach          | Current Approach          | When Changed | Impact                            |
| --------------------- | ------------------------- | ------------ | --------------------------------- |
| Cron for reminders    | Separate heartbeat        | This phase   | Clearer separation of concerns    |
| REMINDERS.md          | HEARTBEAT.md              | This phase   | Different purpose, different file |
| Manual reminder check | Periodic autonomous check | This phase   | Bot becomes proactive             |

**Deprecated/outdated:**

- None - this is net new functionality

## Open Questions

1. **Multi-user heartbeat scope**
   - What we know: Single HEARTBEAT.md, send to all approved users
   - What's unclear: Should notes be user-scoped or global?
   - Recommendation: Start global, can add user-scoping later if needed

2. **Failure retry strategy**
   - What we know: Cron retries once after 1 minute
   - What's unclear: Should heartbeat retry or just wait for next interval?
   - Recommendation: No retry - 30 min interval means next check comes soon enough

3. **Expiry date parsing**
   - What we know: Claude interprets and removes expired items
   - What's unclear: What date formats should be recognized?
   - Recommendation: Let Claude handle naturally - it's good at date parsing

## Sources

### Primary (HIGH confidence)

- Existing cron/scheduler.ts - setInterval pattern, concurrent execution prevention
- Existing daemon/spawner.ts - queryClaudeCode API, timeout handling
- Existing config/schema.ts - Zod schema extension pattern
- Existing pairing/store.ts - listApproved() for message recipients

### Secondary (MEDIUM confidence)

- CONTEXT.md decisions - 30 min interval, wait-for-first-interval, HEARTBEAT_OK contract
- Existing identity file patterns - markdown format, auto-create with template

### Tertiary (LOW confidence)

- None - all patterns verified against existing codebase

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all existing infrastructure
- Architecture: HIGH - patterns match existing cron/identity systems
- Pitfalls: HIGH - derived from similar existing features

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain)
