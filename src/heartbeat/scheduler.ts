/**
 * Heartbeat scheduler - periodic awareness checks
 * Waits for first interval (no immediate tick per CONTEXT.md)
 */

import { getJsonConfig } from "../config/index.js";
import { executeHeartbeat } from "./executor.js";
import { createChildLogger } from "../utils/index.js";

const log = createChildLogger("heartbeat");

let heartbeatInterval: NodeJS.Timeout | null = null;
let isExecuting = false;

/**
 * Start the heartbeat scheduler
 * Checks config.heartbeat.enabled before starting
 * Does NOT run immediately - waits for first interval
 */
export function startHeartbeat(): void {
  if (heartbeatInterval) {
    log.warn("Heartbeat already running");
    return;
  }

  const config = getJsonConfig();
  if (!config.heartbeat?.enabled) {
    log.info("Heartbeat disabled in config");
    return;
  }

  const intervalMs = config.heartbeat.intervalMs ?? 1800000;

  // NO immediate tick() - wait for first interval per CONTEXT.md
  heartbeatInterval = setInterval(tick, intervalMs);
  log.info({ intervalMs }, "Heartbeat scheduler started");
}

/**
 * Stop the heartbeat scheduler
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    log.info("Heartbeat scheduler stopped");
  }
}

/**
 * Scheduler tick - execute heartbeat check
 * Prevents concurrent execution
 * Re-checks config for hot reload support
 */
async function tick(): Promise<void> {
  // Prevent concurrent execution
  if (isExecuting) {
    log.debug("Heartbeat already executing, skipping");
    return;
  }

  // Re-check config (hot reload support)
  const config = getJsonConfig();
  if (!config.heartbeat?.enabled) {
    log.info("Heartbeat disabled via hot reload, stopping");
    stopHeartbeat();
    return;
  }

  isExecuting = true;
  try {
    await executeHeartbeat();
  } catch (err) {
    log.error({ err }, "Heartbeat tick error");
  } finally {
    isExecuting = false;
  }
}
