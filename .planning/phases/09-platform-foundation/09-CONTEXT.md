# Phase 9: Platform Foundation - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Reliable detection of environment capabilities and clear diagnostics. Users run klausbot on macOS, Linux, or WSL2 with identical behavior. Startup shows what's available and what's missing.

</domain>

<decisions>
## Implementation Decisions

### Startup Output Format
- Verbose checklist on startup showing all capabilities with pass/fail status
- Use color + symbols: green ✓ for pass, yellow ⚠ for degraded, red ✗ for fail
- Show ALL capabilities (not just enabled ones) — disabled features appear with status
- Summary line at the end: "Ready: X/Y features enabled"

### Degradation Messaging
- Separate hints section after checklist: "To enable more features:" with actionable guidance
- Severity depends on capability type:
  - **Required** (Telegram token, Claude Code) → Error, fail to start
  - **Core optional** → Warning (yellow ⚠)
  - **Nice-to-have** → Info (neutral)
- On missing required: Minimal error message + pointer to doctor command
  - Example: "Missing TELEGRAM_BOT_TOKEN. Run 'klausbot doctor' for help."

### Detection Granularity
- **Required capabilities:**
  - Claude Code (must be configured and accessible — subscription or API key, user's choice)
  - TELEGRAM_BOT_TOKEN
- **Platform detection:** macOS, Linux (treat WSL2 as Linux for now — research if special handling needed)
- **NOT detected:** Architecture (Intel/Apple Silicon), Node version (if running, it's installed), system resources
- **Optional features:** Currently none in active use (embeddings/VOYAGE_API_KEY for future)

### Config Validation
- **Hot reload:** Config changes apply without full restart (at minimum, on next message)
- **Separation of concerns:**
  - Env vars: Secrets only (TELEGRAM_BOT_TOKEN, API keys)
  - Config file (JSON): Non-secret settings (model choice, log verbosity, preferences)
- **Validation behavior:** Invalid JSON or unknown keys = fail to start
- **Explicit command:** `klausbot config validate` for pre-start validation (useful for CI/deployment)

### Claude's Discretion
- Exact checklist formatting/spacing
- How to detect Claude Code is configured (subprocess check, auth verification)
- Internal WSL2 detection for bug reports (surfaced as "Linux")
- Error message wording beyond the specified pattern

</decisions>

<specifics>
## Specific Ideas

- "As long as Node works, everything else should work" — Node presence is implicit (can't run without it)
- Claude Code authentication is the user's concern — we just verify it's accessible
- Config should be hot-reloadable to avoid restart friction

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-platform-foundation*
*Context gathered: 2026-01-31*
