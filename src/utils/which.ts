/**
 * Find executable in PATH using Node APIs
 */

import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Find the absolute path to a command in PATH
 * @param cmd - Command name to find
 * @returns Absolute path to command, or null if not found
 */
export function which(cmd: string): string | null {
  const pathEnv = process.env.PATH || '';
  const separator = process.platform === 'win32' ? ';' : ':';
  const pathDirs = pathEnv.split(separator);

  for (const dir of pathDirs) {
    const fullPath = join(dir, cmd);
    if (existsSync(fullPath)) return fullPath;
    if (process.platform === 'win32' && existsSync(fullPath + '.exe')) {
      return fullPath + '.exe';
    }
  }
  return null;
}
