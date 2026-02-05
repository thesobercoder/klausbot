/**
 * Cron job executor
 * Spawns Claude Code for job execution, notifies user, retries on failure
 */

import { queryClaudeCode } from "../daemon/spawner.js";
import { bot } from "../telegram/bot.js";
import type { CronJob } from "./types.js";
import { createChildLogger } from "../utils/index.js";
import { getJsonConfig } from "../config/index.js";

const log = createChildLogger("cron-executor");

/** Cron job timeout: 1 hour per CONTEXT.md */
const CRON_TIMEOUT = 3600000;

/** Retry delay: 1 minute */
const RETRY_DELAY = 60000;

/** Result of job execution */
export interface ExecutionResult {
  success: boolean;
  result: string;
  durationMs: number;
}

/**
 * Execute a cron job
 * - Spawns Claude Code with cron context
 * - Notifies user of result via Telegram
 * - Retries once on failure
 *
 * @param job - Cron job to execute
 * @returns Execution result
 */
export async function executeCronJob(job: CronJob): Promise<ExecutionResult> {
  const startTime = Date.now();

  log.info(
    { jobId: job.id, jobName: job.name, chatId: job.chatId },
    "Executing cron job",
  );

  const jsonConfig = getJsonConfig();

  try {
    const response = await queryClaudeCode(job.instruction, {
      timeout: CRON_TIMEOUT,
      model: jsonConfig.model,
      additionalInstructions: `
<cron-execution>
This is an autonomous cron job execution.
Job name: ${job.name}
Job ID: ${job.id}

Complete the task and provide a concise result summary.
</cron-execution>`,
    });

    const durationMs = Date.now() - startTime;

    // Notify user of success
    await bot.api.sendMessage(
      job.chatId,
      `[Cron: ${job.name}]\n${response.result}`,
    );

    log.info(
      { jobId: job.id, jobName: job.name, durationMs, cost: response.cost_usd },
      "Cron job completed successfully",
    );

    return { success: true, result: response.result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    log.warn(
      { jobId: job.id, jobName: job.name, error: errorMsg },
      "Cron job failed, retrying",
    );

    // Retry once after delay
    await new Promise((r) => setTimeout(r, RETRY_DELAY));

    try {
      const retryResponse = await queryClaudeCode(job.instruction, {
        timeout: CRON_TIMEOUT,
        model: jsonConfig.model,
        additionalInstructions: `
<cron-execution>
This is an autonomous cron job execution (retry attempt).
Job name: ${job.name}
Job ID: ${job.id}

Complete the task and provide a concise result summary.
</cron-execution>`,
      });

      const totalDurationMs = Date.now() - startTime;

      // Notify user of success (after retry)
      await bot.api.sendMessage(
        job.chatId,
        `[Cron: ${job.name}]\n${retryResponse.result}`,
      );

      log.info(
        {
          jobId: job.id,
          jobName: job.name,
          durationMs: totalDurationMs,
          retried: true,
        },
        "Cron job completed after retry",
      );

      return {
        success: true,
        result: retryResponse.result,
        durationMs: totalDurationMs,
      };
    } catch (retryError) {
      const totalDurationMs = Date.now() - startTime;
      const retryErrorMsg =
        retryError instanceof Error ? retryError.message : String(retryError);

      // Notify user of failure
      await bot.api.sendMessage(
        job.chatId,
        `[Cron: ${job.name} FAILED]\n${retryErrorMsg}`,
      );

      log.error(
        {
          jobId: job.id,
          jobName: job.name,
          error: retryErrorMsg,
          durationMs: totalDurationMs,
        },
        "Cron job failed after retry",
      );

      return {
        success: false,
        result: retryErrorMsg,
        durationMs: totalDurationMs,
      };
    }
  }
}
