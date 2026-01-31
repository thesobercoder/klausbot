/**
 * JSON config loader with hot reload support
 *
 * Loads non-secret configuration from ~/.klausbot/config/klausbot.json
 * Uses mtime checking for efficient hot reload (cheap to call frequently)
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { jsonConfigSchema, type JsonConfig } from './schema.js';

/** Path to JSON config file */
export const JSON_CONFIG_PATH = join(homedir(), '.klausbot', 'config', 'klausbot.json');

/** Cached config instance */
let configCache: JsonConfig | null = null;

/** Last known mtime of config file (ms since epoch) */
let configMtime: number = 0;

/**
 * Load JSON config with mtime-based caching
 *
 * - If file doesn't exist: returns defaults
 * - If file exists and cache valid (same mtime): returns cache
 * - If file exists and cache stale: reloads, validates, caches
 *
 * @throws Error on JSON parse failure or validation failure
 */
export function loadJsonConfig(): JsonConfig {
  // File doesn't exist - return defaults
  if (!existsSync(JSON_CONFIG_PATH)) {
    if (configCache === null) {
      configCache = jsonConfigSchema.parse({});
    }
    return configCache;
  }

  // Check mtime
  const stat = statSync(JSON_CONFIG_PATH);
  const currentMtime = stat.mtimeMs;

  // Cache is valid - return cached
  if (configCache !== null && currentMtime === configMtime) {
    return configCache;
  }

  // Need to reload
  let raw: string;
  try {
    raw = readFileSync(JSON_CONFIG_PATH, 'utf8');
  } catch (err) {
    throw new Error(
      `Failed to read config file at ${JSON_CONFIG_PATH}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Invalid JSON in config file at ${JSON_CONFIG_PATH}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Validate with schema (strict mode rejects unknown keys)
  const result = jsonConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.join('.') || '(root)';
      return `  - ${path}: ${issue.message}`;
    });
    throw new Error(
      `Config validation failed for ${JSON_CONFIG_PATH}:\n${issues.join('\n')}`
    );
  }

  // Update cache
  configCache = result.data;
  configMtime = currentMtime;

  return configCache;
}

/**
 * Get current JSON config (hot reload aware)
 *
 * Safe to call frequently - mtime check makes it cheap.
 * Use this in application code for hot reload support.
 */
export function getJsonConfig(): JsonConfig {
  return loadJsonConfig();
}
