import { existsSync } from "fs";
import { getHomePath } from "../memory/home.js";

/**
 * Required identity files for bootstrap completion
 * NOTE: REMINDERS.md is optional, not part of core identity
 */
const REQUIRED_FILES = ["SOUL.md", "IDENTITY.md", "USER.md"] as const;

/**
 * Check if bootstrap is needed (any identity file missing)
 *
 * @returns true if ANY required file missing, false if ALL exist
 */
export function needsBootstrap(): boolean {
  for (const file of REQUIRED_FILES) {
    const path = getHomePath("identity", file);
    if (!existsSync(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Get current bootstrap state
 *
 * @returns 'needed' if any identity file missing, 'complete' if all exist
 */
export function getBootstrapState(): "needed" | "complete" {
  return needsBootstrap() ? "needed" : "complete";
}
