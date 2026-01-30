import { bot, createRunner, type MyContext, registerSkillCommands, getInstalledSkillNames, translateSkillCommand } from '../telegram/index.js';
import { MessageQueue, ensureDataDir } from './index.js';
import { queryWithStreaming } from './acp-client.js';
import type { QueuedMessage } from './queue.js';
import {
  initPairingStore,
  createPairingMiddleware,
  handleStartCommand,
  getPairingStore,
} from '../pairing/index.js';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/index.js';
import { autoCommitChanges } from '../utils/git.js';
import {
  initializeHome,
  initializeEmbeddings,
  logUserMessage,
  logAssistantMessage,
  invalidateIdentityCache,
} from '../memory/index.js';
import { needsBootstrap, BOOTSTRAP_INSTRUCTIONS } from '../bootstrap/index.js';
import { ensureSkillCreator } from '../cli/skills.js';
import { startScheduler, stopScheduler, loadCronStore } from '../cron/index.js';

const log = createChildLogger('gateway');

/** Module state */
let queue: MessageQueue;
let isProcessing = false;
let shouldStop = false;


/**
 * Start the gateway daemon
 * Initializes all components and begins processing
 */
export async function startGateway(): Promise<void> {
  log.info('Starting gateway...');

  // Initialize ~/.klausbot/ data home (directories only)
  // NOTE: Do NOT call initializeIdentity() here - bootstrap flow creates identity files
  initializeHome(log);
  initializeEmbeddings();

  // Initialize cron system
  startScheduler();
  log.info({ jobs: loadCronStore().jobs.filter(j => j.enabled).length }, 'Cron scheduler initialized');

  // Auto-install skill-creator if missing
  await ensureSkillCreator();

  // Register skill commands in Telegram menu
  await registerSkillCommands(bot);
  log.info({ skills: getInstalledSkillNames() }, 'Registered skill commands');

  // Initialize data directory and components
  ensureDataDir(config.DATA_DIR);
  queue = new MessageQueue(config.DATA_DIR);
  initPairingStore(config.DATA_DIR);

  // Log startup stats
  const stats = queue.getStats();
  const pairingStore = getPairingStore();
  const approvedCount = pairingStore.listApproved().length;
  const pendingCount = pairingStore.listPending().length;

  log.info(
    {
      pending: stats.pending,
      failed: stats.failed,
      approvedUsers: approvedCount,
      pendingPairings: pendingCount,
    },
    'Gateway initialized'
  );

  // Setup middleware - ORDER MATTERS
  // 1. Pairing middleware first (blocks unapproved)
  bot.use(createPairingMiddleware());

  // 2. Commands
  bot.command('start', handleStartCommand);

  bot.command('model', async (ctx: MyContext) => {
    await ctx.reply('Current model: default\nModel switching coming in Phase 2');
  });

  bot.command('status', async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const queueStats = queue.getStats();
    const store = getPairingStore();
    const isApproved = store.isApproved(chatId);

    const statusMsg = [
      '*Queue Status*',
      `Pending: ${queueStats.pending}`,
      `Processing: ${queueStats.processing}`,
      `Failed: ${queueStats.failed}`,
      '',
      `*Your Status*`,
      `Approved: ${isApproved ? 'Yes' : 'No'}`,
    ].join('\n');

    await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
  });

  bot.command('help', async (ctx: MyContext) => {
    const helpMsg = [
      '*Available Commands*',
      '/start - Request pairing or check status',
      '/status - Show queue and approval status',
      '/model - Show current model info',
      '/crons - List scheduled tasks',
      '/help - Show this help message',
      '',
      'Send any message to chat with Claude.',
    ].join('\n');

    await ctx.reply(helpMsg, { parse_mode: 'Markdown' });
  });

  // 3. Message handler
  bot.on('message:text', async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const rawText = ctx.message?.text ?? '';

    // Skip empty messages
    if (!rawText.trim()) return;

    // Translate skill commands: /skill_creator → /skill skill-creator
    const text = translateSkillCommand(rawText);

    // Add to queue - typing indicator shown by autoChatAction middleware
    const queueId = queue.add(chatId, text);
    log.info({ chatId, queueId, translated: text !== rawText }, 'Message queued');

    // Trigger processing (non-blocking)
    processQueue().catch((err) => {
      log.error({ err }, 'Queue processing error');
    });
  });

  // Handle non-text messages
  bot.on('message', async (ctx: MyContext) => {
    await ctx.reply('I only understand text messages for now.');
  });

  // Start processing loop in background
  processQueue().catch((err) => {
    log.error({ err }, 'Initial queue processing error');
  });

  // Create runner
  const runner = createRunner();
  log.info('Gateway running');

  // Set up shutdown handlers
  const shutdown = async () => {
    log.info('Shutdown signal received');
    await stopGateway();
    await runner.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Wait for runner to stop (blocks until shutdown signal)
  await runner.task();
}

