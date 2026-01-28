# Phase 1: Foundation - Research

**Researched:** 2026-01-28
**Domain:** Telegram gateway daemon, Claude Code CLI spawning, message queue persistence
**Confidence:** MEDIUM-HIGH (critical Claude Code spawn issue verified, workaround documented)

## Summary

Phase 1 establishes klausbot as a 24/7 gateway daemon bridging Telegram and Claude Code. Research validates grammY as the Telegram framework with excellent TypeScript support and plugin ecosystem. Critical finding: Claude Code CLI has known issues when spawned from Node.js with piped stdio - requires `stdio: ['inherit', 'pipe', 'pipe']` workaround where stdin inherits from parent.

The moltbot pairing pattern is well-documented: `/start` generates pairing code, CLI command approves, allowlist persists approved users. Message queue persistence achievable via better-queue with SQLite store (TypeScript types available) or simpler JSON file for single-user scenario.

**Primary recommendation:** Use grammY with runner plugin for concurrent processing, auto-retry for rate limits, auto-chat-action for typing indicators. Spawn Claude Code with `stdio: ['inherit', 'pipe', 'pipe']` to avoid hang. Persist message queue as JSON file (simplest for single-user); upgrade to SQLite if reliability issues arise.

## Standard Stack

### Core (from CONTEXT.md decisions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammY | 1.39.x | Telegram bot framework | TypeScript-first, Bot API 9.3, active ecosystem, official plugins |
| @grammyjs/runner | 2.0.x | Concurrent message processing | Enables parallel update handling with sequentialize for chat ordering |
| @grammyjs/auto-retry | latest | Rate limit handling | Automatic 429/5xx retry with exponential backoff |
| @grammyjs/auto-chat-action | latest | Typing indicator | Loops "typing" action during long operations |
| @inquirer/prompts | 7.x | CLI wizard TUI | TypeScript-first, modern API, modular prompts |
| pino | 9.x | Structured logging | JSON output, 5x faster than Winston, minimal overhead |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-queue | 3.x | Message queue | If JSON persistence proves unreliable |
| better-queue-sqlite | 1.0.x | SQLite store for better-queue | Persistent queue with crash recovery |
| zod | 4.3.x | Runtime validation | Config validation, CLI arg parsing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @inquirer/prompts | Ink (React TUI) | Ink more powerful but heavier; Inquirer simpler for wizard flow |
| pino | winston | Winston more flexible but 5x slower; pino better for structured JSON |
| JSON file queue | node-persistent-queue | node-persistent-queue lacks TypeScript types |
| JSON file queue | better-queue-sqlite | SQLite more robust but adds dependency; JSON simpler for single-user |

**Installation:**
```bash
npm install grammy @grammyjs/runner @grammyjs/auto-retry @grammyjs/auto-chat-action @inquirer/prompts pino zod
npm install -D @types/pino
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  index.ts           # Entry point - CLI dispatcher
  daemon/
    gateway.ts       # Long-running Telegram poller
    queue.ts         # Message queue (persist to disk)
    spawner.ts       # Claude Code process management
  telegram/
    bot.ts           # grammY bot setup + middleware
    commands.ts      # /start, /model handlers
    handlers.ts      # Message routing
  pairing/
    store.ts         # Approved users persistence (JSON/SQLite)
    flow.ts          # Pairing code generation, approval
  cli/
    index.ts         # Subcommand dispatcher
    pairing.ts       # klausbot pairing approve <code>
    install.ts       # klausbot install (wizard)
  config/
    schema.ts        # Zod schemas for config
    loader.ts        # Config file loading
  utils/
    logger.ts        # Pino logger setup
    split.ts         # Message splitting (4096 char limit)
```

### Pattern 1: Claude Code Spawn with Inherited Stdin

**What:** Spawn Claude Code CLI with stdin inherited from parent, stdout/stderr piped.

