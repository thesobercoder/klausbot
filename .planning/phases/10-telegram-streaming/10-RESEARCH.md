# Phase 10: Telegram Streaming - Research

**Researched:** 2026-02-05
**Domain:** Telegram Bot API draft streaming, Claude Code CLI streaming output
**Confidence:** HIGH

## Summary

Phase 10 implements real-time response streaming in Telegram via the `sendMessageDraft` API (Bot API 9.3+). Users see Claude's response building character-by-character in a draft bubble, then the final message replaces it.

Key technical domains:

1. **Telegram Draft Streaming** — `sendMessageDraft` requires forum topic mode enabled on bot
2. **Claude CLI Streaming** — `--output-format stream-json` with `--include-partial-messages` emits NDJSON events
3. **Throttling** — Draft updates must be rate-limited; Telegram enforces 1 msg/sec per chat
4. **grammY Integration** — v1.39.3 already installed, supports `sendMessageDraft` and `replyWithDraft`

**Primary recommendation:** Use `--output-format stream-json --include-partial-messages` to get token-level streaming from Claude Code, throttle draft updates to ~500ms intervals, send final message via `sendMessage` when stream completes.

## Standard Stack

### Core (Already Installed)

| Library                  | Version  | Purpose              | Why Standard                                 |
| ------------------------ | -------- | -------------------- | -------------------------------------------- |
| grammy                   | 1.39.3   | Telegram framework   | Already installed; includes sendMessageDraft |
| @grammyjs/auto-retry     | 2.0.2    | Retry on rate limits | Already configured; handles 429s             |
| @grammyjs/runner         | 2.0.3    | Long polling         | Already configured                           |
| readline (node:readline) | built-in | NDJSON parsing       | Native, handles streaming line-by-line       |

### New Dependencies

| Library                         | Version | Purpose                | Why                                  |
| ------------------------------- | ------- | ---------------------- | ------------------------------------ |
| @grammyjs/transformer-throttler | 1.2.1   | Outbound rate limiting | Prevents 429s on rapid draft updates |

### Alternatives Considered

| Instead of           | Could Use             | Tradeoff                                            |
| -------------------- | --------------------- | --------------------------------------------------- |
| Manual throttling    | transformer-throttler | Manual is error-prone; throttler handles edge cases |
| Custom NDJSON parser | readline              | readline is built-in, handles backpressure          |

**Installation:**

```bash
npm install @grammyjs/transformer-throttler
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── telegram/
│   ├── bot.ts           # EXTEND: Add throttler transformer
│   └── streaming.ts     # NEW: Draft streaming logic
├── daemon/
│   ├── spawner.ts       # EXTEND: Add streaming spawn mode
│   └── gateway.ts       # EXTEND: Use streaming for responses
├── config/
│   └── schema.ts        # EXTEND: Add streaming config options
```

### Pattern 1: Claude Code Streaming Spawn

**What:** Spawn Claude with stream-json output, parse NDJSON events in real-time
**When to use:** When streaming is enabled and forum topics are available
**Example:**

```typescript
// Source: https://code.claude.com/docs/en/cli-reference
import { spawn } from "child_process";
import { createInterface } from "readline";

interface StreamEvent {
  type:
    | "content_block_delta"
    | "message_start"
    | "message_delta"
    | "message_stop";
  delta?: { text?: string };
  message?: { id: string };
}

async function* streamClaudeCode(
  prompt: string,
  systemPrompt: string,
): AsyncGenerator<string, void, unknown> {
  const args = [
    "--dangerously-skip-permissions",
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--append-system-prompt",
    systemPrompt,
  ];

  const claude = spawn("claude", args, {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: KLAUSBOT_HOME,
  });

  const rl = createInterface({ input: claude.stdout });

  for await (const line of rl) {
    try {
      const event: StreamEvent = JSON.parse(line);
      if (event.type === "content_block_delta" && event.delta?.text) {
        yield event.delta.text;
      }
    } catch {
      // Skip non-JSON lines
    }
  }
}
```

### Pattern 2: Telegram Draft Streaming

**What:** Send progressive drafts to Telegram, then final message
**When to use:** Private chats with forum topics enabled
**Example:**

