import { bot, type MyContext } from './bot.js';
import { createChildLogger, sendLongMessage } from '../utils/index.js';

const log = createChildLogger('handlers');

/**
 * Set up message handlers for the bot
 * Processes incoming messages and routes them appropriately
 */
export function setupHandlers(): void {
  // Handle text messages
  bot.on('message:text', async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const username = ctx.from?.username ?? 'unknown';
    const text = ctx.message?.text ?? '';
    const preview = text.length > 50 ? text.slice(0, 50) + '...' : text;

    log.info({ chatId, username, textPreview: preview }, 'Received text message');

    // Placeholder response - Claude integration comes in Plan 04
    const response = `Received: ${preview}`;
    await sendLongMessage(ctx, response);
  });

  // Catch-all for non-text messages
  bot.on('message', async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const messageType = Object.keys(ctx.message ?? {}).find(
      (key) => !['message_id', 'from', 'chat', 'date'].includes(key)
    );

    log.info({ chatId, messageType }, 'Received non-text message');

    await ctx.reply('I only understand text messages for now.');
  });

  log.info('Message handlers registered');
}
