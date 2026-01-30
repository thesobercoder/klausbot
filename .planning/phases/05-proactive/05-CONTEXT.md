# Phase 5: Proactive - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Bot executes scheduled tasks autonomously and improves itself based on learnings. Two capabilities:
1. **Cron scheduling** — User-defined recurring tasks executed by the bot
2. **Self-evolution** — Bot learns from mistakes and suggests improvements

Reference implementation: moltbot cron system (https://github.com/moltbot/moltbot/tree/main/src/cron)

</domain>

<decisions>
## Implementation Decisions

### Cron Interface
- Natural language only — "remind me every morning at 9am" — Claude parses intent
- Confirmation shows next run time: "Created! Next run: tomorrow 9am"
- `/crons` command to list existing crons
- Modification/deletion through natural conversation
- JSON storage file (similar to moltbot's `CronStoreFile` pattern)

### Execution Behavior
- Always notify user via Telegram with cron result
- On failure: notify + retry once after delay, then report final status
- 1 hour timeout for long-running tasks
- Sequential execution (like moltbot) — one cron at a time, queue others

### Learning System
- Capture mode: both auto-capture and user-prompted ("remember this")
- LEARNINGS.md structure: flat chronological list, newest first
- Consultation: system prompt reminds Claude to agentically read LEARNINGS.md when relevant (not loaded at session start)
- Organic cleanup: Claude removes learnings that are no longer relevant (age doesn't matter, relevance does)

### Proactive Suggestions
- Timing: end of conversation, after completing a task
- Scope: anything — automation, workflows, general observations
- Frequency: every relevant session (when pattern detected)
- User always decides whether to accept or reject
- Not mandatory — suggestions appear organically when applicable to current task

### Claude's Discretion
- Exact schedule parsing implementation (can reference moltbot's `normalize.ts`, `parse.ts`)
- Retry delay duration
- Learning entry format and wording
- What constitutes a "pattern" worth suggesting about

</decisions>

<specifics>
## Specific Ideas

- moltbot's cron types: `at` (one-shot), `every` (interval), `cron` (expression) — good model
- moltbot tracks: nextRunAtMs, lastRunAtMs, lastStatus, lastError, lastDurationMs
- Isolated vs main session runs — moltbot pattern for posting summaries back

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-proactive*
*Context gathered: 2026-01-30*