/**
 * Stop the gateway gracefully
 */
export async function stopGateway(): Promise<void> {
  log.info('Stopping gateway...');
  shouldStop = true;

  // Stop cron scheduler
  stopScheduler();

  // Wait for current processing to finish (max 30s)
  const timeout = 30000;
  const start = Date.now();
  while (isProcessing && Date.now() - start < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (isProcessing) {
    log.warn('Timed out waiting for processing to complete');
  }

  log.info('Gateway stopped');
}

/**
 * Process messages from queue
 * Runs as background loop
 */
async function processQueue(): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) return;
  isProcessing = true;

  while (!shouldStop) {
    const msg = queue.take();

    if (!msg) {
      // No messages, wait and try again
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }

    await processMessage(msg);
  }

  isProcessing = false;
}

/**
 * Process a single queued message
 * Uses ACP streaming - response streams to Telegram as it's generated
 */
async function processMessage(msg: QueuedMessage): Promise<void> {
  const startTime = Date.now();

  try {
    // Log user message BEFORE processing (per CONTEXT.md: log original message)
    logUserMessage(msg.text);

    // Check if bootstrap needed BEFORE processing
    const isBootstrap = needsBootstrap();
    if (isBootstrap) {
      log.info({ chatId: msg.chatId }, 'Bootstrap mode: identity files missing');
    }

    // Build additional instructions
    // Always include chatId context for MCP cron tools
    const chatIdContext = `<session-context>
Current chat ID: ${msg.chatId}
Use this chatId when creating cron jobs.
</session-context>`;

    const additionalInstructions = isBootstrap
      ? chatIdContext + '\n\n' + BOOTSTRAP_INSTRUCTIONS
      : chatIdContext;

    // Call Claude via ACP with streaming to Telegram
    // Response streams as it's generated - no typing indicator needed
    const response = await queryWithStreaming(msg.text, {
      additionalInstructions,
      bot,
      chatId: msg.chatId,
    });

    // Mark as complete
    queue.complete(msg.id);

    // Handle response
    if (response.is_error) {
      // Error during ACP query - send error message
      await bot.api.sendMessage(
        msg.chatId,
        `Error (Claude): ${response.result}`
      );
    } else {
      // Log assistant response AFTER success
      logAssistantMessage(response.result);

      // Invalidate identity cache after Claude response
      // Claude may have updated identity files during session
      invalidateIdentityCache();

      // Note: Response already streamed to Telegram via TelegramStreamer
    }

    const duration = Date.now() - startTime;
    log.info(
      { chatId: msg.chatId, queueId: msg.id, duration, cost: response.cost_usd },
      'Message processed'
    );

    // Auto-commit any file changes Claude made
    const committed = await autoCommitChanges();
    if (committed) {
      log.info({ queueId: msg.id }, 'Auto-committed Claude file changes');
    }
  } catch (err) {
    // Determine error category
    const error = err instanceof Error ? err : new Error(String(err));
    const category = categorizeError(error);
    const userMessage = `Error (${category}): ${getBriefDescription(error)}`;

    // Send error to user
    await bot.api.sendMessage(msg.chatId, userMessage).catch(() => {});

    // Mark as failed
    queue.fail(msg.id, error.message);

    log.error(
      { chatId: msg.chatId, queueId: msg.id, error: error.message, category },
      'Message failed'
    );
  }
}

/**
 * Categorize error for user-friendly display
 */
function categorizeError(error: Error): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'timeout';
  }
  if (msg.includes('spawn') || msg.includes('failed to start')) {
    return 'spawn';
  }
  if (msg.includes('parse') || msg.includes('json')) {
    return 'parse';
  }
  if (msg.includes('exit')) {
    return 'process';
  }

  return 'unknown';
}

/**
 * Get brief error description (no stack traces)
 */
function getBriefDescription(error: Error): string {
  const msg = error.message;

  // Truncate long messages
  if (msg.length > 200) {
    return msg.slice(0, 200) + '...';
  }

  return msg;
}
