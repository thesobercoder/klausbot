/**
 * Cron service - CRUD operations for cron jobs
 */

import { randomUUID } from "crypto";
import type { CronJob, CronSchedule } from "./types.js";
import { loadCronStore, saveCronStore } from "./store.js";
import { computeNextRunAtMs } from "./schedule.js";
import type { ExecutionResult } from "./executor.js";

/** Parameters for creating a new cron job */
export interface CreateCronJobParams {
  name: string;
  schedule: CronSchedule;
  instruction: string;
  chatId: number;
  humanSchedule: string;
}

/**
 * Create a new cron job
 * Generates UUID, computes next run time, saves to store
 *
 * @param params - Job creation parameters
 * @returns Created job
 */
export function createCronJob(params: CreateCronJobParams): CronJob {
  const now = Date.now();
  const nextRunAtMs = computeNextRunAtMs(params.schedule, now);

  const job: CronJob = {
    id: randomUUID(),
    name: params.name,
    schedule: params.schedule,
    instruction: params.instruction,
    chatId: params.chatId,
    createdAt: now,
    nextRunAtMs,
    lastRunAtMs: null,
    lastStatus: null,
    lastError: null,
    lastDurationMs: null,
    enabled: true,
    humanSchedule: params.humanSchedule,
  };

  const store = loadCronStore();
  store.jobs.push(job);
  saveCronStore(store);

  return job;
}

/**
 * List all cron jobs, optionally filtered by chat ID
 *
 * @param chatId - Optional chat ID filter
 * @returns Array of jobs
 */
export function listCronJobs(chatId?: number): CronJob[] {
  const store = loadCronStore();

  if (chatId !== undefined) {
    return store.jobs.filter((job) => job.chatId === chatId);
  }

  return store.jobs;
}

/**
 * Get a single cron job by ID
 *
 * @param id - Job ID
 * @returns Job or undefined if not found
 */
export function getCronJob(id: string): CronJob | undefined {
  const store = loadCronStore();
  return store.jobs.find((job) => job.id === id);
}

/**
 * Update a cron job (partial update)
 * Recalculates nextRunAtMs if schedule changed
 *
 * @param id - Job ID
 * @param updates - Fields to update
 * @returns Updated job or undefined if not found
 */
export function updateCronJob(
  id: string,
  updates: Partial<
    Pick<
      CronJob,
      "name" | "schedule" | "instruction" | "enabled" | "humanSchedule"
    >
  >,
): CronJob | undefined {
  const store = loadCronStore();
  const jobIndex = store.jobs.findIndex((job) => job.id === id);

  if (jobIndex === -1) {
    return undefined;
  }

  const job = store.jobs[jobIndex];

  // Apply updates
  if (updates.name !== undefined) job.name = updates.name;
  if (updates.instruction !== undefined) job.instruction = updates.instruction;
  if (updates.enabled !== undefined) job.enabled = updates.enabled;
  if (updates.humanSchedule !== undefined)
    job.humanSchedule = updates.humanSchedule;

  // If schedule changed, recalculate next run time
  if (updates.schedule !== undefined) {
    job.schedule = updates.schedule;
    job.nextRunAtMs = computeNextRunAtMs(job.schedule);
  }

  saveCronStore(store);
  return job;
}

/**
 * Delete a cron job
 *
 * @param id - Job ID
 * @returns True if deleted, false if not found
 */
export function deleteCronJob(id: string): boolean {
  const store = loadCronStore();
  const initialLength = store.jobs.length;
  store.jobs = store.jobs.filter((job) => job.id !== id);

  if (store.jobs.length === initialLength) {
    return false;
  }

  saveCronStore(store);
  return true;
}

/**
 * Update job status after execution
 * Sets lastRunAtMs, lastStatus, lastError, lastDurationMs
 * Recalculates nextRunAtMs
 * Disables one-shot ('at') jobs after execution
 *
 * @param id - Job ID
 * @param result - Execution result
 */
export function updateJobStatus(id: string, result: ExecutionResult): void {
  const store = loadCronStore();
  const job = store.jobs.find((j) => j.id === id);

  if (!job) {
    return;
  }

  job.lastRunAtMs = Date.now();
  job.lastStatus = result.success ? "success" : "failed";
  job.lastError = result.success ? null : result.result;
  job.lastDurationMs = result.durationMs;

  // Calculate next run time
  job.nextRunAtMs = computeNextRunAtMs(job.schedule);

  // Disable one-shot ('at') jobs after execution
  if (job.schedule.kind === "at") {
    job.enabled = false;
  }

  saveCronStore(store);
}
