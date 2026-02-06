/**
 * Task Watcher for background task completion notifications
 *
 * Polls ~/.klausbot/tasks/completed/ for finished background tasks
 * and sends Telegram notifications to the user.
 */

import fs from "fs";
import path from "path";

import { KLAUSBOT_HOME } from "../memory/home.js";
import {
  createChildLogger,
  markdownToTelegramHtml,
  escapeHtml,
  splitTelegramMessage,
} from "../utils/index.js";

const logger = createChildLogger("task-watcher");

const TASKS_DIR = path.join(KLAUSBOT_HOME, "tasks");
const ACTIVE_DIR = path.join(TASKS_DIR, "active");
const COMPLETED_DIR = path.join(TASKS_DIR, "completed");
const NOTIFIED_DIR = path.join(TASKS_DIR, "notified");

/** Default poll interval: 30 seconds */
const DEFAULT_POLL_INTERVAL = 30_000;

export interface BackgroundTask {
  id: string;
  chatId: string;
  description: string;
  startedAt: string;
  completedAt?: string;
  status?: "success" | "failed";
  summary?: string;
  artifacts?: string[];
  error?: string;
}

export interface TaskWatcherOptions {
  /** Poll interval in milliseconds (default: 30000) */
  pollInterval?: number;
  /** Function to send Telegram message */
  sendMessage: (chatId: string, text: string) => Promise<void>;
  /** Called after successful notification — use for conversation history storage */
  onNotified?: (task: BackgroundTask) => Promise<void>;
}

/**
 * Ensure task directories exist
 */
function ensureDirectories(): void {
  fs.mkdirSync(ACTIVE_DIR, { recursive: true });
  fs.mkdirSync(COMPLETED_DIR, { recursive: true });
  fs.mkdirSync(NOTIFIED_DIR, { recursive: true });
}

/**
 * Format task completion message for Telegram
 */
/** Telegram message length limit */
const MAX_MESSAGE_LENGTH = 4096;

function formatCompletionMessage(task: BackgroundTask): string[] {
  // Failed tasks get a brief error notice
  if (task.status !== "success") {
    const errorMsg = task.error
      ? escapeHtml(task.error)
      : "Task did not complete successfully";
    return [
      `Couldn't finish that — ${escapeHtml(task.description)}\n\n${errorMsg}`,
    ];
  }

  // Success: send the summary directly as a natural message (no header chrome)
  if (!task.summary) {
    return [`Done with that — ${escapeHtml(task.description)}`];
  }

  const summaryHtml = markdownToTelegramHtml(task.summary);
  return splitTelegramMessage(summaryHtml, MAX_MESSAGE_LENGTH);
}

/**
 * Process a single completed task file
 */
async function processCompletedTask(
  filePath: string,
  sendMessage: (chatId: string, text: string) => Promise<void>,
  onNotified?: (task: BackgroundTask) => Promise<void>,
): Promise<boolean> {
  const filename = path.basename(filePath);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const task: BackgroundTask = JSON.parse(content);

    if (!task.chatId || !task.description) {
      logger.warn({ filename }, "Invalid task file: missing required fields");
      // Move to notified anyway to avoid reprocessing
      fs.renameSync(filePath, path.join(NOTIFIED_DIR, filename));
      return false;
    }

    // Send notification (may be split across multiple messages)
    const messages = formatCompletionMessage(task);
    for (const message of messages) {
      await sendMessage(task.chatId, message);
    }

    // Move to notified directory
    fs.renameSync(filePath, path.join(NOTIFIED_DIR, filename));

    // Store conversation history
    if (onNotified) {
      try {
        await onNotified(task);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(
          { taskId: task.id, err: msg },
          "onNotified callback failed",
        );
      }
    }

    logger.info(
      { taskId: task.id, chatId: task.chatId, status: task.status },
      "Task completion notification sent",
    );

    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(
      { filename, err: errorMsg },
      "Failed to process completed task",
    );

    // Move to notified with error suffix to avoid infinite retry
    try {
      fs.renameSync(filePath, path.join(NOTIFIED_DIR, `error-${filename}`));
    } catch {
      // If rename fails, delete to avoid infinite loop
      fs.unlinkSync(filePath);
    }

    return false;
  }
}

/**
 * Poll for completed tasks and send notifications
 */
async function pollCompletedTasks(
  sendMessage: (chatId: string, text: string) => Promise<void>,
  onNotified?: (task: BackgroundTask) => Promise<void>,
): Promise<number> {
  ensureDirectories();

  let processed = 0;

  try {
    const files = fs
      .readdirSync(COMPLETED_DIR)
      .filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const filePath = path.join(COMPLETED_DIR, file);
      const success = await processCompletedTask(
        filePath,
        sendMessage,
        onNotified,
      );
      if (success) processed++;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err: errorMsg }, "Error polling completed tasks");
  }

  return processed;
}

/**
 * Start the task watcher
 *
 * @returns Stop function to cancel the watcher
 */
export function startTaskWatcher(options: TaskWatcherOptions): () => void {
  const pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;

  ensureDirectories();
  logger.info({ pollInterval, tasksDir: TASKS_DIR }, "Task watcher started");

  let running = true;

  const poll = async () => {
    if (!running) return;

    const processed = await pollCompletedTasks(
      options.sendMessage,
      options.onNotified,
    );
    if (processed > 0) {
      logger.debug({ processed }, "Processed completed tasks");
    }

    if (running) {
      setTimeout(poll, pollInterval);
    }
  };

  // Start polling (don't await, let it run in background)
  poll();

  // Return stop function
  return () => {
    running = false;
    logger.info("Task watcher stopped");
  };
}

/**
 * Get list of currently active tasks
 */
export function getActiveTasks(): BackgroundTask[] {
  ensureDirectories();

  try {
    const files = fs.readdirSync(ACTIVE_DIR).filter((f) => f.endsWith(".json"));
    const tasks: BackgroundTask[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(ACTIVE_DIR, file), "utf-8");
        tasks.push(JSON.parse(content));
      } catch {
        // Skip invalid files
      }
    }

    return tasks;
  } catch {
    return [];
  }
}

/**
 * Get count of active tasks for a specific chat
 */
export function getActiveTaskCount(chatId: string): number {
  return getActiveTasks().filter((t) => t.chatId === chatId).length;
}
