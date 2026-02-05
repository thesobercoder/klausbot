import type { MyContext } from "../telegram/index.js";
import { MessageQueue, queryClaudeCode, ensureDataDir } from "./index.js";
import { getJsonConfig } from "../config/index.js";
import type { QueuedMessage } from "./queue.js";
import {
  initPairingStore,
  createPairingMiddleware,
  handleStartCommand,
  getPairingStore,
} from "../pairing/index.js";
import { KLAUSBOT_HOME } from "../memory/home.js";
import { createChildLogger, sendLongMessage } from "../utils/index.js";
import { autoCommitChanges } from "../utils/git.js";
import {
  initializeHome,
  initializeEmbeddings,
  migrateEmbeddings,
  closeDb,
  invalidateIdentityCache,
  runMigrations,
} from "../memory/index.js";
import { needsBootstrap, BOOTSTRAP_INSTRUCTIONS } from "../bootstrap/index.js";
import { validateRequiredCapabilities } from "../platform/index.js";
import { startScheduler, stopScheduler, loadCronStore } from "../cron/index.js";
import {
  MediaAttachment,
  transcribeAudio,
  isTranscriptionAvailable,
  saveImage,
  withRetry,
  downloadFile,
} from "../media/index.js";
import { unlinkSync } from "fs";
import os from "os";
import path from "path";

const log = createChildLogger("gateway");

/** Module state */
let queue: MessageQueue;
let isProcessing = false;
let shouldStop = false;

/** Bot instance (loaded dynamically after config validation) */
let bot: Awaited<typeof import("../telegram/index.js")>["bot"];

/**
 * Pre-process media attachments before Claude query
 * - Voice: transcribe and delete audio file
 * - Photo: save to images directory
 *
 * @returns Processed attachments with transcripts/paths filled in
 */
async function processMedia(
  attachments: MediaAttachment[],
): Promise<{ processed: MediaAttachment[]; errors: string[] }> {
  const processed: MediaAttachment[] = [];
  const errors: string[] = [];

  for (const attachment of attachments) {
    const startTime = Date.now();

    if (attachment.type === "voice") {
      // Transcribe voice
      if (!isTranscriptionAvailable()) {
        errors.push(
          "Voice transcription not available (OPENAI_API_KEY missing)",
        );
        continue;
      }

      if (!attachment.localPath) {
        errors.push("Voice file not downloaded");
        continue;
      }

      try {
        const result = await withRetry(() =>
          transcribeAudio(attachment.localPath!),
        );

        // Delete audio file after transcription (per CONTEXT.md)
        try {
          unlinkSync(attachment.localPath);
        } catch {
          // Ignore delete errors
        }

        processed.push({
          ...attachment,
          transcript: result.text,
          processingTimeMs: Date.now() - startTime,
          localPath: undefined, // Clear path since file deleted
        });

        log.info(
          {
            type: "voice",
            transcriptLength: result.text.length,
            durationMs: result.durationMs,
          },
          "Transcribed voice message",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Transcription failed: ${msg}`);
        log.error(
          { err, localPath: attachment.localPath },
          "Voice transcription failed",
        );
      }
    } else if (attachment.type === "photo") {
      // Save image
      if (!attachment.localPath) {
        errors.push("Image file not downloaded");
        continue;
      }

      try {
        const savedPath = saveImage(attachment.localPath);

        processed.push({
          ...attachment,
          localPath: savedPath, // Update to permanent path
          processingTimeMs: Date.now() - startTime,
        });

        log.info({ type: "photo", savedPath }, "Saved image");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to save image: ${msg}`);
        log.error(
          { err, localPath: attachment.localPath },
          "Image save failed",
        );
      }
    }
  }

  return { processed, errors };
}

/**
 * Build prompt text incorporating media context
 */
