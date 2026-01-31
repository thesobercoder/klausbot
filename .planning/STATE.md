# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-28)

**Core value:** 24/7 personal assistant that never forgets, never loses context, and self-improves through use.
**Current focus:** Phase 7.2 - Conversation Continuity (Claude Code hooks)

## Current Position

Phase: 7.2 of 7.2 (Conversation Continuity)
Plan: 2 of 3 in Phase 7.2
Status: In progress
Last activity: 2026-01-31 - Completed 07.2-02-PLAN.md (Conversation Storage)

Progress: [██████████] 100% (40/41 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 39
- Average duration: ~4.6 min (excluding human verification time)
- Total execution time: ~179 min

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
| 07-resilience-tooling | 4/4 | ~52 min | 13 min |
| 07.1-memory-search-mcp | 3/3 | 16 min | 5.3 min |
| 07.2-conversation-continuity | 2/3 | 6 min | 3 min |

**Recent Trend:**
- Last 5 plans: 07.1-02 (2 min), 07.1-03 (2 min), 07.2-01 (2 min), 07.2-02 (4 min)
- Trend: Phase 7.2 - Conversation storage complete

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
- 07-01: Graceful null returns for transcript recovery failures
- 07-01: Recovered responses prefixed with [Recovered from timeout]
- 07-01: session_id 'recovered' and cost_usd 0 for recovered responses
- 07-02: Skills CLI removed - management via npx skills or manual
- 07-02: skill-creator installed during wizard, not gateway startup
- 07-02: GitHub fetch calls use withRetry (3 retries, 1s base delay)
- 07-03: Agent reminder after skill reminder (folder location reminders grouped)
- 07-03: Agent file format: YAML frontmatter (name, description, tools, model) + body
- 07-04: CLI shows help by default (no command = help)
- 07-04: Confirmations for init reset, pairing revoke, cron delete
- 07-04: Init command clears conversations on reset (preserves config)
- 07-04: CLI commands silence logging (clean output)
- 07-04: Commander.js as standard CLI framework
- 07.1-01: Use sqliteVec.load(db) instead of db.loadExtension() for proper binding
- 07.1-01: BigInt(rowid) required for vec0 virtual table inserts
- 07.1-01: Float32Array directly (not .buffer) for vector data
- 07.1-01: initializeEmbeddings() kept as no-op for API compatibility
- 07.1-02: Use k = ? constraint for sqlite-vec KNN (not LIMIT)
- 07.1-02: Score as 1/(1+distance) for intuitive percentage display
- 07.1-02: MCP tool registration pattern: registerXTools(server)
- 07.1-03: MCP log namespace pattern: mcp-server, mcp:memory, mcp:cron
- 07.1-03: Structured logging with params object first, message second
- 07.1-03: Warning level for validation failures (invalid schedule, not found)
- 07.2: SQLite as single source of truth for conversations (remove markdown logs)
- 07.2: SessionEnd hook parses Claude transcript, stores in SQLite with summary + embedding
- 07.2: Hook commands via exact klausbot CLI path (not global install)
- 07.2: Hooks passed via --settings inline JSON (not file)
- 07.2: Drizzle ORM for SQLite schema management and migrations
- 07.2: Gateway startup runs migrations before starting services
- 07.2: Migrate existing embeddings table to Drizzle schema
- 07.2: SessionStart injects current datetime for temporal context
- 07.2-01: 5s timeout on stdin read to prevent hanging
- 07.2-01: stdout for SessionStart context injection, stderr for logging
- 07.2-01: Markdown logger deprecated (kept for reference)
- 07.2-02: Raw SQL for migrations instead of drizzle-kit push (simpler runtime)
- 07.2-02: gpt-4o-mini for summarization (cost-effective at ~$0.0001/summary)
- 07.2-02: Truncate conversations to 10k chars before summarization
- 07.2-02: Upsert by sessionId for safe re-execution of SessionEnd hook
- 07.2-02: Dynamic imports in hooks avoid DB initialization overhead

### Roadmap Evolution

- Phase 7 added: Resilience & Tooling (timeout recovery, skills cleanup, agent authoring)
- Phase 5.1: Originally "ACP Streaming" with Agent SDK. Pivoted to "MCP Cron Tools" with CLI spawner after SDK issues.
- Phase 7.1 inserted: Memory Search MCP (URGENT) - embeddings exist but Claude can't search them, need SQLite + MCP tool
- Phase 7.2 inserted: Conversation Continuity - Claude Code hooks for context injection, conversation ownership, inspired by OpenClaw architecture
- Phase 8 added: CLI Theme System - consistent output formatting with helper methods and unified color scheme

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-31T05:10:00Z
Stopped at: Completed 07.2-02-PLAN.md (Conversation Storage)
Resume file: None

---
*State updated: 2026-01-31*
