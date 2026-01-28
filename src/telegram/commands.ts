import { bot, type MyContext } from './bot.js';
import { createChildLogger } from '../utils/index.js';

const log = createChildLogger('commands');

/**
 * Set up Telegram command handlers
 * Commands are registered with BotFather and handled here
 */
export function setupCommands(): void {
  // /start - pairing flow (placeholder)
  bot.command('start', async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const username = ctx.from?.username ?? 'unknown';

    log.info({ chatId, username }, '/start command invoked');

    await ctx.reply(`Pairing flow coming soon. Chat ID: ${chatId}`);
  });

  // /model - model switching (placeholder)
  bot.command('model', async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const username = ctx.from?.username ?? 'unknown';

    log.info({ chatId, username }, '/model command invoked');

    await ctx.reply('Model switching coming in Phase 2');
  });

  log.info('Commands registered: /start, /model');
}
