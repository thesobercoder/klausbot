# Phase 11: Telegram Threading - Research

**Researched:** 2026-02-05
**Domain:** Telegram Bot API threading, message_thread_id, reply_parameters
**Confidence:** HIGH

## Summary

Phase 11 implements proper threading support for Telegram conversations. This ensures bot responses stay within the correct thread/topic context and replies are properly linked to user messages.

Key technical domains:

1. **message_thread_id** - Incoming messages include this field when sent to forum topics; bot must echo it back when replying
2. **reply_parameters** - Telegram's modern approach to linking replies; replaces deprecated `reply_to_message_id`
3. **grammY Access** - Thread ID available via `ctx.msg.message_thread_id`; pass to `sendMessage`/`ctx.reply` options

**Primary recommendation:** Extract `message_thread_id` from incoming messages, store in queue alongside chatId, and pass it to ALL response methods (sendMessage, sendMessageDraft, ctx.reply).

## Standard Stack

### Core (Already Installed)

| Library              | Version | Purpose              | Why Standard              |
| -------------------- | ------- | -------------------- | ------------------------- |
| grammy               | 1.39.3  | Telegram framework   | Already handles threading |
| @grammyjs/auto-retry | 2.0.2   | Retry on rate limits | Already configured        |

### No New Dependencies Required

Threading is a native Telegram Bot API feature. grammY 1.39.3 already supports all required parameters.

## Architecture Patterns

### Recommended Changes

```
src/
├── daemon/
│   ├── queue.ts        # EXTEND: Add messageThreadId field
│   └── gateway.ts      # EXTEND: Extract/pass messageThreadId
├── telegram/
│   └── streaming.ts    # ALREADY SUPPORTS: messageThreadId option
```

### Pattern 1: Extract Thread ID from Context

**What:** Get message_thread_id from incoming message
**When to use:** Every message handler
**Example:**

```typescript
// Source: Telegram Bot API, grammY Context
bot.on("message:text", async (ctx: MyContext) => {
  const chatId = ctx.chat?.id;
  const messageThreadId = ctx.msg.message_thread_id; // undefined if not in topic
  const replyToMessageId = ctx.msg.message_id; // For reply linking

  // Pass to queue
  queue.add(chatId, text, { messageThreadId, replyToMessageId });
});
```

### Pattern 2: Reply with Thread Context

**What:** Include thread ID and reply parameters in all responses
**When to use:** Every response to user
**Example:**

```typescript
// Source: Telegram Bot API sendMessage parameters
await bot.api.sendMessage(chatId, responseText, {
  message_thread_id: messageThreadId, // undefined is OK - Telegram ignores
  reply_parameters: {
    message_id: replyToMessageId, // Links reply to user's message
  },
  parse_mode: "HTML",
});

// Or with ctx.reply (simpler):
await ctx.reply(responseText, {
  message_thread_id: messageThreadId,
  reply_parameters: {
    message_id: ctx.msg.message_id,
  },
});
```

### Pattern 3: Queue Entry Extension

**What:** Store threading context in queue
**When to use:** When queuing messages for async processing
**Example:**

```typescript
// QueuedMessage interface extension
interface QueuedMessage {
  id: string;
  chatId: number;
  text: string;
  timestamp: number;
  status: MessageStatus;
  error?: string;
  media?: MediaAttachment[];
  // NEW: Threading context
  messageThreadId?: number; // Forum topic thread ID
  replyToMessageId?: number; // Original message to reply to
}
```

### Pattern 4: General Topic (Thread ID 1) Edge Case

**What:** Special handling for General topic in forum groups
**When to use:** When message_thread_id is 1
**Example:**

```typescript
// Source: OpenClaw documentation, Telegram forums behavior
// Telegram rejects message_thread_id=1 for General topic in groups
// But private chats with topics work differently

function normalizeThreadId(
  chatType: string,
  messageThreadId?: number,
): number | undefined {
  // In supergroups, thread ID 1 = General topic, which rejects the param
  if (chatType === "supergroup" && messageThreadId === 1) {
    return undefined;
  }
  return messageThreadId;
}
```

### Anti-Patterns to Avoid