function buildPromptWithMedia(text: string, media: MediaAttachment[]): string {
  const voiceTranscripts = media
    .filter((m) => m.type === "voice" && m.transcript)
    .map((m) => m.transcript);

  const imagePaths = media
    .filter((m) => m.type === "photo" && m.localPath)
    .map((m) => m.localPath!);

  let prompt = text;

  // If voice-only (no text), use transcript as prompt
  if (!text.trim() && voiceTranscripts.length > 0) {
    prompt = voiceTranscripts.join("\n");
  } else if (voiceTranscripts.length > 0) {
    // Text + voice: prepend transcript context
    prompt = `[Voice message transcript: ${voiceTranscripts.join(" ")}]\n\n${text}`;
  }

  // Add image references for Claude to read
  if (imagePaths.length > 0) {
    const imageInstructions = imagePaths
      .map((p, i) => `Image ${i + 1}: ${p}`)
      .join("\n");

    prompt = `The user sent ${imagePaths.length} image(s). Read and analyze them using your Read tool:\n${imageInstructions}\n\n${prompt || "(no text, just the image(s))"}`;
  }

  return prompt;
}

/**
 * Start the gateway daemon
 * Initializes all components and begins processing
 */
export async function startGateway(): Promise<void> {
  // Validate required capabilities first (exits if missing)
  // No logging before this - validation must pass first
  await validateRequiredCapabilities();

  // Dynamic import telegram module AFTER validation passes
  // This prevents bot.ts from loading config before we verify it exists
  const telegram = await import("../telegram/index.js");
  bot = telegram.bot;
  const {
    createRunner,
    registerSkillCommands,
    getInstalledSkillNames,
    translateSkillCommand,
  } = telegram;

  log.info("Starting gateway...");

  // Initialize ~/.klausbot/ data home (directories only)
  // NOTE: Do NOT call initializeIdentity() here - bootstrap flow creates identity files
  initializeHome(log);
  initializeEmbeddings();

  // Run database migrations (creates tables if needed)
  runMigrations();
  log.info("Database migrations complete");

  // Migrate embeddings from JSON to SQLite (idempotent)
  await migrateEmbeddings();

  // Log media capabilities
  log.info(
    {
      voiceTranscription: isTranscriptionAvailable(),
      imageAnalysis: true, // Always available (Claude vision)
    },
    "Media capabilities",
  );

  // Initialize cron system
  startScheduler();
  log.info(
    { jobs: loadCronStore().jobs.filter((j) => j.enabled).length },
    "Cron scheduler initialized",
  );

  // Register skill commands in Telegram menu
  await registerSkillCommands(bot);
  log.info({ skills: getInstalledSkillNames() }, "Registered skill commands");

  // Initialize data directory and components
  ensureDataDir(KLAUSBOT_HOME);
  queue = new MessageQueue(KLAUSBOT_HOME);
  initPairingStore(KLAUSBOT_HOME);

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
    "Gateway initialized",
  );

  // Setup middleware - ORDER MATTERS
  // 1. Pairing middleware first (blocks unapproved)
  bot.use(createPairingMiddleware());

  // 2. Commands
  bot.command("start", handleStartCommand);

  bot.command("model", async (ctx: MyContext) => {
    await ctx.reply(
      "Current model: default\nModel switching coming in Phase 2",
    );
  });

  bot.command("status", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const queueStats = queue.getStats();
    const store = getPairingStore();
    const isApproved = store.isApproved(chatId);

    const statusMsg = [
      "*Queue Status*",
      `Pending: ${queueStats.pending}`,
      `Processing: ${queueStats.processing}`,
      `Failed: ${queueStats.failed}`,
      "",
      `*Your Status*`,
      `Approved: ${isApproved ? "Yes" : "No"}`,
    ].join("\n");

    await ctx.reply(statusMsg, { parse_mode: "Markdown" });
  });

  bot.command("help", async (ctx: MyContext) => {
    const helpMsg = [
      "*Available Commands*",
      "/start - Request pairing or check status",
      "/status - Show queue and approval status",
      "/model - Show current model info",
      "/crons - List scheduled tasks",
      "/help - Show this help message",
      "",
      "Send any message to chat with Claude.",
    ].join("\n");

    await ctx.reply(helpMsg, { parse_mode: "Markdown" });
  });

  // 3. Message handler
  bot.on("message:text", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const rawText = ctx.message?.text ?? "";

    // Skip empty messages
    if (!rawText.trim()) return;

    // Translate skill commands: /skill_creator → /skill skill-creator
    const text = translateSkillCommand(rawText);

    // Add to queue - typing indicator shown by autoChatAction middleware
    const queueId = queue.add(chatId, text);
    log.info(
      { chatId, queueId, translated: text !== rawText },
      "Message queued",
    );

    // Trigger processing (non-blocking)
    processQueue().catch((err) => {
      log.error({ err }, "Queue processing error");
    });
  });

  // Voice message handler
  bot.on("message:voice", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const voice = ctx.message?.voice;
    if (!voice) return;

    log.info(
      { chatId, fileId: voice.file_id, duration: voice.duration },
      "Received voice message",
    );

    // Download voice file to temp location
    const tempPath = path.join(os.tmpdir(), `klausbot-voice-${Date.now()}.ogg`);

    try {
      await downloadFile(bot, voice.file_id, tempPath);

      const media: MediaAttachment[] = [
        {
          type: "voice",
          fileId: voice.file_id,
          localPath: tempPath,
          mimeType: voice.mime_type,
        },
      ];

      // Voice messages don't have captions in Telegram
      const text = "";

      const queueId = queue.add(chatId, text, media);
      log.info({ chatId, queueId, mediaCount: 1 }, "Voice message queued");

      processQueue().catch((err) => {
        log.error({ err }, "Queue processing error");
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err, chatId }, "Failed to download voice message");
      await ctx.reply(`Failed to process voice message: ${msg}`);
    }
  });

  // Photo message handler
  bot.on("message:photo", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const photos = ctx.message?.photo;
    if (!photos || photos.length === 0) return;

    // Get largest photo (last in array)
    const largest = photos[photos.length - 1];

    log.info(
      {
        chatId,
        fileId: largest.file_id,
        width: largest.width,
        height: largest.height,
      },
      "Received photo message",
    );

    // Download photo to temp location
    const tempPath = path.join(os.tmpdir(), `klausbot-photo-${Date.now()}.jpg`);

    try {
      await downloadFile(bot, largest.file_id, tempPath);

      const media: MediaAttachment[] = [
        {
          type: "photo",
          fileId: largest.file_id,
          localPath: tempPath,
        },
      ];

      // Get caption if any
      const text = ctx.message?.caption ?? "";

      const queueId = queue.add(chatId, text, media);
      log.info(
        { chatId, queueId, mediaCount: 1, hasCaption: !!text },
        "Photo message queued",
      );

      processQueue().catch((err) => {
        log.error({ err }, "Queue processing error");
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err, chatId }, "Failed to download photo");
      await ctx.reply(`Failed to process photo: ${msg}`);
    }
  });

  // Media group handler (multiple photos in one message)
  // Note: grammY fires message:photo for each photo in a media group
  // We handle them individually - they'll be queued separately
  // Future enhancement: collect media groups using message.media_group_id

  // Catch-all for unsupported message types
  bot.on("message", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const messageType = Object.keys(ctx.message ?? {}).find(
      (key) =>
        ![
          "message_id",
          "from",
          "chat",
          "date",
          "text",
          "voice",
          "photo",
          "caption",
          "entities",
        ].includes(key),
    );

    log.info({ chatId, messageType }, "Received unsupported message type");

    await ctx.reply(
      "I can process text, voice messages, and photos. Other message types are not yet supported.",
    );
  });

  // Start processing loop in background
  processQueue().catch((err) => {
    log.error({ err }, "Initial queue processing error");
  });

  // Create runner
  const runner = createRunner();
  log.info("Gateway running");

  // Set up shutdown handlers
  const shutdown = async () => {
    log.info("Shutdown signal received");
    await stopGateway();
    await runner.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Wait for runner to stop (blocks until shutdown signal)
  await runner.task();
}

