/**
 * Cron system types
 * Supports three schedule kinds: one-shot (at), interval (every), cron expression (cron)
 */

/** Schedule type discriminator */
export type ScheduleKind = 'at' | 'every' | 'cron';

/**
 * Schedule configuration
 * Only one set of fields is used depending on kind
 */
export interface CronSchedule {
  kind: ScheduleKind;
  /** For 'at': target timestamp in ms (one-shot) */
  atMs?: number;
  /** For 'every': interval duration in ms */
  everyMs?: number;
  /** For 'every': reference point to anchor intervals */
  anchorMs?: number;
  /** For 'cron': cron expression string */
  expr?: string;
  /** Timezone in IANA format (e.g., 'America/New_York') */
  tz?: string;
}

/** Job execution status */
export type JobStatus = 'success' | 'failed';

/**
 * Cron job definition
 * Stored in JSON file, survives process restart
 */
export interface CronJob {
  /** Unique job identifier (UUID) */
  id: string;
  /** Human-readable job name */
  name: string;
  /** Schedule configuration */
  schedule: CronSchedule;
  /** What Claude should do when job runs */
  instruction: string;
  /** Telegram chat to notify */
  chatId: number;
  /** Job creation timestamp (ms) */
  createdAt: number;
  /** Next scheduled run (ms), null if expired/disabled */
  nextRunAtMs: number | null;
  /** Last run timestamp (ms), null if never run */
  lastRunAtMs: number | null;
  /** Last execution status, null if never run */
  lastStatus: JobStatus | null;
  /** Error message from last failure, null if success or never run */
  lastError: string | null;
  /** Duration of last execution (ms), null if never run */
  lastDurationMs: number | null;
  /** Whether job is active */
  enabled: boolean;
  /** Human-readable schedule description (e.g., "every 5 minutes") */
  humanSchedule: string;
}

/**
 * Cron store file format
 * Versioned for future migrations
 */
export interface CronStoreFile {
  /** Schema version */
  version: 1;
  /** All stored jobs */
  jobs: CronJob[];
}
