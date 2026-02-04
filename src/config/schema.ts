import { z } from 'zod';

/**
 * Environment variable schema for klausbot (secrets only)
 * Validates environment variables at startup
 */
export const envSchema = z.object({
  /** Telegram Bot Token from @BotFather (required) */
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),

  /** OpenAI API key for embeddings/fallback (optional) */
  OPENAI_API_KEY: z.string().optional(),

  /** Log level for pino logger */
  LOG_LEVEL: z
    .enum(['silent', 'trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
});

/** Inferred environment config type */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * JSON config schema for klausbot (non-secrets)
 * Loaded from ~/.klausbot/config/klausbot.json
 * Uses strict mode - unknown keys cause validation failure
 */
export const jsonConfigSchema = z.object({
  /** AI model to use for responses (opus, sonnet, haiku) */
  model: z.string().optional(),
}).strict(); // Fail on unknown keys

/** Inferred JSON config type */
export type JsonConfig = z.infer<typeof jsonConfigSchema>;

// Backward compatibility - existing code uses configSchema
export const configSchema = envSchema;
export type Config = EnvConfig;
