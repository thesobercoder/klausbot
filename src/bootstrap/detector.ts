import { existsSync } from "fs";
import { getHomePath } from "../memory/home.js";

/** Path to bootstrap file */
const BOOTSTRAP_PATH = () => getHomePath("identity", "BOOTSTRAP.md");

/**
 * Check if bootstrap is needed (BOOTSTRAP.md exists in identity folder)
 *
 * @returns true if BOOTSTRAP.md exists, false otherwise
 */
export function needsBootstrap(): boolean {
  return existsSync(BOOTSTRAP_PATH());
}

/**
 * Get current bootstrap state
 *
 * @returns 'needed' if BOOTSTRAP.md exists, 'complete' otherwise
 */
export function getBootstrapState(): "needed" | "complete" {
  return needsBootstrap() ? "needed" : "complete";
}