**Why:** [Known bug](https://github.com/anthropics/claude-code/issues/771) causes Claude Code to hang indefinitely when all stdio is piped. Inheriting stdin resolves the hang.

**CRITICAL - Use this pattern:**
```typescript
import { spawn } from 'child_process';

interface ClaudeResponse {
  result: string;
  cost_usd: number;
  session_id: string;
}

async function queryClaudeCode(prompt: string): Promise<ClaudeResponse> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', [
      '-p', prompt,
      '--output-format', 'json',
      '--dangerously-skip-permissions',  // Only in trusted environment
    ], {
      stdio: ['inherit', 'pipe', 'pipe'],  // CRITICAL: stdin inherits
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => { stdout += data; });
    claude.stderr.on('data', (data) => { stderr += data; });

    claude.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude exited ${code}: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${stdout}`));
        }
      }
    });

    claude.on('error', (err) => {
      reject(new Error(`Failed to spawn Claude: ${err.message}`));
    });
  });
}
```

**Confidence:** HIGH - verified via GitHub issue #771 with multiple user confirmations.

### Pattern 2: grammY Bot with Plugins

**What:** Configure grammY with runner, auto-retry, and auto-chat-action plugins.

**Example:**
```typescript
// Source: https://grammy.dev/plugins/runner, auto-retry, auto-chat-action
import { Bot, Context } from 'grammy';
import { run, sequentialize } from '@grammyjs/runner';
import { autoRetry } from '@grammyjs/auto-retry';
import { autoChatAction, AutoChatActionFlavor } from '@grammyjs/auto-chat-action';

type MyContext = Context & AutoChatActionFlavor;
const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN!);

// Auto-retry on rate limits (429) and server errors (5xx)
bot.api.config.use(autoRetry());

// Auto typing indicator during processing
bot.use(autoChatAction());

// Ensure same-chat messages process in order
bot.use(sequentialize((ctx) => ctx.chat?.id.toString()));

// Error handling
bot.catch((err) => {
  const ctx = err.ctx;
  logger.error({
    updateId: ctx.update.update_id,
    error: err.error
  }, 'Error handling update');
});

// Graceful shutdown
const handle = run(bot);
process.on('SIGINT', () => handle.stop());
process.on('SIGTERM', () => handle.stop());
```

### Pattern 3: Message Queue with Disk Persistence

**What:** Simple JSON file queue for crash recovery.

**Example:**
```typescript
import { writeFileSync, readFileSync, existsSync } from 'fs';

interface QueuedMessage {
  id: string;
  chatId: number;
  text: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'done';
}

class MessageQueue {
  private queue: QueuedMessage[] = [];
  private path: string;

  constructor(path: string) {
    this.path = path;
    this.load();
  }

  private load(): void {
    if (existsSync(this.path)) {
      const data = readFileSync(this.path, 'utf-8');
      this.queue = JSON.parse(data);
      // Resume pending/processing on restart
      this.queue = this.queue.filter(m => m.status !== 'done');
      this.queue.forEach(m => { m.status = 'pending'; });
      this.persist();
    }
  }

  private persist(): void {
    writeFileSync(this.path, JSON.stringify(this.queue, null, 2));
  }

  add(chatId: number, text: string): string {
    const id = crypto.randomUUID();
    this.queue.push({ id, chatId, text, timestamp: Date.now(), status: 'pending' });
    this.persist();
    return id;
  }

  take(): QueuedMessage | undefined {
    const msg = this.queue.find(m => m.status === 'pending');
    if (msg) {
      msg.status = 'processing';
      this.persist();
    }
    return msg;
  }

