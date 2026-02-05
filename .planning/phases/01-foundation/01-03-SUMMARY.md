---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [queue, spawner, child_process, persistence, json, uuid]

# Dependency graph
requires:
  - phase: 01-01
    provides: config system with DATA_DIR, pino logger with child loggers
provides:
  - Persistent message queue with crash recovery
  - Claude Code CLI spawner with inherited stdin workaround
  - Data directory helpers (ensureDataDir, getDataPath)
affects: [01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [disk-persisted-queue, crash-recovery-reset, inherited-stdin-spawn]

key-files:
  created: [src/daemon/queue.ts, src/daemon/spawner.ts, src/daemon/index.ts]
  modified: []

key-decisions:
  - "JSON file persistence for queue (simplest for single-user)"
  - "Reset 'processing' to 'pending' on restart for crash recovery"
  - "Inherited stdin workaround for Claude Code spawn hang bug"

patterns-established:
  - "Queue: persist on every state change, filter done messages on load"
  - "Spawner: stdio ['inherit', 'pipe', 'pipe'] for Claude Code (issue #771)"
  - "Daemon exports: centralized re-exports from daemon/index.ts"

# Metrics
duration: 4min
completed: 2026-01-28
---

# Phase 01 Plan 03: Message Queue and Claude Spawner Summary

**Disk-persistent message queue with crash recovery and Claude Code spawner using inherited stdin workaround**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-28T18:58:41Z
- **Completed:** 2026-01-28T19:02:30Z
- **Tasks:** 3
- **Files modified:** 3 created

## Accomplishments

- Message queue persists to JSON, survives restarts, resets processing messages to pending
- Claude Code spawner uses inherited stdin to avoid hang bug (issue #771)
- Data directory helpers for consistent path construction
- All daemon functionality exported from single index

## Task Commits

Each task was committed atomically:

1. **Task 1: Create persistent message queue** - `86d64db` (feat)
2. **Task 2: Create Claude Code spawner** - `973fc2c` (feat)
3. **Task 3: Create daemon index and data directory helpers** - `d645448` (feat)

## Files Created/Modified

- `src/daemon/queue.ts` - MessageQueue class with JSON persistence and crash recovery
- `src/daemon/spawner.ts` - queryClaudeCode function with timeout and inherited stdin
- `src/daemon/index.ts` - Re-exports and data directory helpers

## Decisions Made

1. **JSON file persistence** - Simplest solution for single-user scenario. Can upgrade to SQLite if reliability issues arise.

2. **Reset processing to pending on restart** - Processing messages indicate crash during handling. Safest to re-queue them.

3. **Inherited stdin for spawner** - Claude Code CLI hangs when all stdio is piped (issue #771). Inheriting stdin from parent resolves the hang.

4. **Configurable timeout with 5 min default** - Long enough for complex Claude responses, short enough to detect stuck processes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Queue and spawner ready for integration in Plan 04 (message processing loop)
- Daemon module exports provide clean interface for bot integration
- Spawner tested and working with Claude CLI

---

_Phase: 01-foundation_
_Completed: 2026-01-28_
