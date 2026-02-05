/**
 * Schedule parsing from user input
 * Handles: intervals (every X minutes), cron expressions, natural language dates
 */

import * as chrono from "chrono-node";
import { Cron } from "croner";
import type { CronSchedule } from "./types.js";

/** Parsed schedule result */
export interface ParsedSchedule {
  /** Schedule configuration */
  schedule: CronSchedule;
  /** Human-readable description */
  humanReadable: string;
  /** Next scheduled run, null if past/invalid */
  nextRun: Date | null;
}

/** Time unit multipliers in milliseconds */
const UNIT_MS: Record<string, number> = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parse user input to schedule
 * Tries patterns in order: interval, cron expression, natural language date
 *
 * @param input - User schedule description
 * @returns Parsed schedule or null if unparseable
 */
export function parseSchedule(input: string): ParsedSchedule | null {
  const normalized = input.toLowerCase().trim();

  // Pattern 1: "every X (second|minute|hour|day|week)s?"
  const everyMatch = normalized.match(
    /every\s+(\d+)\s*(second|minute|hour|day|week)s?/,
  );
  if (everyMatch) {
    const [, countStr, unit] = everyMatch;
    const count = parseInt(countStr, 10);
    const multiplier = UNIT_MS[unit];

    if (multiplier && count > 0) {
      const everyMs = count * multiplier;
      const anchorMs = Date.now();
      return {
        schedule: { kind: "every", everyMs, anchorMs },
        humanReadable: `every ${count} ${unit}${count !== 1 ? "s" : ""}`,
        nextRun: new Date(anchorMs + everyMs),
      };
    }
  }

  // Pattern 2: "every day at TIME" / "daily at TIME" -> cron expression
  const dailyMatch = normalized.match(
    /(?:every\s*day|daily)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (dailyMatch) {
    let hour = parseInt(dailyMatch[1], 10);
    const minute = dailyMatch[2] ? parseInt(dailyMatch[2], 10) : 0;
    const ampm = dailyMatch[3]?.toLowerCase();

    // Convert to 24-hour format
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    const cronExpr = `${minute} ${hour} * * *`;
    try {
      const cron = new Cron(cronExpr);
      const next = cron.nextRun();
      const timeStr = `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
      return {
        schedule: { kind: "cron", expr: cronExpr },
        humanReadable: `every day at ${timeStr}`,
        nextRun: next,
      };
    } catch {
      // Fall through
    }
  }

  // Pattern 3: "every morning/afternoon/evening at TIME"
  const timeOfDayMatch = normalized.match(
    /every\s+(morning|afternoon|evening)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (timeOfDayMatch) {
    let hour = parseInt(timeOfDayMatch[2], 10);
    const minute = timeOfDayMatch[3] ? parseInt(timeOfDayMatch[3], 10) : 0;
    const ampm = timeOfDayMatch[4]?.toLowerCase();

    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    const cronExpr = `${minute} ${hour} * * *`;
    try {
      const cron = new Cron(cronExpr);
      const next = cron.nextRun();
      const timeStr = `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
      return {
        schedule: { kind: "cron", expr: cronExpr },
        humanReadable: `every day at ${timeStr}`,
        nextRun: next,
      };
    } catch {
      // Fall through
    }
  }

  // Pattern 4: "every weekday at TIME"
  const weekdayMatch = normalized.match(
    /every\s+weekday\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (weekdayMatch) {
    let hour = parseInt(weekdayMatch[1], 10);
    const minute = weekdayMatch[2] ? parseInt(weekdayMatch[2], 10) : 0;
    const ampm = weekdayMatch[3]?.toLowerCase();

    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    const cronExpr = `${minute} ${hour} * * 1-5`;
    try {
      const cron = new Cron(cronExpr);
      const next = cron.nextRun();
      const timeStr = `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
      return {
        schedule: { kind: "cron", expr: cronExpr },
        humanReadable: `every weekday at ${timeStr}`,
        nextRun: next,
      };
    } catch {
      // Fall through
    }
  }

  // Pattern 5: Cron expression (starts with digit or asterisk)
  if (/^[\d*]/.test(normalized)) {
    try {
      const cron = new Cron(normalized);
      const next = cron.nextRun();
      return {
        schedule: { kind: "cron", expr: normalized },
        humanReadable: `cron: ${normalized}`,
        nextRun: next,
      };
    } catch {
      // Not a valid cron expression, continue to next pattern
    }
  }

  // Pattern 6: Natural language date (via chrono-node)
  const parsed = chrono.parse(input);
  if (parsed.length > 0 && parsed[0].start) {
    const date = parsed[0].start.date();
    const now = Date.now();

    // Only accept future dates for 'at' schedules
    if (date.getTime() > now) {
      return {
        schedule: { kind: "at", atMs: date.getTime() },
        humanReadable: `at ${date.toLocaleString()}`,
        nextRun: date,
      };
    }

    // Date is in the past
    return {
      schedule: { kind: "at", atMs: date.getTime() },
      humanReadable: `at ${date.toLocaleString()} (past)`,
      nextRun: null,
    };
  }

  return null;
}
