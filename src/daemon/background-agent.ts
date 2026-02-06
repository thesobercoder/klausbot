/**
 * Background Agent Spawner
 *
 * Spawns `claude --resume <sessionId> -p "continue..."` as a detached background
 * process. Writes task files so the existing task-watcher sends Telegram
 * notifications on completion.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { writeFileSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { KLAUSBOT_HOME } from "../memory/home.js";
import { createChildLogger } from "../utils/logger.js";
import { writeMcpConfigFile, getHooksConfig } from "./spawner.js";

const log = createChildLogger("background-agent");

const TASKS_DIR = path.join(KLAUSBOT_HOME, "tasks");
const ACTIVE_DIR = path.join(TASKS_DIR, "active");
const COMPLETED_DIR = path.join(TASKS_DIR, "completed");

/** Default timeout for background agents: none (run indefinitely) */
const DEFAULT_TIMEOUT = 0;

const RESUME_PROMPT = `You are now continuing as a background agent. The user already received your immediate response.

Continue with the background work you described when you called start_background_task. Work autonomously — read files, write code, search the web, use any tools needed.

For complex tasks that benefit from parallel investigation (research from multiple angles, competing hypotheses, multi-part analysis), consider using an agent team — spawn teammates to work different aspects simultaneously, then synthesize their findings.

When finished, output a concise summary of what you accomplished and any results. This summary will be delivered to the user as a follow-up message.`;

export interface BackgroundAgentOptions {
  /** Session ID from the dispatcher's just-completed session */
  sessionId: string;
  /** Telegram chat ID for notification routing */
  chatId: number;
  /** Unique task ID */
  taskId: string;
  /** Human-readable task description */
  description: string;
  /** Timeout in ms (default: 300000 = 5 min) */
  timeout?: number;
  /** Model override */
  model?: string;
}

/**
 * Spawn a background agent using `claude --resume`.
 *
 * 1. Writes active task file
 * 2. Spawns `claude --resume <sessionId> -p "continue..."` as detached process
 * 3. On completion, writes completed task file (task-watcher sends notification)
 */
export function spawnBackgroundAgent(options: BackgroundAgentOptions): void {
  const {
    sessionId,
    chatId,
    taskId,
    description,
    timeout = DEFAULT_TIMEOUT,
    model,
  } = options;

  // Ensure task directories exist
  mkdirSync(ACTIVE_DIR, { recursive: true });
  mkdirSync(COMPLETED_DIR, { recursive: true });

  // Write active task file
  const activeTaskPath = path.join(ACTIVE_DIR, `${taskId}.json`);
  const taskData = {
    id: taskId,
    chatId: String(chatId),
    description,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(activeTaskPath, JSON.stringify(taskData, null, 2));
  log.info(
    { taskId, sessionId, chatId, description },
    "Background agent starting",
  );

  // Build MCP config + hooks
  const mcpConfigPath = writeMcpConfigFile();
  const settingsJson = JSON.stringify(getHooksConfig());

  // Build args
  const args = [
    "--resume",
    sessionId,
    "--dangerously-skip-permissions",
    "-p",
    RESUME_PROMPT,
    "--output-format",
    "stream-json",
    "--verbose",
    "--mcp-config",
    mcpConfigPath,
    "--settings",
    settingsJson,
    "--disallowedTools",
    "Task,TaskOutput",
  ];
  if (model) {
    args.push("--model", model);
  }

  // Build environment
  const env = {
    ...process.env,
    KLAUSBOT_CHAT_ID: String(chatId),
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
  };

  const claude = spawn("claude", args, {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: KLAUSBOT_HOME,
    env,
  });

  let accumulated = "";
  let timedOut = false;

  // Timeout (0 = no timeout, run indefinitely)
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (timeout > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      claude.kill("SIGTERM");
      setTimeout(() => {
        if (!claude.killed) claude.kill("SIGKILL");
      }, 5000);
    }, timeout);
  }

  // Parse NDJSON stream
  const rl = createInterface({ input: claude.stdout! });
  rl.on("line", (line) => {
    try {
      const event = JSON.parse(line);
      if (event.type === "content_block_delta" && event.delta?.text) {
        accumulated += event.delta.text;
      }
      if (event.type === "result" && event.result !== undefined) {
        accumulated = event.result;
      }
    } catch {
      // skip non-JSON
    }
  });

  // Collect stderr for debugging
  let stderr = "";
  claude.stderr!.on("data", (data: Buffer) => {
    stderr += data.toString();
  });

  // On close → write completed task file
  claude.on("close", (code) => {
    if (timeoutId) clearTimeout(timeoutId);

    const completedData = {
      id: taskId,
      chatId: String(chatId),
      description,
      startedAt: taskData.startedAt,
      completedAt: new Date().toISOString(),
      status: timedOut ? "failed" : code === 0 ? "success" : "failed",
      summary:
        accumulated || (timedOut ? "Timed out" : `Exited with code ${code}`),
      error: timedOut
        ? `Timed out after ${Math.round(timeout / 1000)}s`
        : code !== 0
          ? stderr.slice(0, 500)
          : undefined,
    };

    // Write completed task file → task-watcher picks it up
    const completedPath = path.join(COMPLETED_DIR, `${taskId}.json`);
    writeFileSync(completedPath, JSON.stringify(completedData, null, 2));

    // Remove active task file
    try {
      unlinkSync(activeTaskPath);
    } catch {
      // Already removed or doesn't exist
    }

    log.info(
      {
        taskId,
        status: completedData.status,
        resultLength: accumulated.length,
        code,
        timedOut,
      },
      "Background agent finished",
    );
  });

  claude.on("error", (err) => {
    if (timeoutId) clearTimeout(timeoutId);
    log.error({ taskId, err }, "Background agent spawn error");

    // Write failed task
    const completedData = {
      id: taskId,
      chatId: String(chatId),
      description,
      startedAt: taskData.startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      summary: `Spawn error: ${err.message}`,
      error: err.message,
    };
    const completedPath = path.join(COMPLETED_DIR, `${taskId}.json`);
    writeFileSync(completedPath, JSON.stringify(completedData, null, 2));

    try {
      unlinkSync(activeTaskPath);
    } catch {
      // Already removed
    }
  });
}
