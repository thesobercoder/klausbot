import { bot, createRunner, type MyContext } from '../telegram/index.js';
import { MessageQueue, queryClaudeCode, ensureDataDir } from './index.js';
import type { QueuedMessage } from './queue.js';
import {
  initPairingStore,
  createPairingMiddleware,
  handleStartCommand,
  getPairingStore,
} from '../pairing/index.js';
import { config } from '../config/index.js';
import { createChildLogger, sendLongMessage } from '../utils/index.js';
import { autoCommitChanges } from '../utils/git.js';
import {
  initializeHome,
  initializeIdentity,
  initializeEmbeddings,
  logUserMessage,
  logAssistantMessage,
  invalidateIdentityCache,
} from '../memory/index.js';
import { needsBootstrap, BOOTSTRAP_INSTRUCTIONS } from '../bootstrap/index.js';

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

  // Initialize ~/.klausbot/ data home and identity files
  initializeHome(log);
  initializeIdentity(log);
  initializeEmbeddings();

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

    const text = ctx.message?.text ?? '';

    // Skip empty messages
    if (!text.trim()) return;

    // Add to queue - typing indicator shown by autoChatAction middleware
    const queueId = queue.add(chatId, text);
    log.info({ chatId, queueId }, 'Message queued');

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
 */
async function processMessage(msg: QueuedMessage): Promise<void> {
  const startTime = Date.now();

  // Send typing indicator continuously while processing
  // Telegram typing indicator lasts ~5 seconds, so refresh every 4
  const sendTyping = () => {
    bot.api.sendChatAction(msg.chatId, 'typing').catch(() => {
      // Ignore errors - chat may be unavailable
    });
  };
  sendTyping(); // Send immediately
  const typingInterval = setInterval(sendTyping, 4000);

  try {
    // Log user message BEFORE processing (per CONTEXT.md: log original message)
    logUserMessage(msg.text);

    // Check if bootstrap needed BEFORE processing
    const isBootstrap = needsBootstrap();
    if (isBootstrap) {
      log.info({ chatId: msg.chatId }, 'Bootstrap mode: identity files missing');
    }

    // Call Claude (append bootstrap instructions if needed)
    const response = await queryClaudeCode(msg.text, {
      additionalInstructions: isBootstrap ? BOOTSTRAP_INSTRUCTIONS : undefined,
    });

    // Stop typing indicator
    clearInterval(typingInterval);

    // Mark as complete
    queue.complete(msg.id);

    // Send response (handles splitting for long messages)
    if (response.is_error) {
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

      const messages = await splitAndSend(msg.chatId, response.result);
      log.debug({ chatId: msg.chatId, chunks: messages }, 'Sent response chunks');
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
    // Stop typing indicator
    clearInterval(typingInterval);

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
 * Split and send a long message directly via bot API
 */
async function splitAndSend(chatId: number, text: string): Promise<number> {
  const MAX_LENGTH = 4096;
  const chunks: string[] = [];

  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at sentence boundary
    let splitPoint = remaining.lastIndexOf('. ', MAX_LENGTH);
    if (splitPoint === -1 || splitPoint < MAX_LENGTH * 0.5) {
      // Try word boundary
      splitPoint = remaining.lastIndexOf(' ', MAX_LENGTH);
    }
    if (splitPoint === -1 || splitPoint < MAX_LENGTH * 0.5) {
      // Hard split
      splitPoint = MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitPoint + 1));
    remaining = remaining.slice(splitPoint + 1);
  }

  // Send chunks with delay
  for (const chunk of chunks) {
    await bot.api.sendMessage(chatId, chunk);
    if (chunks.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return chunks.length;
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
