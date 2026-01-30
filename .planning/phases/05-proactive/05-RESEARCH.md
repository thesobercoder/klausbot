# Phase 5: Proactive - Research

**Researched:** 2026-01-30
**Domain:** Cron scheduling, self-evolution, persistent job management
**Confidence:** HIGH (verified via moltbot reference, croner/chrono-node docs, existing codebase patterns)

## Summary

Phase 5 implements two capabilities: cron scheduling for autonomous task execution, and self-evolution for learning from mistakes. Research confirms moltbot's cron architecture provides a solid reference pattern with JSON-based persistence, three schedule types (`at`/`every`/`cron`), and isolated execution.

Key architectural insight: Cron jobs survive restarts via JSON file persistence (not database). Schedule parsing splits between chrono-node (natural language dates) and croner (cron expressions/next-run calculation). Execution reuses existing `queryClaudeCode` spawner with extended timeout.

The learning system follows the existing memory pattern: Claude agentically reads LEARNINGS.md when relevant (not loaded at startup). Proactive suggestions emerge organically at conversation end.

**Primary recommendation:** Use croner for cron expression handling + next run calculation. Store jobs in JSON file following moltbot's `CronStoreFile` pattern. Add `/crons` command for job management. Extend system prompt with learning consultation instructions. Create LEARNINGS.md during bootstrap.

## Standard Stack

### Core (Minimal Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| croner | 8.x | Cron expression parsing, next-run calculation | Zero deps, used by PM2/Uptime Kuma, TypeScript native |
| chrono-node | 2.9.x | Natural language date parsing | 5k stars, TypeScript rewrite, multi-locale |
| fs (built-in) | - | JSON file persistence | No database dependency |
| setInterval | - | In-memory scheduling loop | Simple, pairs with file-based persistence |

### Schedule Types (moltbot pattern)

| Type | Example | Use Case |
|------|---------|----------|
| `at` | "at 2026-01-31T09:00:00Z" | One-shot scheduled task |
| `every` | "every 3600000" (ms) | Recurring interval |
| `cron` | "0 9 * * *" | Recurring cron expression |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| croner | node-cron | node-cron lacks timezone support, no nextRun() method |
| JSON file | SQLite/Redis | Overkill for single-user, Claude can't query directly |
| setInterval loop | node-schedule | More deps, no significant benefit for simple use |
| chrono-node | Custom NLP | Unreliable, chrono handles edge cases |

**Installation:**
```bash
npm install croner chrono-node
```

## Architecture Patterns

### Cron System Structure

```
src/
  cron/
    types.ts          # CronJob, CronSchedule, CronStore types
    store.ts          # JSON persistence (load/save atomic writes)
    schedule.ts       # Next run calculation via croner
    parse.ts          # Natural language -> schedule (chrono-node + croner)
    service.ts        # CRUD operations, job lifecycle
    executor.ts       # Job execution via queryClaudeCode
    index.ts          # Public API
~/.klausbot/
  cron/
    jobs.json         # Persistent cron storage
```

### Pattern 1: JSON-Based Cron Storage (moltbot pattern)

**What:** Store cron jobs in a JSON file with atomic writes.

**Source:** [moltbot cron/store.ts](https://github.com/moltbot/moltbot/tree/main/src/cron)

**Example:**
```typescript
// types.ts
export type ScheduleKind = 'at' | 'every' | 'cron';

export interface CronSchedule {
  kind: ScheduleKind;
  atMs?: number;        // For 'at': target timestamp in ms
  everyMs?: number;     // For 'every': interval in ms
  anchorMs?: number;    // For 'every': reference point
  expr?: string;        // For 'cron': cron expression
  tz?: string;          // Timezone (IANA format)
}

export interface CronJob {
  id: string;
  name: string;
  schedule: CronSchedule;
  instruction: string;  // What Claude should do
  chatId: number;       // User to notify
  createdAt: number;
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastStatus: 'success' | 'failed' | null;
  lastError: string | null;
  lastDurationMs: number | null;
  enabled: boolean;
}

export interface CronStoreFile {
  version: 1;
  jobs: CronJob[];
}

// store.ts
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { randomUUID } from 'crypto';

const STORE_PATH = getHomePath('cron', 'jobs.json');

export function loadCronStore(): CronStoreFile {
  if (!existsSync(STORE_PATH)) {
    return { version: 1, jobs: [] };
  }
  const data = readFileSync(STORE_PATH, 'utf-8');
  return JSON.parse(data);
}

export function saveCronStore(store: CronStoreFile): void {
  // Atomic write: temp file, then rename
  const tmpPath = `${STORE_PATH}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(store, null, 2));
  renameSync(tmpPath, STORE_PATH);
}
```

**Confidence:** HIGH - follows moltbot's production-tested pattern.

### Pattern 2: Schedule Parsing (Natural Language + Cron)

**What:** Parse user input to schedule. Use chrono-node for dates, croner for expressions.

**Source:** [chrono-node](https://github.com/wanasit/chrono), [croner](https://github.com/Hexagon/croner)

**Example:**
```typescript
// parse.ts
import * as chrono from 'chrono-node';
import { Cron } from 'croner';

