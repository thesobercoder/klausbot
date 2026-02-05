---
phase: 02-core-loop
plan: 02
subsystem: memory
tags: [system-prompt, identity, context-injection, claude-cli]

# Dependency graph
requires:
  - phase: 02-01
    provides: KLAUSBOT_HOME, getHomePath, identity file structure
provides:
  - Context builder that combines identity files + retrieval instructions
  - System prompt injection via --append-system-prompt
  - Spawner cwd set to ~/.klausbot/ for agentic file access
affects: [02-03, 02-04, memory-retrieval, preference-learning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level cache for identity files (avoid I/O per request)
    - XML tag wrapping for structured identity content
    - Memory instructions in system prompt

key-files:
  created:
    - src/memory/context.ts
  modified:
    - src/memory/index.ts
    - src/daemon/spawner.ts

key-decisions:
  - "Identity files cached at startup - changes require process restart"
  - "XML tag wrapping for identity files: <FILENAME>content</FILENAME>"
  - "Retrieval instructions include today's date dynamically"

patterns-established:
  - "System prompt structure: identity content + memory instructions"
  - "Spawner cwd pattern for agentic file access"

# Metrics
duration: 2min
completed: 2026-01-29
---

# Phase 02 Plan 02: Context Builder Summary

**System prompt builder combining identity files (SOUL.md, IDENTITY.md, USER.md) + retrieval instructions, with spawner cwd=~/.klausbot/ for Claude's agentic file access**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-29T07:40:37Z
- **Completed:** 2026-01-29T07:42:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Context builder module that loads and caches identity files
- Retrieval instructions telling Claude how to search conversations and update preferences
- Spawner injects system prompt via --append-system-prompt
- Spawner sets cwd to ~/.klausbot/ for file access

## Task Commits

Each task was committed atomically:

1. **Task 1: Context builder module** - `9629b79` (feat)
2. **Task 2: Update spawner with cwd and system prompt** - `272d4e3` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `src/memory/context.ts` - loadIdentity(), getRetrievalInstructions(), buildSystemPrompt()
- `src/memory/index.ts` - Re-exports context functions
- `src/daemon/spawner.ts` - cwd=KLAUSBOT_HOME, --append-system-prompt

## Decisions Made

- Identity files cached at module level (process restart needed for changes)
- XML tag wrapping: `<SOUL.md>content</SOUL.md>` for clear structure
- Retrieval instructions include dynamic today's date (en-CA format: YYYY-MM-DD)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Context builder ready for use
- Spawner bootstraps Claude with identity + memory instructions
- Ready for 02-03 (handler integration) to wire query flow

---

_Phase: 02-core-loop_
_Completed: 2026-01-29_
