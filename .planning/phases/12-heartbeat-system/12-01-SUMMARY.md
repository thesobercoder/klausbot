---
phase: 12-heartbeat-system
plan: 01
subsystem: heartbeat
tags: [heartbeat, scheduler, periodic, awareness]

depends:
  requires: [10-telegram-streaming]
  provides: [heartbeat-core]
  affects: [12-02-gateway-integration]

tech-stack:
  added: []
  patterns: [setInterval-scheduler, HEARTBEAT_OK-suppression]

key-files:
  created:
    - src/heartbeat/scheduler.ts
    - src/heartbeat/executor.ts
    - src/heartbeat/index.ts
  modified:
    - src/config/schema.ts

decisions:
  - No immediate tick on startup (waits for first interval)
  - HEARTBEAT_OK exact match suppresses notification
  - 5 minute timeout matches batch spawner
  - Hot reload via config re-check on each tick

metrics:
  duration: 3m 45s
  completed: 2026-02-05
---

# Phase 12 Plan 01: Heartbeat Core Summary

Heartbeat config schema + scheduler loop + executor with HEARTBEAT_OK suppression, ready for gateway integration.

## What Was Built

### Config Schema Extension

Added `heartbeat` object to `jsonConfigSchema`:

- `enabled`: boolean (default: true)
- `intervalMs`: number (min 60000, default 1800000 = 30 min)

### Scheduler Module (src/heartbeat/scheduler.ts)

- `startHeartbeat()`: Creates setInterval, no immediate tick
- `stopHeartbeat()`: Clears interval
- Concurrent execution prevention (`isExecuting` flag)
- Hot reload support via config re-check each tick

### Executor Module (src/heartbeat/executor.ts)

- `executeHeartbeat()`: Invokes Claude with heartbeat prompt
- Auto-creates HEARTBEAT.md with template if missing
- 5 minute timeout (matches batch spawner)
- `HEARTBEAT_OK` exact match returns `{ ok: true, suppressed: true }`
- Non-OK responses sent to all approved users with `[Heartbeat]` prefix
- Failure notification sent per CONTEXT.md requirements

### Module Index (src/heartbeat/index.ts)

Re-exports: `startHeartbeat`, `stopHeartbeat`, `executeHeartbeat`, `getHeartbeatPath`, `HeartbeatResult`

## Key Design Decisions

1. **No immediate tick**: Scheduler waits for first interval per CONTEXT.md
2. **HEARTBEAT_OK suppression**: Exact string match after trim
3. **Hot reload**: Config re-checked each tick, stops if disabled
4. **Concurrent prevention**: Single execution at a time

## Commits

| Hash    | Type | Description                                |
| ------- | ---- | ------------------------------------------ |
| f6b740a | feat | add heartbeat config schema                |
| a25c379 | feat | create heartbeat scheduler module          |
| 673712b | feat | create heartbeat executor and module index |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed import path for markdownToTelegramHtml**

- **Found during:** Task 3
- **Issue:** Plan specified `../utils/markdown.js` but function is in `../utils/telegram-html.ts` (exported via `../utils/index.js`)
- **Fix:** Changed import to `import { createChildLogger, markdownToTelegramHtml } from "../utils/index.js"`
- **Files modified:** src/heartbeat/executor.ts
- **Commit:** 673712b

## Verification

- TypeScript: Compiles (no new errors from heartbeat module)
- Config schema: heartbeat.enabled + heartbeat.intervalMs present
- Module structure: scheduler.ts, executor.ts, index.ts created
- Exports: All public functions available

## Next Steps

- 12-02: Gateway integration (call startHeartbeat from daemon startup)

---

_Plan: 12-01 | Completed: 2026-02-05 | Duration: 3m 45s_