  complete(id: string): void {
    const msg = this.queue.find(m => m.id === id);
    if (msg) {
      msg.status = 'done';
      // Remove completed messages older than 1 hour
      const cutoff = Date.now() - 3600000;
      this.queue = this.queue.filter(m => m.status !== 'done' || m.timestamp > cutoff);
      this.persist();
    }
  }
}
```

### Pattern 4: Moltbot-Style Pairing Flow

**What:** Security via pairing codes, CLI approval, persistent allowlist.

**Source:** [moltbot documentation](https://github.com/moltbot/moltbot)

```typescript
// Pairing store
interface PairingState {
  approved: Map<number, { approvedAt: number; username?: string }>;
  pending: Map<string, { chatId: number; requestedAt: number; username?: string }>;
}

class PairingStore {
  private state: PairingState;
  private path: string;

  generateCode(): string {
    // 6-character alphanumeric code
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  requestPairing(chatId: number, username?: string): string {
    const code = this.generateCode();
    this.state.pending.set(code, { chatId, requestedAt: Date.now(), username });
    this.persist();
    logger.info({ code, chatId, username }, 'Pairing requested');
    return code;
  }

  approvePairing(code: string): { chatId: number } | null {
    const pending = this.state.pending.get(code);
    if (!pending) return null;

    this.state.approved.set(pending.chatId, {
      approvedAt: Date.now(),
      username: pending.username
    });
    this.state.pending.delete(code);
    this.persist();
    logger.info({ code, chatId: pending.chatId }, 'Pairing approved');
    return { chatId: pending.chatId };
  }

  isApproved(chatId: number): boolean {
    return this.state.approved.has(chatId);
  }
}

// Telegram command handler
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id;

  if (pairingStore.isApproved(chatId)) {
    return ctx.reply('You are already paired.');
  }

  const code = pairingStore.requestPairing(chatId, ctx.from?.username);
  return ctx.reply(`Pairing code: ${code}\n\nRun this on the server:\nklausbot pairing approve telegram ${code}`);
});

// Middleware to block unapproved users
bot.use(async (ctx, next) => {
  if (!pairingStore.isApproved(ctx.chat?.id ?? 0)) {
    return ctx.reply('Waiting for approval. Contact the bot owner.');
  }
  return next();
});
```

### Pattern 5: Message Splitting for 4096 Limit

**What:** Auto-split long responses at sentence boundaries.

```typescript
const MAX_LENGTH = 4096;

function splitMessage(text: string): string[] {
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_LENGTH) {
    // Try to split at sentence boundary
    let splitIdx = remaining.lastIndexOf('. ', MAX_LENGTH);
    if (splitIdx === -1 || splitIdx < MAX_LENGTH / 2) {
      // Fallback to word boundary
      splitIdx = remaining.lastIndexOf(' ', MAX_LENGTH);
    }
    if (splitIdx === -1) {
      // Hard split if no boundary found
      splitIdx = MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIdx + 1).trim());
    remaining = remaining.slice(splitIdx + 1).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