```typescript
// Source: https://grammy.dev/ref/core/api (sendMessageDraft)
import { Bot } from "grammy";

interface DraftStreamOptions {
  chatId: number;
  draftId: number;
  messageThreadId?: number;
  throttleMs?: number; // Default: 500ms
}

async function streamDraft(
  bot: Bot,
  textGenerator: AsyncGenerator<string>,
  options: DraftStreamOptions,
): Promise<string> {
  const { chatId, draftId, messageThreadId, throttleMs = 500 } = options;
  let accumulated = "";
  let lastUpdate = 0;

  for await (const chunk of textGenerator) {
    accumulated += chunk;

    const now = Date.now();
    if (now - lastUpdate >= throttleMs) {
      await bot.api.sendMessageDraft(chatId, draftId, accumulated, {
        message_thread_id: messageThreadId,
      });
      lastUpdate = now;
    }
  }

  // Final draft update
  await bot.api.sendMessageDraft(chatId, draftId, accumulated, {
    message_thread_id: messageThreadId,
  });

  return accumulated;
}
```

### Pattern 3: Draft ID Generation

**What:** Generate unique draft IDs for each streaming session
**When to use:** Before starting draft stream
**Example:**

```typescript
// Draft ID is a simple incrementing number unique to the conversation
// Telegram will replace existing draft with same ID

let draftIdCounter = 0;

function generateDraftId(): number {
  return ++draftIdCounter;
}
```

### Pattern 4: Forum Topics Detection

**What:** Check if streaming is available for current chat
**When to use:** Before deciding to stream or batch
**Example:**

```typescript
// Source: Bot API 9.3 changelog
async function canStreamToChat(
  bot: Bot,
  chatId: number,
): Promise<{ canStream: boolean; messageThreadId?: number }> {
  try {
    const chat = await bot.api.getChat(chatId);

    // Private chat with topics enabled
    if (chat.type === "private" && chat.has_topics_enabled) {
      // Need to get the default topic thread ID
      // In private chats with topics, use the default thread
      return { canStream: true, messageThreadId: undefined };
    }

    return { canStream: false };
  } catch {
    return { canStream: false };
  }
}
```

### Pattern 5: Streaming with Fallback

**What:** Stream when possible, batch otherwise
**When to use:** Always — graceful degradation
**Example:**

```typescript
async function processMessageWithStreaming(
  bot: Bot,
  chatId: number,
  prompt: string,
  config: { streamingEnabled: boolean },
): Promise<void> {
  const { canStream, messageThreadId } = await canStreamToChat(bot, chatId);

  if (config.streamingEnabled && canStream) {
    // Stream mode
    const textGen = streamClaudeCode(prompt, systemPrompt);
    const draftId = generateDraftId();
    const fullText = await streamDraft(bot, textGen, {
      chatId,
      draftId,
      messageThreadId,
    });

    // Send final message (replaces draft)
    await bot.api.sendMessage(chatId, fullText, {
      message_thread_id: messageThreadId,
    });
  } else {
    // Batch mode (existing behavior)
    const response = await queryClaudeCode(prompt);
    await bot.api.sendMessage(chatId, response.result);
  }
}
```

### Anti-Patterns to Avoid

- **Streaming to groups/channels**: `sendMessageDraft` only works in private chats with topics
- **No throttling**: Rapid updates will hit 429 rate limits
- **Parsing entire stream**: Use readline for line-by-line processing
- **Blocking on final message**: Send final message async, don't wait for delivery
- **Forgetting to send final**: Draft disappears if not followed by real message

## Don't Hand-Roll

| Problem           | Don't Build           | Use Instead                     | Why                                   |
| ----------------- | --------------------- | ------------------------------- | ------------------------------------- |
| Rate limiting     | Manual delay counters | @grammyjs/transformer-throttler | Handles Bottleneck config, edge cases |
| NDJSON parsing    | Custom stream parser  | node:readline                   | Built-in, handles backpressure        |
| Draft ID tracking | Complex state machine | Simple counter                  | Telegram overwrites by ID             |
| Retry on 429      | Custom retry loop     | @grammyjs/auto-retry            | Already configured in codebase        |

**Key insight:** grammY ecosystem handles most complexity. Focus on Claude streaming integration.

## Common Pitfalls

### Pitfall 1: Forum Topics Not Enabled

**What goes wrong:** `sendMessageDraft` fails silently or returns error
**Why it happens:** Bot doesn't have forum topic mode enabled via @BotFather
**How to avoid:** Enable "Threaded Mode" in BotFather settings
**Warning signs:** Draft updates don't appear in chat

```
BotFather steps:
1. /mybots → Select bot
2. Bot Settings → Topics in Private Chats → Turn On
```

### Pitfall 2: Rate Limiting on Rapid Updates

**What goes wrong:** 429 Too Many Requests errors during streaming
**Why it happens:** Telegram limits to ~1 request/second per chat
**How to avoid:** Throttle draft updates to 500ms minimum
**Warning signs:** Random gaps in streaming, error logs showing 429

