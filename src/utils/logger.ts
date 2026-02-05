import pino, { Logger, destination, multistream } from "pino";
import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import pinoPretty from "pino-pretty";
import { config } from "../config/index.js";

/** Base logger instance (lazy-initialized) */
let _logger: Logger | null = null;

/** MCP logger instance (separate to avoid stdout conflicts) */
let _mcpLogger: Logger | null = null;

/** Logs directory under ~/.klausbot/logs */
const LOGS_DIR = join(homedir(), ".klausbot", "logs");

/** Ensure logs directory exists */
function ensureLogsDir(): string {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
  } catch {
    // ignore
  }
  return LOGS_DIR;
}

/**
 * Get or create the base logger instance
 * Lazy initialization ensures config is loaded before logger is created
 * Uses pino-pretty for human-readable output in TTY, JSON in production
 * Also writes to logs/app.log file
 */
function getLogger(): Logger {
  if (_logger === null) {
    const isTTY = process.stdout.isTTY;
    const logsDir = ensureLogsDir();
    const logFile = join(logsDir, "app.log");

    // File stream for JSON logs
    const fileStream = destination(logFile);

    if (isTTY) {
      // TTY: pretty console + JSON file
      const prettyStream = pinoPretty({
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "HH:MM:ss",
      });

      _logger = pino(
        {
          level: config.LOG_LEVEL,
          formatters: {
            level(label) {
              return { level: label };
            },
          },
          timestamp: pino.stdTimeFunctions.isoTime,
        },
        multistream([
          { stream: prettyStream, level: config.LOG_LEVEL as pino.Level },
          { stream: fileStream, level: config.LOG_LEVEL as pino.Level },
        ]),
      );
    } else {
      // Non-TTY: JSON to stdout + file
      _logger = pino(
        {
          level: config.LOG_LEVEL,
          formatters: {
            level(label) {
              return { level: label };
            },
          },
          timestamp: pino.stdTimeFunctions.isoTime,
        },
        multistream([
          { stream: process.stdout, level: config.LOG_LEVEL as pino.Level },
          { stream: fileStream, level: config.LOG_LEVEL as pino.Level },
        ]),
      );
    }
  }
  return _logger;
}

/** Main logger instance - use this for general logging */
export const logger: Logger = new Proxy({} as Logger, {
  get(_target, prop) {
    const log = getLogger();
    const value = log[prop as keyof Logger];
    if (typeof value === "function") {
      return value.bind(log);
    }
    return value;
  },
});

/**
 * Create a child logger with a specific module name
 * @param name - Module or component name for context
 */
export function createChildLogger(name: string): Logger {
  return getLogger().child({ module: name });
}

/**
 * Create a logger for MCP server context
 * Uses stderr instead of stdout (stdout is reserved for MCP JSON-RPC protocol)
 * @param name - Module or component name for context
 */
export function createMcpLogger(name: string): Logger {
  if (_mcpLogger === null) {
    const logsDir = ensureLogsDir();
    const logFile = join(logsDir, "mcp.log");
    const fileStream = destination(logFile);

    // MCP server: stderr for console (stdout is protocol), file for persistence
    const prettyStream = pinoPretty({
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "HH:MM:ss",
      destination: 2, // stderr
    });

    _mcpLogger = pino(
      {
        level: config.LOG_LEVEL,
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      multistream([
        { stream: prettyStream, level: config.LOG_LEVEL as pino.Level },
        { stream: fileStream, level: config.LOG_LEVEL as pino.Level },
      ]),
    );
  }
  return _mcpLogger.child({ module: name });
}