// Usage in reply
async function sendLongMessage(ctx: Context, text: string): Promise<void> {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}
```

### Anti-Patterns to Avoid

- **Piping all stdio to Claude Code:** Causes indefinite hang. Always inherit stdin.
- **Sequential processing with bot.start():** Use runner plugin for concurrent handling.
- **Manual retry on rate limits:** Use auto-retry plugin instead.
- **Blocking main thread during Claude response:** Use proper async/await and don't block polling.
- **Storing secrets in code:** Use environment variables, load via dotenv.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limit handling | Custom retry logic | @grammyjs/auto-retry | Handles 429s, 5xx, exponential backoff |
| Typing indicator | setInterval loop | @grammyjs/auto-chat-action | Automatically loops during processing |
| Concurrent updates | Custom Promise.all | @grammyjs/runner | Handles sequentializing, timeouts, errors |
| CLI wizard | raw readline | @inquirer/prompts | Cross-platform, validation, TypeScript |
| Structured logging | console.log + JSON.stringify | pino | Performance, child loggers, redaction |
| Process management | Custom daemon code | systemd | Auto-restart, logging, boot startup |

**Key insight:** grammY's plugin ecosystem handles most Telegram-specific complexity. Don't reinvent it.

## Common Pitfalls

### Pitfall 1: Claude Code Spawn Hanging

**What goes wrong:** Claude Code CLI hangs indefinitely when spawned with all stdio piped.
**Why it happens:** Bug in Claude Code's TTY detection when stdin is piped from Node.js.
**How to avoid:** Use `stdio: ['inherit', 'pipe', 'pipe']` - stdin must inherit.
**Warning signs:** Process never emits 'close' event, no stdout/stderr output.
**Confidence:** HIGH - [GitHub issue #771](https://github.com/anthropics/claude-code/issues/771)

### Pitfall 2: Messages Lost on Restart

**What goes wrong:** Bot restarts during processing, queued messages disappear.
**Why it happens:** In-memory queue not persisted to disk.
**How to avoid:** Persist queue to JSON file on every add/status change.
**Warning signs:** Users report missing responses after server maintenance.

### Pitfall 3: Rate Limit Cascade

**What goes wrong:** Bot hits Telegram rate limit, manual retry logic creates thundering herd.
**Why it happens:** Multiple messages retry simultaneously after rate limit expires.
**How to avoid:** Use auto-retry plugin with exponential backoff (3s start, 1hr cap).
**Warning signs:** 429 errors clustering in logs, followed by more 429s.

### Pitfall 4: Chat Order Scrambling

**What goes wrong:** Messages from same chat processed out of order.
**Why it happens:** Concurrent processing without sequentialization.
**How to avoid:** Use `sequentialize((ctx) => ctx.chat?.id.toString())` middleware.
**Warning signs:** Responses appear before questions in conversation.

### Pitfall 5: 4096 Character Truncation

**What goes wrong:** Long Claude responses silently truncated or throw error.
**Why it happens:** Telegram API rejects messages > 4096 chars.
**How to avoid:** Split messages at sentence/word boundaries before sending.
**Warning signs:** "MESSAGE_TOO_LONG" errors in logs, incomplete responses.

### Pitfall 6: Pairing Code Collision

**What goes wrong:** Same pairing code issued to different users.
**Why it happens:** Weak random generation or no collision check.
**How to avoid:** Use crypto.randomBytes, check pending codes before issuing.
**Warning signs:** Wrong user gets approved access.

## Code Examples

### Complete Bot Setup with All Plugins

```typescript
// Source: grammY docs (grammy.dev)
import { Bot, Context, GrammyError, HttpError } from 'grammy';
import { run, sequentialize } from '@grammyjs/runner';
import { autoRetry } from '@grammyjs/auto-retry';
import { autoChatAction, AutoChatActionFlavor } from '@grammyjs/auto-chat-action';
import pino from 'pino';

type MyContext = Context & AutoChatActionFlavor;

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN!);

// Configure API-level plugins
bot.api.config.use(autoRetry({
  maxRetryAttempts: 3,
  maxDelaySeconds: 300,  // Don't wait more than 5 min
}));

// Configure middleware-level plugins
bot.use(autoChatAction());
bot.use(sequentialize((ctx) => ctx.chat?.id.toString()));

// Error boundary
bot.catch((err) => {
  const ctx = err.ctx;
  const e = err.error;

  if (e instanceof GrammyError) {
    logger.error({ code: e.error_code, desc: e.description }, 'Telegram API error');
  } else if (e instanceof HttpError) {
    logger.error({ error: e.error }, 'Network error');
  } else {
    logger.error({ error: e }, 'Unknown error');
  }
});

// Start with graceful shutdown
const handle = run(bot);

