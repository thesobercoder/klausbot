import { z } from 'zod';

/**
 * Configuration schema for klausbot
 * Validates environment variables at startup
 */
export const configSchema = z.object({
  /** Telegram Bot Token from @BotFather (required) */
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),

  /** Log level for pino logger */
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  /** Directory for persistent data (queue, pairing, etc.) */
  DATA_DIR: z.string().default('./data'),
});

/** Inferred configuration type */
export type Config = z.infer<typeof configSchema>;
