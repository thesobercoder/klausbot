/**
 * Cron store - JSON persistence with atomic writes
 * Jobs persist to ~/.klausbot/cron/jobs.json
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from "fs";
import { dirname } from "path";
import { randomUUID } from "crypto";
import { getHomePath } from "../memory/index.js";
import type { CronStoreFile } from "./types.js";

/** Path to cron jobs JSON file */
export const STORE_PATH = getHomePath("cron", "jobs.json");

/**
 * Load cron store from disk
 * Returns empty store if file doesn't exist
 */
export function loadCronStore(): CronStoreFile {
  if (!existsSync(STORE_PATH)) {
    return { version: 1, jobs: [] };
  }

  try {
    const data = readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(data) as CronStoreFile;
  } catch {
    // Corrupted file - return empty store
    return { version: 1, jobs: [] };
  }
}

/**
 * Save cron store to disk
 * Uses atomic write (temp file + rename) to prevent corruption
 */
export function saveCronStore(store: CronStoreFile): void {
  // Ensure directory exists
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Atomic write: write to temp file, then rename
  const tmpSuffix = randomUUID().slice(0, 8);
  const tmpPath = `${STORE_PATH}.${process.pid}.${tmpSuffix}.tmp`;

  writeFileSync(tmpPath, JSON.stringify(store, null, 2));
  renameSync(tmpPath, STORE_PATH);
}