const shutdown = async () => {
  logger.info('Shutting down...');
  await handle.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('Bot started');
```

### systemd Service Unit

```ini
# /etc/systemd/system/klausbot.service
[Unit]
Description=Klausbot Telegram Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=klausbot
Group=klausbot
WorkingDirectory=/opt/klausbot
ExecStart=/usr/bin/node dist/index.js daemon
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/klausbot/data

[Install]
WantedBy=multi-user.target
```

### CLI Install Wizard with Inquirer

```typescript
// Source: @inquirer/prompts docs
import { input, confirm, select } from '@inquirer/prompts';
import { execSync } from 'child_process';

async function installWizard(): Promise<void> {
  console.log('Klausbot Installation Wizard\n');

  const botToken = await input({
    message: 'Enter your Telegram Bot Token:',
    validate: (v) => v.includes(':') || 'Invalid token format',
  });

  const deployMode = await select({
    message: 'Deployment mode:',
    choices: [
      { name: 'systemd service (recommended)', value: 'systemd' },
      { name: 'Docker container', value: 'docker' },
      { name: 'Development (foreground)', value: 'dev' },
    ],
  });

  if (deployMode === 'systemd') {
    // Check if systemd available
    try {
      execSync('systemctl --version', { stdio: 'ignore' });
    } catch {
      console.error('systemd not available. Use Docker or dev mode.');
      process.exit(1);
    }

    const installNow = await confirm({
      message: 'Install and start systemd service now?',
      default: true,
    });

    if (installNow) {
      // Write config, install service, enable and start
      // ...
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Telegraf | grammY | 2023-2024 | Better TypeScript, faster Bot API updates |
| bot.start() polling | runner plugin | Always available | 10x throughput, proper concurrency |
| winston logging | pino | 2024-2025 | 5x faster, JSON by default |
| Manual retry logic | auto-retry plugin | Always available | Correct backoff, handles edge cases |
| PM2 for Node.js | systemd | Depends on needs | Native, lighter, better security options |

**Deprecated/outdated:**
- Telegraf: Still maintained but lags behind Bot API
- node-telegram-bot-api: Callback-based, unmaintained patterns
- Manual typing indicator loops: Use auto-chat-action plugin

## Open Questions

1. **Claude Code spawn workaround longevity**
   - What we know: `stdio: ['inherit', 'pipe', 'pipe']` resolves hang
   - What's unclear: Will Anthropic fix underlying bug? Is workaround permanent?
   - Recommendation: Use workaround, monitor issue #771 for updates

2. **Status message progression timing**
   - What we know: Can update messages with `ctx.api.editMessageText()`
   - What's unclear: Optimal timing for "Thinking..." -> "Reading files..." transitions
   - Recommendation: Research Claude Code's streaming output for progress signals

3. **Slash command pass-through to Claude Code**
   - What we know: CONTEXT.md mentions `/help` forwarding to Claude commands
   - What's unclear: How `claude -p "/help"` behaves - does it execute internal commands?
   - Recommendation: Test during implementation, may need custom handling

## Sources

### Primary (HIGH confidence)
- [grammY Documentation](https://grammy.dev/) - Bot setup, plugins, middleware
- [grammY runner plugin](https://grammy.dev/plugins/runner) - Concurrent processing
- [grammY auto-retry plugin](https://grammy.dev/plugins/auto-retry) - Rate limit handling
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) - -p flag, output formats
- [Claude Code Issue #771](https://github.com/anthropics/claude-code/issues/771) - Spawn hang bug

### Secondary (MEDIUM confidence)
- [moltbot pairing](https://github.com/moltbot/moltbot) - Pairing flow reference
- [Telegram Limits](https://limits.tginfo.me/en) - 4096 char message limit
- [pino vs winston](https://betterstack.com/community/comparisons/pino-vs-winston/) - Logger comparison
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) - CLI wizard

### Tertiary (LOW confidence - needs validation)
- better-queue-sqlite TypeScript support - verify @types availability
- Status message update frequency limits - test empirically

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - grammY and plugins well-documented, actively maintained
- Architecture patterns: MEDIUM-HIGH - spawn workaround verified, queue patterns standard
- Pitfalls: HIGH - documented bugs and edge cases from official sources

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable domain, monitor Claude Code spawn issue)