/**
 * Stop the gateway gracefully
 */
export async function stopGateway(): Promise<void> {
  log.info("Stopping gateway...");
  shouldStop = true;

  // Stop cron scheduler
  stopScheduler();

  // Close database connection
  closeDb();

  // Wait for current processing to finish (max 30s)
  const timeout = 30000;
  const start = Date.now();
  while (isProcessing && Date.now() - start < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (isProcessing) {
    log.warn("Timed out waiting for processing to complete");
  }

  log.info("Gateway stopped");
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
    bot.api.sendChatAction(msg.chatId, "typing").catch(() => {
      // Ignore errors - chat may be unavailable
    });
  };
  sendTyping(); // Send immediately
  const typingInterval = setInterval(sendTyping, 4000);

  try {
    // Process media attachments if present
    let effectiveText = msg.text;
    let mediaErrors: string[] = [];

    if (msg.media && msg.media.length > 0) {
      const { processed, errors } = await processMedia(msg.media);
      mediaErrors = errors;

      if (processed.length > 0) {
        effectiveText = buildPromptWithMedia(msg.text, processed);
      }
    }

    // If all media failed and no text, send error and return
    if (mediaErrors.length > 0 && !effectiveText.trim()) {
      clearInterval(typingInterval);
      queue.fail(msg.id, mediaErrors.join("; "));
      await bot.api.sendMessage(
        msg.chatId,
        `Could not process media: ${mediaErrors.join(". ")}`,
      );
      return;
    }

    // Check if bootstrap needed BEFORE processing
    const isBootstrap = needsBootstrap();
    if (isBootstrap) {
      log.info(
        { chatId: msg.chatId },
        "Bootstrap mode: identity files missing",
      );
    }

    // Build additional instructions
    // Always include chatId context for cron management
    const chatIdContext = `<session-context>
Current chat ID: ${msg.chatId}
Use this chatId when creating cron jobs.
</session-context>`;

    const additionalInstructions = isBootstrap
      ? chatIdContext + "\n\n" + BOOTSTRAP_INSTRUCTIONS
      : chatIdContext;

    // Call Claude (with media-enriched prompt if applicable)
    const jsonConfig = getJsonConfig();
    const response = await queryClaudeCode(effectiveText, {
      additionalInstructions,
      model: jsonConfig.model,
    });

    // Stop typing indicator
    clearInterval(typingInterval);

    // Mark as complete
    queue.complete(msg.id);

    // Send response (handles splitting for long messages)
    if (response.is_error) {
      await bot.api.sendMessage(
        msg.chatId,
        `Error (Claude): ${response.result}`,
      );
    } else {
      // Invalidate identity cache after Claude response
      // Claude may have updated identity files during session
      invalidateIdentityCache();

      const messages = await splitAndSend(msg.chatId, response.result);
      log.debug(
        { chatId: msg.chatId, chunks: messages },
        "Sent response chunks",
      );

      // Notify user of non-fatal media errors
      if (mediaErrors.length > 0) {
        await bot.api.sendMessage(
          msg.chatId,
          `Note: Some media could not be processed: ${mediaErrors.join(". ")}`,
        );
      }
    }

    const duration = Date.now() - startTime;
    log.info(
      {
        chatId: msg.chatId,
        queueId: msg.id,
        duration,
        cost: response.cost_usd,
      },
      "Message processed",
    );

    // Auto-commit any file changes Claude made
    const committed = await autoCommitChanges();
    if (committed) {
      log.info({ queueId: msg.id }, "Auto-committed Claude file changes");
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
      "Message failed",
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
    let splitPoint = remaining.lastIndexOf(". ", MAX_LENGTH);
    if (splitPoint === -1 || splitPoint < MAX_LENGTH * 0.5) {
      // Try word boundary
      splitPoint = remaining.lastIndexOf(" ", MAX_LENGTH);
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

  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "timeout";
  }
  if (msg.includes("spawn") || msg.includes("failed to start")) {
    return "spawn";
  }
  if (msg.includes("parse") || msg.includes("json")) {
    return "parse";
  }
  if (msg.includes("exit")) {
    return "process";
  }

  return "unknown";
}

/**
 * Get brief error description (no stack traces)
 */
function getBriefDescription(error: Error): string {
  const msg = error.message;

  // Truncate long messages
  if (msg.length > 200) {
    return msg.slice(0, 200) + "...";
  }

  return msg;
}
