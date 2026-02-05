/**
 * Cron scheduler - background loop for job execution
 * Checks for due jobs every minute, executes sequentially
 */

import type { CronJob } from "./types.js";
import { loadCronStore } from "./store.js";
import { executeCronJob } from "./executor.js";
import { updateJobStatus } from "./service.js";
import { computeNextRunAtMs } from "./schedule.js";
import { createChildLogger } from "../utils/index.js";

const log = createChildLogger("cron-scheduler");

/** Tick interval: check for due jobs every 60 seconds */
const TICK_INTERVAL = 60000;

/** Max age for missed jobs to be recovered: 24 hours */
const MISSED_JOB_MAX_AGE = 24 * 60 * 60 * 1000;

/** Scheduler state */
let schedulerInterval: NodeJS.Timeout | null = null;
let isExecuting = false;
const pendingJobs: CronJob[] = [];

/**
 * Start the scheduler loop
 * Checks for due jobs every minute
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    log.warn("Scheduler already running");
    return;
  }

  // Recover any missed jobs on startup
  recoverMissedJobs();

  // Start the tick loop
  schedulerInterval = setInterval(tick, TICK_INTERVAL);

  log.info({ tickInterval: TICK_INTERVAL }, "Cron scheduler started");

  // Run first tick immediately
  tick();
}

/**
 * Stop the scheduler loop
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log.info("Cron scheduler stopped");
  }
}

/**
 * Scheduler tick - check for due jobs and process queue
 */
async function tick(): Promise<void> {
  checkAndEnqueueDueJobs();
  await processNextJob();
}

/**
 * Check for jobs that are due and add them to pending queue
 */
function checkAndEnqueueDueJobs(): void {
  const store = loadCronStore();
  const nowMs = Date.now();

  for (const job of store.jobs) {
    // Skip disabled jobs
    if (!job.enabled) continue;

    // Skip jobs with no next run time
    if (job.nextRunAtMs === null) continue;

    // Check if job is due
    if (job.nextRunAtMs <= nowMs) {
      // Don't add if already in queue
      if (!pendingJobs.find((j) => j.id === job.id)) {
        pendingJobs.push(job);
        log.info(
          { jobId: job.id, jobName: job.name },
          "Job enqueued for execution",
        );
      }
    }
  }
}

/**
 * Process next job in queue (sequential execution)
 * Only one job runs at a time to prevent resource contention
 */
async function processNextJob(): Promise<void> {
  // Don't start new job if one is already executing
  if (isExecuting) {
    log.debug(
      { pendingCount: pendingJobs.length },
      "Execution in progress, waiting",
    );
    return;
  }

  // No jobs to process
  if (pendingJobs.length === 0) {
    return;
  }

  // Take next job from queue
  const job = pendingJobs.shift()!;
  isExecuting = true;

  log.info(
    { jobId: job.id, jobName: job.name, pendingAfter: pendingJobs.length },
    "Processing job",
  );

  try {
    const result = await executeCronJob(job);
    updateJobStatus(job.id, result);

    log.info(
      {
        jobId: job.id,
        jobName: job.name,
        success: result.success,
        durationMs: result.durationMs,
      },
      "Job execution complete",
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error(
      { jobId: job.id, jobName: job.name, error: errorMsg },
      "Job execution error",
    );

    // Update job status with failure
    updateJobStatus(job.id, {
      success: false,
      result: errorMsg,
      durationMs: 0,
    });
  } finally {
    isExecuting = false;
  }

  // Process next job if queue not empty
  if (pendingJobs.length > 0) {
    // Use setImmediate to avoid blocking
    setImmediate(() => processNextJob());
  }
}

/**
 * Recover jobs that were missed while process was offline
 * Only recovers jobs missed within the last 24 hours
 */
function recoverMissedJobs(): void {
  const store = loadCronStore();
  const nowMs = Date.now();
  let recovered = 0;

  for (const job of store.jobs) {
    // Skip disabled jobs
    if (!job.enabled) continue;

    // Skip jobs with no next run time
    if (job.nextRunAtMs === null) continue;

    // Check if job was missed (due in past but within 24h)
    const missedBy = nowMs - job.nextRunAtMs;
    if (missedBy > 0 && missedBy < MISSED_JOB_MAX_AGE) {
      // Don't add if already in queue
      if (!pendingJobs.find((j) => j.id === job.id)) {
        pendingJobs.push(job);
        recovered++;
        log.info(
          { jobId: job.id, jobName: job.name, missedByMs: missedBy },
          "Recovered missed job",
        );
      }
    }
  }

  if (recovered > 0) {
    log.info({ recoveredCount: recovered }, "Recovered missed jobs");
  }
}

/**
 * Get scheduler status (for debugging/monitoring)
 */
export function getSchedulerStatus(): {
  running: boolean;
  isExecuting: boolean;
  pendingCount: number;
} {
  return {
    running: schedulerInterval !== null,
    isExecuting,
    pendingCount: pendingJobs.length,
  };
}
