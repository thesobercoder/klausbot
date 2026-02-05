---
phase: 05-proactive
plan: 02
subsystem: cron
tags: [execution, scheduling, service]

dependency-graph:
  requires: [05-01-foundation]
  provides: [cron-executor, cron-service, cron-scheduler]
  affects: [05-03-integration, 05-04-commands]

tech-stack:
  added: []
  patterns: [sequential-job-execution, retry-with-delay, missed-job-recovery]

key-files:
  created:
    - src/cron/executor.ts
    - src/cron/service.ts
    - src/cron/scheduler.ts
  modified:
    - src/cron/index.ts

decisions:
  - id: 05-02-01
    choice: "Retry once after 60s delay"
    reason: "Balance between reliability and resource use"
  - id: 05-02-02
    choice: "Sequential execution with isExecuting flag"
    reason: "Prevents resource contention, simplifies debugging"
  - id: 05-02-03
    choice: "Recover missed jobs within 24 hours"
    reason: "Balance between catching up and not overwhelming system"

metrics:
  duration: 2.3 min
  completed: 2026-01-30
---

# Phase 05 Plan 02: Cron Execution Engine Summary

**One-liner:** Job executor with retry via queryClaudeCode, CRUD service for job lifecycle, scheduler loop with sequential execution.

## What Was Built

### Task 1: Cron Executor with Retry

Created `src/cron/executor.ts` with job execution logic.

**Constants:**

- `CRON_TIMEOUT`: 3600000ms (1 hour per CONTEXT.md)
- `RETRY_DELAY`: 60000ms (1 minute)

**executeCronJob(job: CronJob):**

1. Calls `queryClaudeCode` with job instruction
2. Appends cron context via `additionalInstructions`
3. On success: sends result to user via `bot.api.sendMessage`
4. On failure: waits 60s, retries once
5. Returns `{ success, result, durationMs }`

**Cron context format:**

```xml
<cron-execution>
This is an autonomous cron job execution.
Job name: ${job.name}
Job ID: ${job.id}

Complete the task and provide a concise result summary.
</cron-execution>
```

### Task 2: CRUD Service and Scheduler Loop

**Service (src/cron/service.ts):**

- `createCronJob(params)`: generates UUID, computes nextRunAtMs, persists
- `listCronJobs(chatId?)`: returns all or filtered by chatId
- `getCronJob(id)`: returns single job
- `updateCronJob(id, updates)`: partial update, recalculates nextRunAtMs if schedule changed
- `deleteCronJob(id)`: removes from store
- `updateJobStatus(id, result)`: updates lastRunAtMs/lastStatus/lastError/lastDurationMs/nextRunAtMs

**Scheduler (src/cron/scheduler.ts):**

- `startScheduler()`: starts 60s tick loop
- `stopScheduler()`: clears interval
- `tick()`: checkAndEnqueueDueJobs then processNextJob
- `checkAndEnqueueDueJobs()`: finds jobs where nextRunAtMs <= now
- `processNextJob()`: executes if !isExecuting and queue not empty
- `recoverMissedJobs()`: on startup, enqueues jobs missed < 24h
- `getSchedulerStatus()`: returns { running, isExecuting, pendingCount }

**Sequential execution:** `isExecuting` flag prevents concurrent job runs. When one job completes, `setImmediate` triggers next.

**Missed job recovery:** On startup, any job with `nextRunAtMs` in past (but within 24h) is enqueued for immediate execution.

## Technical Decisions

| Decision          | Choice                     | Rationale                                   |
| ----------------- | -------------------------- | ------------------------------------------- |
| Retry strategy    | Once after 60s             | Simple, predictable, avoids runaway retries |
| Execution model   | Sequential (one at a time) | Prevents resource contention                |
| Missed job window | 24 hours                   | Catches recent misses without backlog flood |
| Tick interval     | 60 seconds                 | Minute-level precision sufficient for cron  |

## Verification Results

| Check                                          | Status |
| ---------------------------------------------- | ------ |
| npm run build                                  | Pass   |
| executor imports queryClaudeCode from spawner  | Pass   |
| executor imports bot from telegram/bot         | Pass   |
| scheduler imports executeCronJob from executor | Pass   |
| CRON_TIMEOUT = 3600000 (1 hour)                | Pass   |
| All functions exported via index.ts            | Pass   |

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

| File                  | Change   | Lines |
| --------------------- | -------- | ----- |
| src/cron/executor.ts  | Created  | 121   |
| src/cron/service.ts   | Created  | 140   |
| src/cron/scheduler.ts | Created  | 168   |
| src/cron/index.ts     | Modified | +21   |

## Next Phase Readiness

**Ready for Plan 05-03 (Integration):**

- `startScheduler()` ready for gateway integration
- `stopScheduler()` ready for shutdown hook
- `createCronJob()` ready for Claude to use
- `listCronJobs()` ready for /crons command

**Blockers:** None
**Open questions:** None