### Pitfall 3: Draft Not Replaced by Final Message

**What goes wrong:** Draft bubble remains after streaming completes
**Why it happens:** Final `sendMessage` failed or wasn't called
**How to avoid:** Always send final message, even on error
**Warning signs:** Orphaned draft bubbles in chat

```typescript
// Always send final message
try {
  const fullText = await streamDraft(...);
  await bot.api.sendMessage(chatId, fullText);
} catch (err) {
  // Still send final message with error indication
  await bot.api.sendMessage(chatId, `[Streaming failed: ${err.message}]`);
}
```

### Pitfall 4: Stream-JSON Event Type Confusion

**What goes wrong:** Missing text deltas, incomplete response
**Why it happens:** Only certain event types contain actual text
**How to avoid:** Filter for `content_block_delta` events with `delta.text`
**Warning signs:** Empty or truncated responses

```typescript
// Correct filtering
if (event.type === "content_block_delta" && event.delta?.text) {
  yield event.delta.text;
}
```

### Pitfall 5: Memory Accumulation on Long Responses

**What goes wrong:** OOM on very long Claude responses
**Why it happens:** Accumulating entire response in memory
**How to avoid:** Stream chunks, don't buffer entire response
**Warning signs:** High memory usage, crashes on long responses

## Code Examples

### Complete Streaming Module

```typescript
// src/telegram/streaming.ts
import { Bot, Context } from "grammy";
import { spawn, ChildProcess } from "child_process";
import { createInterface, Interface } from "readline";
import { KLAUSBOT_HOME, buildSystemPrompt } from "../memory/index.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("streaming");

export interface StreamConfig {
  enabled: boolean;
  throttleMs: number; // Default: 500
}

interface StreamEvent {
  type: string;
  delta?: { text?: string };
  result?: string;
  cost_usd?: number;
  session_id?: string;
}

/**
 * Generator that yields text chunks from Claude Code stream
 */
async function* streamClaudeResponse(
  prompt: string,
  systemPrompt: string,
  signal: AbortSignal,
): AsyncGenerator<string, { result: string; cost_usd: number }, unknown> {
  const args = [
    "--dangerously-skip-permissions",
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--append-system-prompt",
    systemPrompt,
  ];

  const claude = spawn("claude", args, {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: KLAUSBOT_HOME,
    env: process.env,
  });

  let fullText = "";
  let costUsd = 0;

  // Handle abort
  signal.addEventListener("abort", () => {
    claude.kill("SIGTERM");
  });

  const rl = createInterface({ input: claude.stdout });

  for await (const line of rl) {
    if (signal.aborted) break;

    try {
      const event: StreamEvent = JSON.parse(line);

      if (event.type === "content_block_delta" && event.delta?.text) {
        fullText += event.delta.text;
        yield event.delta.text;
      }

      // Capture final result metadata
      if (event.result !== undefined) {
        fullText = event.result;
      }
      if (event.cost_usd !== undefined) {
        costUsd = event.cost_usd;
      }
    } catch {
      // Skip non-JSON lines (stderr leakage, etc.)
    }
  }

  return { result: fullText, cost_usd: costUsd };
}

let draftIdCounter = 0;

/**
 * Stream response to Telegram via draft updates
 */
export async function streamToTelegram(
  bot: Bot,
  chatId: number,
  prompt: string,
  config: StreamConfig,
  messageThreadId?: number,
): Promise<{ result: string; cost_usd: number }> {
  const systemPrompt = buildSystemPrompt();
  const draftId = ++draftIdCounter;
  const controller = new AbortController();

  let accumulated = "";
  let lastUpdateTime = 0;

  const generator = streamClaudeResponse(
    prompt,
    systemPrompt,
    controller.signal,
  );

  try {
    let done = false;
    let returnValue: { result: string; cost_usd: number } = {
      result: "",
      cost_usd: 0,
    };

    while (!done) {
      const { value, done: isDone } = await generator.next();

      if (isDone) {
        returnValue = value as { result: string; cost_usd: number };
        done = true;
        break;
      }

      accumulated += value;

      // Throttled draft updates
      const now = Date.now();
      if (now - lastUpdateTime >= config.throttleMs) {
        try {
          await bot.api.sendMessageDraft(chatId, draftId, accumulated, {
            message_thread_id: messageThreadId,
          });
          lastUpdateTime = now;
        } catch (err) {
          log.warn({ err, chatId }, "Draft update failed, continuing...");
        }
      }
    }

    // Final draft before sending real message
    await bot.api
      .sendMessageDraft(chatId, draftId, accumulated, {
        message_thread_id: messageThreadId,
      })
      .catch(() => {});

    return returnValue;
  } catch (err) {
    controller.abort();
    throw err;
  }
}

/**
 * Check if chat supports draft streaming
 */
export async function canStreamToChat(
  bot: Bot,
  chatId: number,
): Promise<boolean> {
  try {
    const chat = await bot.api.getChat(chatId);
    // Private chat with forum topics enabled
    return chat.type === "private" && Boolean(chat.has_topics_enabled);
  } catch {
    return false;
  }
}
```