interface ParsedSchedule {
  schedule: CronSchedule;
  humanReadable: string;
  nextRun: Date | null;
}

export function parseSchedule(input: string): ParsedSchedule | null {
  const normalized = input.toLowerCase().trim();

  // Pattern 1: "every X (minutes|hours|days)"
  const everyMatch = normalized.match(/every\s+(\d+)\s*(minute|hour|day|week)s?/);
  if (everyMatch) {
    const [, count, unit] = everyMatch;
    const multipliers: Record<string, number> = {
      minute: 60000,
      hour: 3600000,
      day: 86400000,
      week: 604800000,
    };
    const everyMs = parseInt(count) * multipliers[unit];
    return {
      schedule: { kind: 'every', everyMs, anchorMs: Date.now() },
      humanReadable: `every ${count} ${unit}(s)`,
      nextRun: new Date(Date.now() + everyMs),
    };
  }

  // Pattern 2: Cron expression (starts with digit or *)
  if (/^[\d*]/.test(normalized)) {
    try {
      const cron = new Cron(normalized);
      const next = cron.nextRun();
      return {
        schedule: { kind: 'cron', expr: normalized },
        humanReadable: `cron: ${normalized}`,
        nextRun: next,
      };
    } catch {
      // Not a valid cron expression
    }
  }

  // Pattern 3: Natural language date (via chrono-node)
  const parsed = chrono.parse(input);
  if (parsed.length > 0) {
    const date = parsed[0].start.date();
    return {
      schedule: { kind: 'at', atMs: date.getTime() },
      humanReadable: `at ${date.toLocaleString()}`,
      nextRun: date,
    };
  }

  return null;
}
```

**Confidence:** HIGH - chrono-node and croner are well-documented with TypeScript support.

### Pattern 3: Next Run Calculation

**What:** Calculate next execution time from schedule.

**Source:** [croner nextRun()](https://github.com/Hexagon/croner), moltbot schedule.ts

**Example:**
```typescript
// schedule.ts
import { Cron } from 'croner';

export function computeNextRunAtMs(
  schedule: CronSchedule,
  nowMs: number = Date.now()
): number | null {
  switch (schedule.kind) {
    case 'at':
      // One-shot: return if in future, null if past
      return schedule.atMs! > nowMs ? schedule.atMs! : null;

    case 'every': {
      const everyMs = Math.max(1, schedule.everyMs!);
      const anchor = schedule.anchorMs ?? nowMs;
      if (nowMs < anchor) return anchor;
      const elapsed = nowMs - anchor;
      const steps = Math.ceil(elapsed / everyMs);
      return anchor + steps * everyMs;
    }

    case 'cron': {
      const cron = new Cron(schedule.expr!, {
        timezone: schedule.tz ?? undefined,
      });
      const next = cron.nextRun(new Date(nowMs));
      return next ? next.getTime() : null;
    }

    default:
      return null;
  }
}
```

**Confidence:** HIGH - croner's nextRun() is primary API.

### Pattern 4: Cron Executor with Retry

**What:** Execute due jobs, notify user, retry on failure.

**Source:** CONTEXT.md decision: "retry once after delay, then report final status"

**Example:**
```typescript
// executor.ts
import { queryClaudeCode } from '../daemon/spawner.js';
import { bot } from '../telegram/bot.js';

const CRON_TIMEOUT = 3600000; // 1 hour per CONTEXT.md
const RETRY_DELAY = 60000;    // 1 minute (Claude's discretion)

