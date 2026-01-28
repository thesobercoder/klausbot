import pino, { Logger } from 'pino';
import { config } from '../config/index.js';

/** Base logger instance (lazy-initialized) */
let _logger: Logger | null = null;

/**
 * Get or create the base logger instance
 * Lazy initialization ensures config is loaded before logger is created
 */
function getLogger(): Logger {
  if (_logger === null) {
    _logger = pino({
      level: config.LOG_LEVEL,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }
  return _logger;
}

/** Main logger instance - use this for general logging */
export const logger: Logger = new Proxy({} as Logger, {
  get(_target, prop) {
    const log = getLogger();
    const value = log[prop as keyof Logger];
    if (typeof value === 'function') {
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
