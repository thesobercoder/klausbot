# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** 24/7 personal assistant that never forgets, never loses context, and self-improves through use.
**Current focus:** v1.1 Production Ready — Phase 14 (Testing Framework)

## Current Position

Phase: 14 of 14 (Testing Framework)
Plan: 0/? planned
Status: Phase 13.3 complete, Phase 14 not yet planned
Last activity: 2026-02-06 — Completed 13.3-02-PLAN.md (gateway integration + hook simplification)

Progress: [██████████████░] 93% (phases 9, 10, 11, 12, 13, 13.1, 13.2, 13.3 complete; 14 remaining)

## Milestone Summary

**v1.1 Production Ready:**

- 6 phases (9-14)
- 15 planned plans

**Scope:**

- Platform detection + 12-factor compliance
- Telegram streaming + threading
- Heartbeat.md system
- Docker + release docs
- Testing framework

**Removed (not needed for fork-and-run model):**

- Doctor command
- Setup/Onboard wizard
- Service management (launchd/systemd)

## Performance Metrics

**Velocity:**

- Total plans completed: 14 (v1.1)
- Average duration: 2m 58s
- Total execution time: 41m 42s

**By Phase:**

| Phase                       | Plans | Total   | Avg/Plan |
| --------------------------- | ----- | ------- | -------- |
| 09-platform-foundation      | 3/3   | 11m 14s | 3m 45s   |
| 10-telegram-streaming       | 2/2   | 7m 29s  | 3m 45s   |
| 11-telegram-threading       | 1/1   | 4m 00s  | 4m 00s   |
| 13-docker-release           | 2/2   | 4m 02s  | 2m 01s   |
| 12-heartbeat-system         | 3/3   | 6m 35s  | 2m 12s   |
| 13.2-subagent-orchestration | 1/1   | 4m 00s  | 4m 00s   |
| 13.3-infinite-conversation  | 2/2   | 4m 22s  | 2m 11s   |

_Updated after each plan completion_

## Accumulated Context

### Decisions

- Windows: WSL2 only (same as OpenClaw), no native Windows service
- Streaming: OpenClaw-style draft streaming for Telegram
- Config: JSON format, 12-factor compliant
- Testing: Unit + E2E ("tests pass = app works")
- Docker: Single container, identical behavior everywhere
- Phase order: Platform detection first (enables graceful degradation)
- WSL2 detection: os.release().includes('microsoft'), with Docker exclusion via /.dockerenv
- execPath: Use process.argv[1] not process.execPath for self-invocation
- Capability check: 5s timeout on claude auth status to prevent hanging
- Three capability levels: enabled (green), disabled (red required), degraded (yellow optional)
- Config strict mode: Unknown keys in JSON config cause validation failure
- mtime-based hot reload: getJsonConfig() cheap to call frequently
- .env in ~/.klausbot/.env: Loads from both cwd and home
- MIT license for klausbot open source
- Container-first: Docker is the deployment unit, provides isolation for Claude Code's unrestricted access
- CLI simplified: Only daemon, mcp, hook, pairing commands active
- Daemon auto-creates ~/.klausbot on startup (no init command needed)
- Single README file (no docs/ folder)
- Local dev only (not published npm package) — use `npm run dev`
- .env reads from both project folder and ~/.klausbot/.env
- Screenshots skipped — text descriptions sufficient
- XML input wrapping: User messages wrapped in `<user_message>` tags before passing to Claude CLI (security fix)
- Phase 13 removed: Claude Code handles prompt injection; only needed XML escaping
- Dockerfile: Uses native Claude Code installer (curl), runs as non-root klausbot user
- Streaming: Callback pattern over generator for return value access
- Streaming: No MCP/hooks (SessionStart/End don't apply to streams)
- Throttler: minTime 100ms allows fast drafts, lets Telegram reject if needed
- Gateway streaming: Skip streaming during bootstrap mode (identity files must exist first)
- Timeout: 90s dispatcher timeout (reduced from 5min), returns partial on timeout with user notice
- Markdown to HTML: Convert Claude markdown to Telegram HTML for proper code blocks, bold, italic rendering
- Drafts show raw markdown during streaming (preview), final message is formatted HTML
- Threading: First chunk replies to user message; subsequent chunks in-thread only
- Threading: Optional chaining for ctx.msg access (TypeScript null safety)
- Heartbeat: No immediate tick on startup (waits for first interval)
- Heartbeat: HEARTBEAT_OK exact match suppresses notification
- Heartbeat: Hot reload via config re-check on each tick
- Heartbeat: Gateway integration keeps cron and heartbeat schedulers together in lifecycle
- Heartbeat: Note collection uses regex triggers; Claude interprets intent (not verbatim storage)
- Subagents: Enabled by default (true) - assumes users want full capability
- Subagents: Task list ID includes chatId and timestamp - unique per chat session
- Subagents: Orchestration instructions skip bootstrap mode - identity must exist first
- Context budget: 120K chars (~30K tokens) via character estimation, no tokenizer library
- Thread detection: Walk backward through 30min gaps between conversations
- Tiered history: Full transcripts for active thread + today, summaries for yesterday + older
- Retrieval instructions: Assertive "MANDATORY: Search Before Claiming Ignorance" enforcement

### Roadmap Evolution

- Phase 13.1 inserted after Phase 13: Dockerfile Dependencies (URGENT) — Python + other runtime deps
- Phase 13.2 inserted after Phase 13.1: Subagent Orchestration — Claude spawning Claudes, agent-to-agent comms
- Phase 13.3 inserted after Phase 13.2: Infinite Conversation Context — timestamped history injection, thread detection, retrieval-first instructions

### Pending Todos

None.

### Blockers/Concerns

None. All TypeScript errors resolved (was: drizzle-orm type issue + others).

## Session Continuity

Last session: 2026-02-06
Stopped at: Completed 13.3-02-PLAN.md (gateway integration + hook simplification)
Resume file: None

## Next Steps

1. `/gsd:plan-phase 14` -- Plan testing framework (final phase of v1.1)
2. Execute Phase 14 plans
3. v1.1 Production Ready complete

---

_State updated: 2026-02-06 (13.3-02 gateway integration + hook simplification complete)_
_v1.1 in progress_
