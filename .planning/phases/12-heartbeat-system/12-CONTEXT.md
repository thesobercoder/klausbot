# Phase 12: Heartbeat System - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Periodic awareness system that checks HEARTBEAT.md and can take actions or report findings. Users add reminders via natural language; Claude interprets and acts during scheduled checks. Distinct from cron (awareness + action vs scheduled tasks).

</domain>

<decisions>
## Implementation Decisions

### Check cadence

- 30 minute default interval, configurable via config
- Waits for first interval after startup (no immediate check)
- Can be disabled entirely via `heartbeat.enabled = false`
- If Claude responds "HEARTBEAT_OK" → suppress message to user
- Any other response → send to user

### File format

- Location: `~/.klausbot/HEARTBEAT.md` (alongside identity files)
- Free-form markdown — Claude reads and interprets naturally
- Optional expiry dates on items — Claude removes expired items
- Auto-create with template on first heartbeat if missing

### Note collection

- User adds reminders via natural language to bot ("remind me to check X")
- Claude interprets intent, stores cleaned/structured note (not verbatim)
- Trigger phrases at Claude's discretion ("remind me", "check on", "don't forget", etc.)
- Brief confirmation when note added: "Added to heartbeat reminders"

### Response behavior

- Multiple items → single combined message covering all
- Full tool calling enabled — Claude can execute actions (check email, call APIs, etc.)
- 5 minute timeout per heartbeat check (matches spawner)
- Notify user on failure: "Heartbeat check failed: [reason]"

### Claude's Discretion

- Template content for auto-created HEARTBEAT.md
- Exact format for cleaned/structured notes
- How to handle ambiguous expiry dates
- Message formatting for combined reports

</decisions>

<specifics>
## Specific Ideas

- "I can ask you to check my email or put a heartbeat for my email and check if I have anything important" — tool calling is essential
- Single heartbeat process checking one file with multiple notes inside (not multi-heartbeat like cron)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 12-heartbeat-system_
_Context gathered: 2026-02-05_