export async function executeCronJob(job: CronJob): Promise<{
  success: boolean;
  result: string;
  durationMs: number;
}> {
  const startTime = Date.now();

  try {
    const response = await queryClaudeCode(job.instruction, {
      timeout: CRON_TIMEOUT,
      additionalInstructions: `
<cron-execution>
This is an autonomous cron job execution.
Job name: ${job.name}
User chat: ${job.chatId}

Complete the task and provide a concise result summary.
</cron-execution>`,
    });

    const durationMs = Date.now() - startTime;

    // Notify user of success
    await bot.api.sendMessage(job.chatId,
      `[Cron: ${job.name}]\n${response.result}`
    );

    return { success: true, result: response.result, durationMs };

  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    // First failure: retry once after delay
    if (!job.lastError) {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      try {
        const retryResponse = await queryClaudeCode(job.instruction, {
          timeout: CRON_TIMEOUT,
        });
        await bot.api.sendMessage(job.chatId,
          `[Cron: ${job.name}]\n${retryResponse.result}`
        );
        return { success: true, result: retryResponse.result, durationMs };
      } catch (retryError) {
        // Retry also failed
      }
    }

    // Notify user of failure
    await bot.api.sendMessage(job.chatId,
      `[Cron: ${job.name} FAILED]\n${errorMsg}`
    );

    return { success: false, result: errorMsg, durationMs };
  }
}
```

**Confidence:** MEDIUM - retry logic is per CONTEXT.md, delay duration at Claude's discretion.

### Pattern 5: Scheduler Loop

**What:** Background loop checking for due jobs, sequential execution.

**Source:** CONTEXT.md: "Sequential execution — one cron at a time, queue others"

**Example:**
```typescript
// service.ts
const TICK_INTERVAL = 60000; // Check every minute

let schedulerInterval: NodeJS.Timeout | null = null;
let isExecuting = false;
const pendingJobs: CronJob[] = [];

export function startScheduler(): void {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    await checkAndEnqueueDueJobs();
    await processNextJob();
  }, TICK_INTERVAL);

  log.info('Cron scheduler started');
}

async function checkAndEnqueueDueJobs(): Promise<void> {
  const store = loadCronStore();
  const nowMs = Date.now();

  for (const job of store.jobs) {
    if (!job.enabled) continue;
    if (job.nextRunAtMs && job.nextRunAtMs <= nowMs) {
      if (!pendingJobs.find(j => j.id === job.id)) {
        pendingJobs.push(job);
      }
    }
  }
}

async function processNextJob(): Promise<void> {
  if (isExecuting || pendingJobs.length === 0) return;

  isExecuting = true;
  const job = pendingJobs.shift()!;

  try {
    const result = await executeCronJob(job);
    updateJobStatus(job.id, result);
  } catch (err) {
    log.error({ err, jobId: job.id }, 'Job execution error');
  } finally {
    isExecuting = false;
  }
}

