import { z } from "zod";

/**
 * Environment variable schema for klausbot (secrets only)
 * Validates environment variables at startup
 */
export const envSchema = z
  .object({
    /** Telegram Bot Token from @BotFather (required) */
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),

    /** OpenAI API key for embeddings/fallback (optional) */
    OPENAI_API_KEY: z.string().optional(),

    /** Log level for pino logger */
    LOG_LEVEL: z
      .enum(["silent", "trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),

    /** Container mode flag (set by Dockerfile) */
    KLAUSBOT_CONTAINER: z.enum(["1"]).optional(),

    /** Claude Code OAuth token (required in container mode) */
    CLAUDE_CODE_OAUTH_TOKEN: z.string().optional(),
  })
  .refine(
    (data) => {
      // If in container mode, OAuth token is required
      if (data.KLAUSBOT_CONTAINER === "1") {
        return Boolean(data.CLAUDE_CODE_OAUTH_TOKEN);
      }
      return true;
    },
    {
      message:
        "CLAUDE_CODE_OAUTH_TOKEN is required in container mode (run `claude setup-token` to generate)",
      path: ["CLAUDE_CODE_OAUTH_TOKEN"],
    },
  );

/** Inferred environment config type */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * JSON config schema for klausbot (non-secrets)
 * Loaded from ~/.klausbot/config/klausbot.json
 * Uses strict mode - unknown keys cause validation failure
 *
 * Includes: model, streaming, heartbeat settings
 */
export const jsonConfigSchema = z
  .object({
    /** AI model to use for responses (opus, sonnet, haiku) */
    model: z.string().default("claude-opus-4-6"),
    /** Streaming configuration for real-time responses */
    streaming: z
      .object({
        /** Enable streaming mode (default: true) */
        enabled: z.boolean().default(true),
        /** Minimum interval between draft updates in ms (100-2000, default: 500) */
        throttleMs: z.number().min(100).max(2000).default(500),
      })
      .default({ enabled: true, throttleMs: 500 }),
    /** Heartbeat configuration for periodic awareness checks */
    heartbeat: z
      .object({
        /** Enable heartbeat checks (default: true) */
        enabled: z.boolean().default(true),
        /** Interval between checks in ms (min 60000, default 1800000 = 30 min) */
        intervalMs: z.number().min(60000).default(1800000),
      })
      .default({ enabled: true, intervalMs: 1800000 }),
    /** Background agent orchestration configuration */
    subagents: z
      .object({
        /** Enable background agent spawning (default: true) */
        enabled: z.boolean().default(true),
      })
      .default({ enabled: true }),
  })
  .strict(); // Fail on unknown keys

/** Inferred JSON config type */
export type JsonConfig = z.infer<typeof jsonConfigSchema>;

// Backward compatibility - existing code uses configSchema
export const configSchema = envSchema;
export type Config = EnvConfig;
