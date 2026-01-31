import { configSchema, type Config } from './schema.js';
import { ZodError } from 'zod';

/**
 * Load and validate configuration from environment variables
 * @throws Error with descriptive message if validation fails
 */
export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    });

    throw new Error(
      `Configuration validation failed:\n${issues.join('\n')}\n\n` +
        `Ensure required environment variables are set in ~/.klausbot/.env or environment.`
    );
  }

  return result.data;
}

/** Singleton config instance (lazy-loaded on first access) */
let _config: Config | null = null;

export const config: Config = new Proxy({} as Config, {
  get(_target, prop: keyof Config) {
    if (_config === null) {
      _config = loadConfig();
    }
    return _config[prop];
  },
});
