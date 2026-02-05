/**
 * Heartbeat executor - Claude invocation and response handling
 * Sends non-OK responses to all approved users
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { queryClaudeCode } from "../daemon/spawner.js";
import { getPairingStore } from "../pairing/index.js";
import { getHomePath } from "../memory/index.js";
import { createChildLogger, markdownToTelegramHtml } from "../utils/index.js";

const log = createChildLogger("heartbeat-executor");

/** Exact response string that suppresses notification */
const HEARTBEAT_OK = "HEARTBEAT_OK";

/** Timeout for heartbeat check (5 minutes, per CONTEXT.md) */
const HEARTBEAT_TIMEOUT = 300000;

/** Template for auto-created HEARTBEAT.md */
const HEARTBEAT_TEMPLATE = `# Heartbeat Reminders

Things to check and remember during periodic heartbeat checks.

## Format

Add items with optional expiry dates:
- [ ] Check something [expires: 2026-02-15]
- [ ] Recurring reminder (no expiry = permanent)

## Active Items

(No items yet)
`;

/** Result of heartbeat execution */
export interface HeartbeatResult {
  ok: boolean;
  suppressed: boolean;
  response?: string;
  error?: string;
}

/**
 * Get path to HEARTBEAT.md file
 */
export function getHeartbeatPath(): string {
  return getHomePath("HEARTBEAT.md");
}

/**
 * Ensure HEARTBEAT.md exists, create with template if missing
 */
function ensureHeartbeatFile(): void {
  const heartbeatPath = getHeartbeatPath();
  if (!existsSync(heartbeatPath)) {
    writeFileSync(heartbeatPath, HEARTBEAT_TEMPLATE);
    log.info({ path: heartbeatPath }, "Created HEARTBEAT.md template");
  }
}

/**
 * Build heartbeat prompt for Claude
 */
function buildHeartbeatPrompt(heartbeatContent: string): string {
  const now = new Date().toISOString();
  return `<heartbeat-check>
Current time: ${now}

Review your HEARTBEAT.md reminders below and take appropriate action:

<heartbeat-file>
${heartbeatContent}
</heartbeat-file>

Instructions:
1. Read each item and decide if action is needed
2. For expired items: remove them from the file
3. For actionable items: execute using tools (check email, call APIs, etc.)
4. If nothing requires attention: respond with exactly "HEARTBEAT_OK"
5. If anything needs user attention: respond with a combined summary

You have full tool access. Take actions, don't just report.
</heartbeat-check>`;
}

/**
 * Execute heartbeat check
 * - Reads HEARTBEAT.md (auto-creates if missing)
 * - Invokes Claude with heartbeat prompt
 * - Suppresses HEARTBEAT_OK response
 * - Sends non-OK responses to all approved users
 */
export async function executeHeartbeat(): Promise<HeartbeatResult> {
  log.info("Starting heartbeat check");

  // Ensure HEARTBEAT.md exists
  ensureHeartbeatFile();

  // Read heartbeat file
  const heartbeatPath = getHeartbeatPath();
  const heartbeatContent = readFileSync(heartbeatPath, "utf-8");

  // Build prompt
  const prompt = buildHeartbeatPrompt(heartbeatContent);

  try {
    // Invoke Claude with timeout
    const response = await queryClaudeCode(prompt, {
      timeout: HEARTBEAT_TIMEOUT,
    });

    const result = response.result.trim();

    // Check for HEARTBEAT_OK (exact match after trim)
    if (result === HEARTBEAT_OK) {
      log.info("Heartbeat OK - nothing to report");
      return { ok: true, suppressed: true };
    }

    // Non-OK response - send to all approved users
    log.info({ responseLength: result.length }, "Heartbeat has items to report");

    // Get bot instance dynamically (avoid circular import)
    const { bot } = await import("../telegram/index.js");

    // Get all approved users
    const store = getPairingStore();
    const approved = store.listApproved();

    if (approved.length === 0) {
      log.warn("No approved users to send heartbeat to");
      return { ok: true, suppressed: false, response: result };
    }

    // Format message with [Heartbeat] prefix
    const message = `[Heartbeat]\n${markdownToTelegramHtml(result)}`;

    // Send to each approved user
    for (const user of approved) {
      try {
        await bot.api.sendMessage(user.chatId, message, { parse_mode: "HTML" });
        log.debug({ chatId: user.chatId }, "Sent heartbeat to user");
      } catch (err) {
        log.error({ err, chatId: user.chatId }, "Failed to send heartbeat to user");
      }
    }

    return { ok: true, suppressed: false, response: result };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Heartbeat execution failed");

    // Notify users of failure (per CONTEXT.md)
    try {
      const { bot } = await import("../telegram/index.js");
      const store = getPairingStore();
      const approved = store.listApproved();

      for (const user of approved) {
        try {
          await bot.api.sendMessage(
            user.chatId,
            `Heartbeat check failed: ${errorMsg}`
          );
        } catch {
          // Ignore send errors
        }
      }
    } catch {
      // Ignore import/send errors
    }

    return { ok: false, suppressed: false, error: errorMsg };
  }
}