function updateJobStatus(jobId: string, result: ExecutionResult): void {
  const store = loadCronStore();
  const job = store.jobs.find(j => j.id === jobId);
  if (!job) return;

  job.lastRunAtMs = Date.now();
  job.lastStatus = result.success ? 'success' : 'failed';
  job.lastError = result.success ? null : result.result;
  job.lastDurationMs = result.durationMs;

  // Calculate next run
  job.nextRunAtMs = computeNextRunAtMs(job.schedule);

  // Disable one-shot jobs after execution
  if (job.schedule.kind === 'at') {
    job.enabled = false;
  }

  saveCronStore(store);
}
```

**Confidence:** HIGH - follows moltbot sequential execution pattern.

### Pattern 6: LEARNINGS.md Consultation

**What:** System prompt reminds Claude to read LEARNINGS.md when relevant.

**Source:** CONTEXT.md: "agentically read LEARNINGS.md when relevant (not loaded at session start)"

**Example:**
```typescript
// Add to context.ts getRetrievalInstructions()
const learningsInstructions = `
## Learning from Past Mistakes

When handling tasks that might have gone wrong before:
1. Read identity/LEARNINGS.md to check for relevant past mistakes
2. Apply learnings to avoid repeating errors
3. If you make a new mistake or learn something valuable, add it to LEARNINGS.md

### LEARNINGS.md Format

Each entry is a simple lesson learned:

\`\`\`
## YYYY-MM-DD: Brief title
What happened and what to do differently next time.
\`\`\`

Entries are chronological, newest first. Remove entries that are no longer relevant.
`;
```

**Confidence:** HIGH - follows existing memory pattern (agentic file reading).

### Pattern 7: Proactive Suggestions

**What:** Claude suggests improvements at end of conversation.

**Source:** CONTEXT.md: "Timing: end of conversation, after completing a task"

**Example:**
```typescript
// Add to system prompt
const proactiveInstructions = `
## Proactive Improvement Suggestions

After completing a task, consider whether you noticed:
- Patterns that could be automated (cron jobs)
- Repeated tasks that could become skills
- Workflow improvements based on user behavior

If you have a useful suggestion:
1. Complete the primary task first
2. At the end, offer the suggestion naturally
3. Let the user decide whether to act on it

Example: "By the way, I noticed you often check the weather in the morning. Would you like me to set up a daily weather update?"

Don't suggest if nothing relevant. Not every conversation needs suggestions.
`;
```

**Confidence:** HIGH - follows CONTEXT.md decision.

### Anti-Patterns to Avoid

- **Database for cron storage:** Overkill for single-user, Claude can't query directly
- **Loading LEARNINGS.md at startup:** Wastes context, defeats agentic reading
- **Complex NLP for schedule parsing:** Use chrono-node, don't hand-roll
- **Webhook-based cron:** Use simple setInterval loop
- **Aggressive proactive suggestions:** Wait until task complete, suggest only when relevant

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Natural language dates | Regex patterns | chrono-node | Edge cases (timezones, relative dates, locales) |
| Cron expression parsing | Custom parser | croner | Complex syntax, next-run calculation |
| Atomic file writes | writeFileSync | temp + rename | Prevents corruption on crash |
| Schedule normalization | Custom logic | moltbot pattern | Tested across edge cases |

**Key insight:** Scheduling looks simple but has many edge cases (DST, timezones, leap seconds). Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: Timer Drift

**What goes wrong:** Jobs run at slightly wrong times over long periods.
**Why it happens:** setInterval drift accumulates; system sleep pauses timers.
**How to avoid:** Check due jobs each tick against stored nextRunAtMs, not timer timing.
**Warning signs:** Jobs running minutes late after days of uptime.

### Pitfall 2: Lost Jobs on Restart

**What goes wrong:** Process restarts, pending jobs are lost.
**Why it happens:** In-memory queue not persisted.
**How to avoid:** Store nextRunAtMs in JSON, recalculate on startup.
**Warning signs:** Users report scheduled jobs never running after updates.

### Pitfall 3: Timezone Confusion

**What goes wrong:** "9am" job runs at wrong time.
**Why it happens:** User timezone != server timezone.
**How to avoid:** Store timezone in schedule, use croner's timezone option.
**Warning signs:** Jobs 3-8 hours off from expected time.

### Pitfall 4: Concurrent Execution

**What goes wrong:** Same job runs twice simultaneously.
**Why it happens:** Job takes longer than tick interval.
**How to avoid:** Sequential execution with isExecuting flag.
**Warning signs:** Duplicate notifications, race conditions.

### Pitfall 5: Stale LEARNINGS.md

**What goes wrong:** LEARNINGS.md grows unbounded with outdated entries.
**Why it happens:** Entries added but never removed.
**How to avoid:** Per CONTEXT.md: "Claude removes learnings that are no longer relevant".
**Warning signs:** LEARNINGS.md > 100 entries, irrelevant content.

### Pitfall 6: Suggestion Fatigue

**What goes wrong:** User annoyed by constant improvement suggestions.
**Why it happens:** Suggesting after every conversation.
**How to avoid:** Only suggest when genuine pattern detected.
**Warning signs:** User asks to stop suggestions, ignores them.

## Code Examples

### Complete /crons Command Handler

```typescript
// Add to telegram/commands.ts