- **Ignoring message_thread_id**: Responses go to wrong topic, confuses users
- **Hard-coding thread ID**: Always extract from incoming message
- **Forgetting reply_parameters**: Responses appear as new messages, not replies
- **Using deprecated reply_to_message_id**: Use reply_parameters object instead

## Don't Hand-Roll

| Problem           | Don't Build            | Use Instead                | Why                               |
| ----------------- | ---------------------- | -------------------------- | --------------------------------- |
| Thread extraction | Manual parsing         | ctx.msg.message_thread_id  | grammY exposes it directly        |
| Reply linking     | reply_to_message_id    | reply_parameters object    | Modern API, more features         |
| Thread validation | Complex state tracking | Pass undefined when absent | Telegram ignores undefined params |

**Key insight:** Threading is a "pass-through" feature - extract from incoming, include in outgoing.

## Common Pitfalls

### Pitfall 1: Not Passing Thread ID to All Methods

**What goes wrong:** Responses appear in wrong topic or as new conversations
**Why it happens:** Only passing thread ID to some methods (e.g., sendMessage but not sendMessageDraft)
**How to avoid:** Audit ALL outgoing message calls; add messageThreadId to each
**Warning signs:** Bot responses jump between topics

**Affected methods in codebase:**

- `bot.api.sendMessage`
- `bot.api.sendMessageDraft` (streaming)
- `ctx.reply`
- `sendLongMessage`
- Cron executor's sendMessage calls

### Pitfall 2: Breaking Existing Non-Forum Chats

**What goes wrong:** Bot stops working in regular chats
**Why it happens:** Incorrect handling of undefined message_thread_id
**How to avoid:** undefined is valid and should be passed through (Telegram ignores it)
**Warning signs:** Errors in private chats without topics

```typescript
// CORRECT - undefined is fine
await bot.api.sendMessage(chatId, text, {
  message_thread_id: undefined, // Telegram ignores this
});

// WRONG - don't skip the option based on presence
if (messageThreadId) {
  await bot.api.sendMessage(chatId, text, {
    message_thread_id: messageThreadId,
  });
} else {
  await bot.api.sendMessage(chatId, text);
}
```

### Pitfall 3: Forgetting reply_parameters for Reply Linking

**What goes wrong:** Bot responses don't show as replies to user message
**Why it happens:** Thread ID keeps responses in topic, but doesn't link them visually
**How to avoid:** Include reply_parameters with message_id
**Warning signs:** Responses appear as new messages in thread

### Pitfall 4: General Topic (Thread 1) in Groups

**What goes wrong:** API error when sending to General topic
**Why it happens:** Telegram rejects message_thread_id=1 for General topic in supergroups
**How to avoid:** Normalize thread ID 1 to undefined for supergroups
**Warning signs:** "Bad Request" errors only in General topic

## Code Examples

### Gateway Integration

```typescript
// In processMessage() - update response sending
async function processMessage(msg: QueuedMessage): Promise<void> {
  // ... existing processing ...

  // When sending final response:
  await bot.api.sendMessage(msg.chatId, response.result, {
    message_thread_id: msg.messageThreadId,
    reply_parameters: msg.replyToMessageId
      ? { message_id: msg.replyToMessageId }
      : undefined,
    parse_mode: "HTML",
  });
}
```

### Message Handler Update

```typescript
// In gateway.ts message handlers
bot.on("message:text", async (ctx: MyContext) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const rawText = ctx.message?.text ?? "";
  if (!rawText.trim()) return;

  const text = translateSkillCommand(rawText);

  // Extract threading context
  const messageThreadId = ctx.msg.message_thread_id;
  const replyToMessageId = ctx.msg.message_id;

  // Pass to queue with threading context
  const queueId = queue.add(chatId, text, undefined, {
    messageThreadId,
    replyToMessageId,
  });

  // ... rest of handler
});
```

### Queue Interface Extension

```typescript
// daemon/queue.ts
interface ThreadingContext {
  messageThreadId?: number;
  replyToMessageId?: number;
}

interface QueuedMessage {
  id: string;
  chatId: number;
  text: string;
  timestamp: number;
  status: MessageStatus;
  error?: string;
  media?: MediaAttachment[];
  threading?: ThreadingContext;  // NEW
}

// Update add() signature
add(
  chatId: number,
  text: string,
  media?: MediaAttachment[],
  threading?: ThreadingContext,
): string
```

