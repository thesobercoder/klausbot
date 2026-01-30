# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-28)

**Core value:** 24/7 personal assistant that never forgets, never loses context, and self-improves through use.
**Current focus:** Phase 5.1 - ACP Streaming (Complete)

## Current Position

Phase: 5.1 of 7 (ACP Streaming)
Plan: 2 of 2 in Phase 5.1
Status: Phase complete
Last activity: 2026-01-30 - Completed 05.1-02-PLAN.md (ACP Streaming)

Progress: [████████░░] 80% (24/30 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 24
- Average duration: 4 min (excluding human verification time)
- Total execution time: ~82 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 7/7 | ~35 min | 5 min |
| 02-core-loop | 4/4 | 13 min | 3.3 min |
| 03-identity | 3/3 | ~12 min | 4 min |
| 04-skills | 3/3 | ~35 min | 12 min |
| 04.1-skills-polish | 2/2 | 4 min | 2 min |
| 05-proactive | 4/5 | 9.8 min | 2.5 min |
| 05.1-acp-streaming | 2/2 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 05-03 (2 min), 05-04 (3 min), 05.1-01 (3 min), 05.1-02 (4 min)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 04.1-01: Skill reminder appears first in system prompt (before identity)
- 04.1-01: Minimal wording: location only, no skill enumeration
- 04.1-02: SHA256 content hash for skill version detection
- 04.1-02: Empty contentHash = always up-to-date (no remote manifest)
- 05-01: Three schedule kinds (at/every/cron) for comprehensive coverage
- 05-01: croner for cron expressions (zero deps, TS native, timezone support)
- 05-01: chrono-node for natural language parsing (battle-tested)
- 05-02: Retry once after 60s delay (balance reliability vs resources)
- 05-02: Sequential job execution via isExecuting flag
- 05-02: Recover missed jobs within 24 hours on startup
- 05-03: startScheduler after initializeHome, stopScheduler before processing cleanup
- 05-03: /crons shows only enabled jobs with next run and last status
- 05-04: LEARNINGS.md agentic (read when relevant, not preloaded)
- 05-04: Proactive suggestions at task end, not mid-conversation
- 05-04: Cron management via natural language intent recognition
- 05.1-01: Use zod/v4 import (required by claude-agent-sdk)
- 05.1-01: Server name 'klausbot' - tools prefixed mcp__klausbot__*
- 05.1-02: 500ms debounce for Telegram edits (rate limit safe)
- 05.1-02: Streaming replaces typing indicator (better UX)
- 05.1-02: CLI cron instructions removed from prompt (MCP tools take over)

### Roadmap Evolution

- Phase 7 added: Resilience & Tooling (timeout recovery, skills cleanup, agent authoring)
- Phase 5.1 inserted after Phase 5: ACP Streaming - replace CLI spawner with ACP client for streaming + MCP tools (URGENT - architecture fix)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-30
Stopped at: Completed 05.1-02-PLAN.md (ACP Streaming) - Phase 5.1 complete
Resume file: None

---
*State updated: 2026-01-30*
