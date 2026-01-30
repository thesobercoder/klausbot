/**
 * Next run calculation for cron schedules
 */

import { Cron } from 'croner';
import type { CronSchedule } from './types.js';

/**
 * Compute next run time for a schedule
 *
 * @param schedule - Schedule configuration
 * @param nowMs - Current time in ms (defaults to Date.now())
 * @returns Next run timestamp in ms, or null if no future run
 */
export function computeNextRunAtMs(
  schedule: CronSchedule,
  nowMs: number = Date.now()
): number | null {
  switch (schedule.kind) {
    case 'at': {
      // One-shot: return if in future, null if past
      const atMs = schedule.atMs ?? 0;
      return atMs > nowMs ? atMs : null;
    }

    case 'every': {
      // Interval: calculate next run from anchor
      const everyMs = Math.max(1, schedule.everyMs ?? 0);
      const anchor = schedule.anchorMs ?? nowMs;

      // If current time is before anchor, next run is at anchor
      if (nowMs < anchor) {
        return anchor;
      }

      // Calculate how many intervals have elapsed
      const elapsed = nowMs - anchor;
      const steps = Math.ceil(elapsed / everyMs);
      return anchor + steps * everyMs;
    }

    case 'cron': {
      // Cron expression: use croner to calculate next run
      if (!schedule.expr) {
        return null;
      }

      try {
        const cron = new Cron(schedule.expr, {
          timezone: schedule.tz ?? undefined,
        });
        const next = cron.nextRun(new Date(nowMs));
        return next ? next.getTime() : null;
      } catch {
        // Invalid cron expression
        return null;
      }
    }

    default:
      return null;
  }
}