bot.command('crons', async (ctx: MyContext) => {
  const store = loadCronStore();
  const enabledJobs = store.jobs.filter(j => j.enabled);

  if (enabledJobs.length === 0) {
    await ctx.reply('No scheduled tasks.\n\nCreate one with natural language, e.g.:\n"Remind me every morning at 9am to check emails"');
    return;
  }

  const lines = enabledJobs.map(job => {
    const nextRun = job.nextRunAtMs
      ? new Date(job.nextRunAtMs).toLocaleString()
      : 'never';
    const status = job.lastStatus
      ? ` (last: ${job.lastStatus})`
      : '';
    return `- **${job.name}**: ${job.humanSchedule}\n  Next: ${nextRun}${status}`;
  });

  await ctx.reply(
    `*Scheduled Tasks*\n\n${lines.join('\n\n')}\n\n_Modify or delete via conversation_`,
    { parse_mode: 'Markdown' }
  );
});
```

### LEARNINGS.md Bootstrap Content

```typescript
// Add to identity.ts
export const DEFAULT_LEARNINGS = `# Learnings

Record mistakes, insights, and lessons learned here.
Newest entries first. Remove entries that are no longer relevant.

## Format

Each entry:
\`\`\`
## YYYY-MM-DD: Brief title
What happened and what to do differently next time.
\`\`\`

(No entries yet - learnings will be added as we work together)
`;
```

### Integration with Gateway

```typescript
// gateway.ts additions

import { startScheduler, stopScheduler, loadCronStore } from './cron/index.js';

export async function startGateway(): Promise<void> {
  // ... existing initialization ...

  // Initialize cron system
  ensureDataDir(getHomePath('cron'));

  // Recover any jobs that were due while offline
  recoverMissedJobs();

  // Start scheduler loop
  startScheduler();

  log.info({ jobs: loadCronStore().jobs.length }, 'Cron scheduler initialized');

  // ... rest of gateway setup ...
}

export async function stopGateway(): Promise<void> {
  stopScheduler();
  // ... existing shutdown ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-cron | croner | 2024 | Better TypeScript, timezone support, no deps |
| Custom date parsing | chrono-node v2 | 2023 | TypeScript rewrite, better accuracy |
| Database job storage | JSON file | moltbot pattern | Simpler, Claude-accessible |
| Load all context at start | Agentic file reading | RLM paper 2025 | Scales to unlimited history |

**Current best practices:**
- croner for cron expression handling (zero deps, TypeScript native)
- chrono-node for natural language dates (battle-tested, multi-locale)
- JSON file persistence (Claude-readable, no database dependency)
- Sequential job execution (prevents race conditions)
- Agentic LEARNINGS.md consultation (don't bloat context)

**Deprecated/outdated:**
- node-cron (less features, no timezone, no nextRun())
- Redis/MongoDB for single-user cron (overkill)
- Loading full LEARNINGS.md in system prompt (context waste)

## Open Questions

1. **Natural language cron creation**
   - What we know: chrono-node parses dates, croner handles expressions
   - What's unclear: How Claude translates "every morning at 9am" to schedule
   - Recommendation: Claude uses parseSchedule() helper, confirms with user

2. **Missed job handling**
   - What we know: Jobs may be due while process is down
   - What's unclear: Run missed jobs immediately or skip?
   - Recommendation: Run once on startup if missed < 24h, skip otherwise

3. **Learning entry format**
   - What we know: Flat list, newest first
   - What's unclear: Optimal format for Claude to parse/update
   - Recommendation: Simple markdown, Claude decides specifics (discretion)

4. **Suggestion trigger threshold**
   - What we know: Suggest when pattern detected
   - What's unclear: What count/frequency triggers suggestion?
   - Recommendation: Claude's judgment (3+ similar tasks = pattern worth mentioning)

## Sources

### Primary (HIGH confidence)
- [croner GitHub](https://github.com/Hexagon/croner) - API docs, timezone support, nextRun()
- [chrono-node GitHub](https://github.com/wanasit/chrono) - Natural language parsing, TypeScript support
- [moltbot cron](https://github.com/moltbot/moltbot/tree/main/src/cron) - Reference implementation for store, types, scheduling

### Secondary (MEDIUM confidence)
- [Better Stack Node.js Schedulers](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) - Library comparison
- Existing codebase patterns (daemon/spawner.ts, daemon/queue.ts) - Integration approach

### Tertiary (LOW confidence)
- Proactive suggestion frequency - requires empirical testing
- Learning entry format - Claude's discretion per CONTEXT.md
- Retry delay duration - Claude's discretion per CONTEXT.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - croner and chrono-node well-documented, moltbot reference verified
- Architecture patterns: HIGH - follows existing codebase + moltbot patterns
- Pitfalls: MEDIUM - timer drift and timezone issues are known, but edge cases need testing
- Code examples: HIGH - derived from moltbot and existing codebase

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (30 days - libraries stable, patterns proven)
