import { Bot, Context, GrammyError, HttpError } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import { autoRetry } from "@grammyjs/auto-retry";
import {
  autoChatAction,
  AutoChatActionFlavor,
} from "@grammyjs/auto-chat-action";
import { hydrateFiles } from "@grammyjs/files";
import { config } from "../config/index.js";
import { logger, createChildLogger } from "../utils/index.js";

const log = createChildLogger("telegram");

/** Context type with auto-chat-action flavor */
export type MyContext = Context & AutoChatActionFlavor;

/** Bot instance with plugins configured */
export const bot = new Bot<MyContext>(config.TELEGRAM_BOT_TOKEN);

// Configure auto-retry on rate limits and server errors
bot.api.config.use(
  autoRetry({
    maxRetryAttempts: 3,
    maxDelaySeconds: 300,
  }),
);

// Enable file download helper methods
bot.api.config.use(hydrateFiles(config.TELEGRAM_BOT_TOKEN));

// Middleware: typing indicator during processing
bot.use(autoChatAction());

// Middleware: preserve message order per chat
bot.use(sequentialize((ctx) => ctx.chat?.id.toString()));

// Error handler
bot.catch((err) => {
  const ctx = err.ctx;
  const e = err.error;

  if (e instanceof GrammyError) {
    log.error(
      {
        error_code: e.error_code,
        description: e.description,
        updateId: ctx.update.update_id,
      },
      "Telegram API error",
    );
  } else if (e instanceof HttpError) {
    log.error(
      { error: e.message, updateId: ctx.update.update_id },
      "Network error",
    );
  } else {
    log.error({ error: e, updateId: ctx.update.update_id }, "Unknown error");
  }

  // Send user-friendly error message (non-blocking)
  try {
    ctx
      .reply(
        "An error occurred while processing your message. Please try again.",
      )
      .catch(() => {
        // Ignore reply errors
      });
  } catch {
    // Ignore synchronous errors
  }
});

/**
 * Create a runner for the bot with graceful shutdown handlers
 * @returns Runner handle with stop() method
 */
export function createRunner() {
  const handle = run(bot);

  const shutdown = async () => {
    log.info("Shutting down bot...");
    await handle.stop();
    log.info("Bot stopped");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log.info("Bot runner started");
  return handle;
}
