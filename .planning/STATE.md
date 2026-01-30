# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-28)

**Core value:** 24/7 personal assistant that never forgets, never loses context, and self-improves through use.
**Current focus:** Phase 7 - Resilience & Tooling (Not started)

## Current Position

Phase: 7 of 7 (Resilience & Tooling)
Plan: 0 of 4 in Phase 7
Status: Not started
Last activity: 2026-01-30 - Completed Phase 6 (Multimodal)

Progress: [██████████] 97% (31/32 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 31
- Average duration: ~3.4 min (excluding human verification time)
- Total execution time: ~104 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 7/7 | ~35 min | 5 min |
| 02-core-loop | 4/4 | 13 min | 3.3 min |
| 03-identity | 3/3 | ~12 min | 4 min |
| 04-skills | 3/3 | ~35 min | 12 min |
| 04.1-skills-polish | 2/2 | 4 min | 2 min |
| 05-proactive | 4/5 | 9.8 min | 2.5 min |
| 05.1-mcp-cron | 2/2 | ~5 min | 2.5 min |
| 06-multimodal | 5/5 | ~11 min | 2.2 min |

**Recent Trend:**
- Last 5 plans: 06-01 (~3 min), 06-02 (~1 min), 06-03 (~2 min), 06-04 (~3 min), 06-05 (~2 min)
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
- 05.1: PIVOT - Agent SDK query() hangs, use CLI spawner + MCP via --mcp-config flag
- 05.1-01: Separate build entry for MCP server (dist/mcp-server/index.js)
- 05.1-01: Tools return text content with graceful error messages
- 05.1-02: MCP config via temp file per process (klausbot-mcp-{pid}.json)
- 05.1-02: Removed cron CLI instructions (MCP tools self-describing)
- 06-01: MediaType as type union ('voice' | 'photo') for TS idiomacy
- 06-01: Error categorization with prefixes (Rate limited, Timeout)
- 06-01: Transient error detection via string pattern matching
- 06-02: UUID filenames for collision prevention in image storage
- 06-02: Dated subdirectories (~/.klausbot/images/{YYYY-MM-DD}/)
- 06-02: Explicit named exports in barrel (avoid conflicts)
- 06-03: Voice files deleted after transcription (ephemeral)
- 06-03: Voice-only messages use transcript as prompt
- 06-03: Non-fatal media errors noted after Claude response
- 06-04: downloadFile helper accepts Bot<any> for flavored context support
- 06-04: Media groups processed individually (each photo queued separately)
- 06-05: All multimodal features verified working in production

### Roadmap Evolution

- Phase 7 added: Resilience & Tooling (timeout recovery, skills cleanup, agent authoring)
- Phase 5.1: Originally "ACP Streaming" with Agent SDK. Pivoted to "MCP Cron Tools" with CLI spawner after SDK issues.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-30
Stopped at: Phase 6 complete, ready for Phase 7
Resume file: None

---
*State updated: 2026-01-30*
