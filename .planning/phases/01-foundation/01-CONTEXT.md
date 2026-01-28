# Phase 1: Foundation - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Gateway daemon (klausbot) runs 24/7, handles Telegram ↔ Claude Code communication, enforces security via pairing flow, persists message queue across restarts.

**Project rename:** clawdbot → klausbot

</domain>

<decisions>
## Implementation Decisions

### Message handling
- Typing indicator while processing (standard Telegram API)
- Auto-split long responses that exceed Telegram's 4096 char limit
- Flat messages (no reply threading)
- Queue incoming messages — process sequentially, preserve order

### Error surfacing
- Friendly + error type: "Network timeout while processing" — category visible, no stack traces
- Auto-retry (2-3 attempts) silently before surfacing error to user
- Clear explanation for rate limits/budget caps: "Rate limited, try again in X minutes"
- Verbose non-blocking logging of full activity (requests, responses, errors, timings)

### Security / Pairing flow
- Adopt moltbot-style pairing (reference: https://github.com/moltbot/moltbot)
- `/start` command shows pairing code: "Use code X to pair"
- CLI approval: `klausbot pairing approve telegram <code>`
- After pairing message: further messages get "Waiting for approval" until paired
- Pending requests never expire
- Log all pairing attempts (requested, approved, rejected) — full audit trail

### Slash commands
- **Telegram-specific commands** (handled by gateway):
  - `/start` — pairing flow
  - `/model` — check/switch model
  - Additional commands: Claude's discretion on minimal useful set
  - Register all with BotFather (appear in Telegram's / menu)
- **Pass-through commands** (forwarded to Claude Code):
  - Commands like `/who_am_i`, `/help` invoke corresponding Claude commands
  - Implementation needs research: how `claude -p` handles slash commands

### Operational behavior
- Custom status messages progression: "Thinking..." → "Reading files..." → "Writing response..."
- Persist message queue to disk — resume unprocessed messages on restart
- Standard logging verbosity: requests, responses, key events (not debug-level)
- Deployment options:
  - systemd service when available (auto-start, restart on failure)
  - Dockerfile with proper entrypoint
  - `klausbot install` — interactive wizard TUI for daemon installation
  - Dev mode: run directly without daemon installation

### Claude's Discretion
- Exact status message progression and timing
- Additional Telegram-specific commands beyond /start and /model
- Logging format (structured JSON vs plaintext)
- Message queue persistence format
- Retry timing and backoff strategy

</decisions>

<specifics>
## Specific Ideas

- Reference moltbot pairing implementation: https://github.com/moltbot/moltbot
- CLI should be environment-aware (detect systemd availability, Docker, dev mode)
- Single binary serves as both daemon and CLI tool with different subcommands

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-01-28*
