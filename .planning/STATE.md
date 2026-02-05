# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** 24/7 personal assistant that never forgets, never loses context, and self-improves through use.
**Current focus:** v1.1 Production Ready — Phase 11 (Telegram Threading)

## Current Position

Phase: 10 of 14 (Telegram Streaming) — COMPLETE
Plan: 2/2 complete
Status: Phase 10 complete, ready for Phase 11
Last activity: 2026-02-05 — Streaming complete with markdown-to-HTML formatting

Progress: [█████████░] 50% (phases 9, 10, 13 complete; 11, 12, 14 remaining)

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

- Total plans completed: 7 (v1.1)
- Average duration: 3m 15s
- Total execution time: 22m 45s

**By Phase:**

| Phase                  | Plans | Total   | Avg/Plan |
| ---------------------- | ----- | ------- | -------- |
| 09-platform-foundation | 3/3   | 11m 14s | 3m 45s   |
| 10-telegram-streaming  | 2/2   | 7m 29s  | 3m 45s   |
| 13-docker-release      | 2/2   | 4m 02s  | 2m 01s   |

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
- Timeout: 5 minute streaming timeout matches batch spawner, returns partial on timeout
- Markdown to HTML: Convert Claude markdown to Telegram HTML for proper code blocks, bold, italic rendering
- Drafts show raw markdown during streaming (preview), final message is formatted HTML

### Pending Todos

None.

### Blockers/Concerns

- Pre-existing TypeScript error in src/memory/conversations.ts (drizzle-orm type issue) - does not block execution

## Session Continuity

Last session: 2026-02-05
Stopped at: Phase 10 complete with markdown formatting
Resume file: None

## Next Steps

1. `/gsd:plan-phase 11` — Plan Telegram threading
2. Or `/gsd:plan-phase 12` — Plan heartbeat system
3. Or `/gsd:plan-phase 14` — Plan testing framework

---

_State updated: 2026-02-05 (Phase 10 complete)_
_v1.1 in progress_
