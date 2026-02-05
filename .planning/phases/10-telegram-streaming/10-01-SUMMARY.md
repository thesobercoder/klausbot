---
phase: 10-telegram-streaming
plan: 01
subsystem: telegram
tags: [grammyjs, streaming, throttler, ndjson, spawn]

# Dependency graph
requires:
  - phase: 09-platform-foundation
    provides: Config system, KLAUSBOT_HOME, buildSystemPrompt
provides:
  - streamClaudeResponse function with callback pattern
  - StreamConfig/StreamOptions/StreamResult types
  - Streaming config in jsonConfigSchema
  - apiThrottler for draft message rate limiting
affects: [10-02-gateway, 10-03-threads]

# Tech tracking
tech-stack:
  added: [@grammyjs/transformer-throttler]
  patterns: [callback streaming, NDJSON parsing]

key-files:
  created: [src/telegram/streaming.ts]
  modified: [src/config/schema.ts, src/telegram/bot.ts, src/telegram/index.ts]

key-decisions:
  - "Callback pattern over async generator for streamClaudeResponse return value access"
  - "No MCP/hooks for streaming mode (SessionStart/End don't apply to streams)"
  - "minTime: 100ms throttler allows fast drafts, lets Telegram reject if needed"

patterns-established:
  - "Streaming: spawn claude with stream-json, parse NDJSON, call onChunk callback"
  - "Cost tracking: Extract cost_usd from final result event"

# Metrics
duration: 3min
completed: 2026-02-05
---

# Phase 10 Plan 01: Streaming Infrastructure Summary

**Claude CLI stream spawner with callback pattern, NDJSON parser, and Telegram throttler for real-time draft updates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-05T16:52:00Z
- **Completed:** 2026-02-05T16:55:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created streaming module with callback-based Claude CLI spawner
- Extended config schema with streaming.enabled and streaming.throttleMs options
- Configured apiThrottler for rate-limited draft message updates
- Exported streaming types and function from telegram module

## Task Commits

Each task was committed atomically:

1. **Task 1: Install throttler and extend config schema** - `baf021f` (feat)
2. **Task 2: Create streaming module with Claude CLI spawner** - `b57c1f2` (feat)
3. **Task 3: Add throttler to bot and export streaming module** - `78673e0` (feat)

## Files Created/Modified

- `src/telegram/streaming.ts` - Claude CLI stream spawner with callback pattern, NDJSON parser
- `src/config/schema.ts` - Extended jsonConfigSchema with streaming options
- `src/telegram/bot.ts` - Added apiThrottler transformer for rate limiting
- `src/telegram/index.ts` - Exported streaming module types and function
- `package.json` - Added @grammyjs/transformer-throttler dependency

## Decisions Made

- **Callback pattern over generator:** Using `onChunk(text)` callback instead of async generator allows caller to access Promise return value (`{result, cost_usd}`) without awkward iterator handling
- **No MCP/hooks for streaming:** Streaming mode skips hooks (SessionStart/End don't apply) and MCP (tools work differently in stream context)
- **Throttler minTime: 100ms:** Allow fast draft updates, let Telegram's rate limiter reject if needed rather than over-throttling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Streaming infrastructure complete, ready for gateway integration in Plan 02
- Bot has throttler configured for draft message bursts
- streamClaudeResponse exported and ready for use in gateway

---
*Phase: 10-telegram-streaming*
*Completed: 2026-02-05*