### Config Schema Extension

```typescript
// Extend src/config/schema.ts
export const jsonConfigSchema = z
  .object({
    model: z.string().optional(),
    streaming: z
      .object({
        enabled: z.boolean().default(true),
        throttleMs: z.number().min(100).max(2000).default(500),
      })
      .default({ enabled: true, throttleMs: 500 }),
  })
  .strict();
```

### Bot Throttler Integration

```typescript
// Update src/telegram/bot.ts
import { apiThrottler } from "@grammyjs/transformer-throttler";

// Add after autoRetry
bot.api.config.use(
  apiThrottler({
    out: {
      maxConcurrent: 1,
      minTime: 100, // Allow faster for drafts, let Telegram reject
    },
  }),
);
```

### Gateway Integration

```typescript
// In processMessage() - simplified sketch
async function processMessage(msg: QueuedMessage): Promise<void> {
  const jsonConfig = getJsonConfig();
  const canStream = await canStreamToChat(bot, msg.chatId);

  if (jsonConfig.streaming.enabled && canStream) {
    // Streaming path
    const { result, cost_usd } = await streamToTelegram(
      bot,
      msg.chatId,
      effectiveText,
      jsonConfig.streaming,
    );

    // Send final message
    await bot.api.sendMessage(msg.chatId, result);

    log.info({ cost_usd, streaming: true }, "Streamed response");
  } else {
    // Existing batch path
    const response = await queryClaudeCode(effectiveText);
    await bot.api.sendMessage(msg.chatId, response.result);
  }
}
```

## State of the Art

| Old Approach         | Current Approach      | When Changed           | Impact                  |
| -------------------- | --------------------- | ---------------------- | ----------------------- |
| Batch-only responses | Draft streaming       | Bot API 9.3 (Dec 2025) | Real-time UX            |
| --output-format json | stream-json + partial | Claude Code 2025       | Token-level streaming   |
| Manual delay loops   | transformer-throttler | grammY 2024+           | Automatic rate limiting |

**Deprecated/outdated:**

- `editMessageText` for pseudo-streaming: Use `sendMessageDraft` for true drafts
- Chat actions for progress: Drafts show actual content, not just "typing..."

## Open Questions

1. **Draft ID persistence across bot restarts**
   - What we know: Simple counter resets on restart
   - What's unclear: Does Telegram care about ID uniqueness across sessions?
   - Recommendation: Counter is fine; IDs are per-chat, transient

2. **Default thread ID for private topics**
   - What we know: Private chats with topics have a default thread
   - What's unclear: Exact ID or if omitting works
   - Recommendation: Try without `message_thread_id` first, test behavior

3. **Stream cancellation on user abort**
   - What we know: AbortController can kill Claude process
   - What's unclear: Best UX for partial responses
   - Recommendation: Send partial accumulated text on abort

## Sources

### Primary (HIGH confidence)

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) — `--output-format stream-json`, `--include-partial-messages`
- [grammY API Reference (sendMessageDraft)](https://grammy.dev/ref/core/api) — Method signature, parameters
- [Bot API 9.3 Changelog](https://core.telegram.org/bots/api-changelog) — December 2025 release notes
- [grammY Transformer Throttler](https://grammy.dev/plugins/transformer-throttler) — Bottleneck configuration

### Secondary (MEDIUM confidence)

- [OpenClaw Telegram Docs](https://docs.openclaw.ai/channels/telegram) — streamMode patterns (off/partial/block)
- [Telegram Bot API](https://core.telegram.org/bots/api) — sendMessageDraft method reference

### Tertiary (LOW confidence)

- WebSearch results for rate limit specifics (2026 dated)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — grammY already installed, API documented
- Architecture: HIGH — Claude CLI streaming documented, grammY patterns clear
- Pitfalls: MEDIUM — some based on OpenClaw patterns, some WebSearch
- Rate limits: MEDIUM — general Telegram limits known, draft-specific limits unclear

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain)
