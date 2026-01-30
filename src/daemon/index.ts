import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config/index.js';

// Re-export queue types and class
export { MessageQueue } from './queue.js';
export type { QueuedMessage, QueueStats, MessageStatus } from './queue.js';

// Re-export spawner types and function
export { queryClaudeCode } from './spawner.js';
export type { ClaudeResponse, SpawnerOptions } from './spawner.js';

// Re-export gateway functions
export { startGateway, stopGateway } from './gateway.js';

/**
 * Ensure a data directory exists
 * Creates .gitkeep file if directory is empty (for git tracking of structure)
 *
 * @param path - Directory path to ensure exists
 */
export function ensureDataDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });

    // Create .gitkeep for git tracking of empty directory
    const gitkeepPath = join(path, '.gitkeep');
    writeFileSync(gitkeepPath, '');
  }
}

/**
 * Get full path within data directory
 * Uses config.DATA_DIR as the base
 *
 * @param subpath - Path relative to data directory
 * @returns Full path
 */
export function getDataPath(subpath: string): string {
  return join(config.DATA_DIR, subpath);
}
