import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Logger } from "pino";

/** Base directory for all klausbot data */
export const KLAUSBOT_HOME = join(homedir(), ".klausbot");

/** Subdirectories to create under KLAUSBOT_HOME */
export const DIRS = ["config", "identity", "cron", "images", "logs"] as const;

/**
 * Initialize the klausbot home directory structure
 * Creates ~/.klausbot/ and all subdirectories if missing
 *
 * @param logger - Pino logger for initialization messages
 */
export function initializeHome(logger: Logger): void {
  // Create base directory
  if (!existsSync(KLAUSBOT_HOME)) {
    mkdirSync(KLAUSBOT_HOME, { recursive: true });
    logger.info({ path: KLAUSBOT_HOME }, "Created klausbot home directory");
  }

  // Create subdirectories
  for (const dir of DIRS) {
    const path = join(KLAUSBOT_HOME, dir);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      logger.info({ path }, "Created directory");
    }
  }
}

/**
 * Get a path within the klausbot home directory
 *
 * @param segments - Path segments to join with KLAUSBOT_HOME
 * @returns Full path to the requested location
 */
export function getHomePath(...segments: string[]): string {
  return join(KLAUSBOT_HOME, ...segments);
}
