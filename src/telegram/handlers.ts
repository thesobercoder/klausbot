import { bot, type MyContext } from "./bot.js";
import type { MessageQueue } from "../daemon/queue.js";
import { createChildLogger } from "../utils/index.js";

const log = createChildLogger("handlers");

/**
 * Set up message handlers for the bot
 * Wires messages to the queue for processing
 *
 * Note: When using gateway, handlers are set up there directly.
 * This function is for standalone bot usage or testing.
 *
 * @param queue - Message queue to add messages to
 * @param onMessage - Callback to trigger after message queued (e.g., process queue)
 */
export function setupHandlers(
  queue: MessageQueue,
  onMessage?: () => void,
): void {
  // Handle text messages
  bot.on("message:text", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const username = ctx.from?.username ?? "unknown";
    const text = ctx.message?.text ?? "";

    // Skip empty messages
    if (!text.trim()) return;

    const preview = text.length > 50 ? text.slice(0, 50) + "..." : text;
    log.info(
      { chatId, username, textPreview: preview },
      "Received text message",
    );

    // Add to queue
    const msgId = queue.add(chatId, text);
    log.debug({ chatId, queueId: msgId }, "Message added to queue");

    // Send status message
    await ctx.reply("Queued. Processing...");

    // Trigger processing callback
    if (onMessage) {
      onMessage();
    }
  });

  // Catch-all for non-text messages
  bot.on("message", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const messageType = Object.keys(ctx.message ?? {}).find(
      (key) => !["message_id", "from", "chat", "date"].includes(key),
    );

    log.info({ chatId, messageType }, "Received non-text message");

    await ctx.reply("I only understand text messages for now.");
  });

  log.info("Message handlers registered");
}
