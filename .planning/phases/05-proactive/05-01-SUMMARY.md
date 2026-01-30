---
phase: 05-proactive
plan: 01
subsystem: cron
tags: [scheduling, persistence, parsing]

dependency-graph:
  requires: [01-foundation]
  provides: [cron-types, cron-store, schedule-parsing, next-run-calculation]
  affects: [05-02-service, 05-03-executor]

tech-stack:
  added: [croner@8.x, chrono-node@2.9.x]
  patterns: [atomic-json-writes, schedule-discriminated-union]

key-files:
  created:
    - src/cron/types.ts
    - src/cron/store.ts
    - src/cron/parse.ts
    - src/cron/schedule.ts
    - src/cron/index.ts

decisions:
  - id: 05-01-01
    choice: "Three schedule kinds: at/every/cron"
    reason: "Covers one-shot, interval, and cron expression use cases"
  - id: 05-01-02
    choice: "croner for cron expressions"
    reason: "Zero deps, TypeScript native, timezone support, nextRun() API"
  - id: 05-01-03
    choice: "chrono-node for natural language"
    reason: "Battle-tested, multi-locale, TypeScript rewrite"

metrics:
  duration: 2.5 min
  completed: 2026-01-30
---

# Phase 05 Plan 01: Cron Foundation Summary

**One-liner:** Cron types, JSON persistence with atomic writes, schedule parsing via croner+chrono-node.

## What Was Built

### Task 1: Types and Store
Created type definitions for cron jobs and JSON persistence layer.

**Types (src/cron/types.ts):**
- `ScheduleKind`: `'at' | 'every' | 'cron'` discriminator
- `CronSchedule`: schedule config with kind-specific fields
- `CronJob`: full job definition (id, name, schedule, instruction, chatId, timestamps, status)
- `CronStoreFile`: versioned store format `{ version: 1, jobs: CronJob[] }`

**Store (src/cron/store.ts):**
- `STORE_PATH`: `~/.klausbot/cron/jobs.json`
- `loadCronStore()`: returns empty store if missing
- `saveCronStore()`: atomic write via temp file + rename

### Task 2: Parse and Schedule
Created schedule parsing from user input and next-run calculation.

**Parse (src/cron/parse.ts):**
- Pattern 1: `"every X (second|minute|hour|day|week)s?"` -> everyMs schedule
- Pattern 2: Cron expression (starts with digit/*) -> croner validation
- Pattern 3: Natural language date -> chrono-node parsing
- Returns `{ schedule, humanReadable, nextRun }`

**Schedule (src/cron/schedule.ts):**
- `computeNextRunAtMs()` handles all three schedule kinds
- 'at': returns atMs if future, null if past
- 'every': calculates next interval from anchor
- 'cron': uses croner with timezone option

**Barrel Export (src/cron/index.ts):**
All types and functions exported for module consumers.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schedule kinds | at/every/cron | Covers one-shot, interval, expression use cases |
| Cron library | croner | Zero deps, TS native, timezone support |
| NLP library | chrono-node | Multi-locale, TypeScript rewrite |
| Persistence | JSON file | Claude-accessible, no DB dependency |
| Write safety | temp+rename | Prevents corruption on crash |

## Verification Results

| Check | Status |
|-------|--------|
| npm run build | Pass |
| types.ts compiles | Pass |
| store.ts atomic writes | Pass |
| parseSchedule("every 5 minutes") | Pass |
| parseSchedule("0 9 * * *") | Pass |
| parseSchedule("tomorrow at 9am") | Pass |
| computeNextRunAtMs returns future timestamps | Pass |

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| src/cron/types.ts | Created | 65 |
| src/cron/store.ts | Created | 46 |
| src/cron/parse.ts | Created | 91 |
| src/cron/schedule.ts | Created | 56 |
| src/cron/index.ts | Created | 28 |
| package.json | Updated | +2 deps |

## Next Phase Readiness

**Ready for Plan 05-02:**
- Types exported for service layer
- Store functions ready for CRUD operations
- parseSchedule ready for job creation
- computeNextRunAtMs ready for scheduler loop

**Blockers:** None
**Open questions:** None