### splitAndSend Update

```typescript
// Update splitAndSend to accept threading context
async function splitAndSend(
  chatId: number,
  text: string,
  threading?: { messageThreadId?: number; replyToMessageId?: number },
): Promise<number> {
  // ... chunking logic ...

  for (let i = 0; i < chunks.length; i++) {
    try {
      await bot.api.sendMessage(chatId, chunk, {
        parse_mode: "HTML",
        message_thread_id: threading?.messageThreadId,
        // Only reply to original message for first chunk
        reply_parameters:
          i === 0 && threading?.replyToMessageId
            ? { message_id: threading.replyToMessageId }
            : undefined,
      });
    } catch (err) {
      // ... error handling ...
    }
  }
}
```

### Streaming Integration

Streaming already supports `messageThreadId` via `StreamToTelegramOptions`:

```typescript
// src/telegram/streaming.ts - ALREADY IMPLEMENTED
export interface StreamToTelegramOptions {
  model?: string;
  additionalInstructions?: string;
  messageThreadId?: number; // Already exists!
}
```

Just need to pass it from gateway:

```typescript
const streamResult = await streamToTelegram(
  bot,
  msg.chatId,
  effectiveText,
  streamConfig,
  {
    model: jsonConfig.model,
    additionalInstructions,
    messageThreadId: msg.threading?.messageThreadId, // Pass through
  },
);
```

## State of the Art

| Old Approach           | Current Approach     | When Changed  | Impact                   |
| ---------------------- | -------------------- | ------------- | ------------------------ |
| reply_to_message_id    | reply_parameters     | Bot API 7.0   | More features, quotes    |
| No forum support       | message_thread_id    | Bot API 6.1   | Forum topic organization |
| Manual thread tracking | Pass-through pattern | Best practice | Simpler, more reliable   |

**Deprecated/outdated:**

- `reply_to_message_id` parameter: Still works but use `reply_parameters` instead
- Manual topic state tracking: Let Telegram handle via message_thread_id

## Open Questions

1. **Cron job threading**
   - What we know: Cron jobs send to chatId stored in job
   - What's unclear: Should cron responses go to specific thread?
   - Recommendation: Add optional `messageThreadId` to cron job config for Phase 12

2. **Multi-chunk reply linking**
   - What we know: Long responses split into multiple messages
   - What's unclear: Should all chunks reply to original, or just first?
   - Recommendation: Only first chunk links as reply; subsequent are just in-thread

## Sources

### Primary (HIGH confidence)

- [Telegram Bot API - sendMessage](https://core.telegram.org/bots/api#sendmessage) - message_thread_id parameter
- [Telegram Threads Documentation](https://core.telegram.org/api/threads) - Threading mechanics
- [grammY Guide - Context](https://grammy.dev/guide/context) - Accessing message properties
- [grammY Guide - Basics](https://grammy.dev/guide/basics) - Using reply_parameters

### Secondary (MEDIUM confidence)

- [OpenClaw Telegram Docs](https://docs.openclaw.ai/channels/telegram) - General topic edge case, replyToMode
- Existing codebase analysis - src/telegram/streaming.ts already supports messageThreadId

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - No new dependencies, grammY already supports
- Architecture: HIGH - Pass-through pattern well documented
- Pitfalls: MEDIUM - General topic edge case from OpenClaw (not Telegram official docs)

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable feature)

## Implementation Scope

Based on requirements TELE-01 and TELE-02:

1. **TELE-01**: Thread support for single conversation
   - Extract `message_thread_id` from incoming messages
   - Store in queue
   - Pass to all outgoing message methods

2. **TELE-02**: Replies properly threaded
   - Use `reply_parameters` to link responses to user's message
   - Maintain visual reply chain in Telegram UI

**Estimated changes:**

- `queue.ts`: Add threading fields to QueuedMessage
- `gateway.ts`: Extract threading context from all handlers, pass to responses
- `streaming.ts`: Already supports messageThreadId (just need to wire it up)

**Low complexity phase** - Threading is well-supported by grammY; main work is plumbing the data through the existing queue-based architecture.
