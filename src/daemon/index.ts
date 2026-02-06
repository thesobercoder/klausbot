import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { KLAUSBOT_HOME } from "../memory/home.js";

// Re-export queue types and class
export { MessageQueue } from "./queue.js";
export type { QueuedMessage, QueueStats, MessageStatus } from "./queue.js";

// Re-export spawner types and function
export {
  queryClaudeCode,
  getMcpConfig,
  getHooksConfig,
  writeMcpConfigFile,
} from "./spawner.js";
export type {
  ClaudeResponse,
  SpawnerOptions,
  ToolUseEntry,
} from "./spawner.js";

// Re-export transcript recovery for external use
export { handleTimeout } from "./transcript.js";

// Re-export gateway functions
export { startGateway, stopGateway, getLastActiveChatId } from "./gateway.js";

// Re-export background agent
export { spawnBackgroundAgent } from "./background-agent.js";
export type { BackgroundAgentOptions } from "./background-agent.js";

// Re-export media types for consumers
export type { MediaAttachment } from "../media/index.js";

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
    const gitkeepPath = join(path, ".gitkeep");
    writeFileSync(gitkeepPath, "");
  }
}

/**
 * Get full path within klausbot home directory
 *
 * @param subpath - Path relative to ~/.klausbot/
 * @returns Full path
 */
export function getDataPath(subpath: string): string {
  return join(KLAUSBOT_HOME, subpath);
}
