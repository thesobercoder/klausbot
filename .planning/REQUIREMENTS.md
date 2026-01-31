# Requirements: klausbot

**Defined:** 2026-01-31
**Core Value:** 24/7 personal assistant that never forgets, never loses context, and self-improves through use

## v1.1 Requirements

Requirements for v1.1 Production Ready release.

### Setup

- [ ] **SETUP-01**: `onboard` command launches interactive wizard for first-time setup
- [ ] **SETUP-02**: Wizard creates JSON config file with model and preferences
- [ ] **SETUP-03**: Pairing code stored encrypted in SQLite (not plaintext)
- [ ] **SETUP-04**: Gateway refuses to start if setup not complete (clear error message)
- [ ] **SETUP-05**: Config follows 12-factor (reads from env vars, never prompts for secrets)

### Service

- [ ] **SERV-01**: `service install` command registers daemon with system service manager
- [ ] **SERV-02**: `service uninstall` command removes daemon from service manager
- [ ] **SERV-03**: `service status` command shows daemon state
- [ ] **SERV-04**: launchd support on macOS (plist in ~/Library/LaunchAgents)
- [ ] **SERV-05**: systemd support on Linux/WSL2 (user unit file)

### Streaming

- [ ] **STRM-01**: Telegram draft streaming via `sendMessageDraft` API
- [ ] **STRM-02**: Streaming updates throttled to avoid API rate limits
- [ ] **STRM-03**: Final message sent as normal message after streaming completes
- [ ] **STRM-04**: Streaming configurable (can be disabled)

### Telegram

- [ ] **TELE-01**: Thread support for single conversation (message_thread_id)
- [ ] **TELE-02**: Replies properly threaded to maintain conversation context

### Security

- [ ] **SECU-01**: User prompts sanitized before passing to Claude
- [ ] **SECU-02**: Input validation prevents injection attacks
- [ ] **SECU-03**: Sensitive data (pairing codes, tokens) never logged in plaintext

### Platform

- [ ] **PLAT-01**: Works on macOS (Intel and Apple Silicon)
- [ ] **PLAT-02**: Works on Linux (Ubuntu/Debian, Fedora/RHEL)
- [ ] **PLAT-03**: Works on Windows via WSL2
- [ ] **PLAT-04**: Docker support (single container, identical behavior)
- [ ] **PLAT-05**: execPath detection for self-executable identification
- [ ] **PLAT-06**: Identical behavior across all supported platforms

### Detection

- [ ] **DTCT-01**: Detect Claude Code login status at startup
- [ ] **DTCT-02**: Detect `OPENAI_API_KEY` availability for embeddings
- [ ] **DTCT-03**: Graceful degradation (disable `search_memory` if no embeddings API)
- [ ] **DTCT-04**: Clear messaging when features disabled due to missing env vars
- [ ] **DTCT-05**: 12-factor compliance (all config from env vars)

### Doctor

- [ ] **DOCT-01**: `doctor` command performs full prerequisite check
- [ ] **DOCT-02**: Check required env vars present
- [ ] **DOCT-03**: Check Node.js version meets requirements
- [ ] **DOCT-04**: Check disk space sufficient
- [ ] **DOCT-05**: Check network connectivity
- [ ] **DOCT-06**: Check Telegram bot token valid
- [ ] **DOCT-07**: Check Claude Code accessible
- [ ] **DOCT-08**: Clear pass/fail output with remediation hints

### Heartbeat

- [ ] **HRTB-01**: HEARTBEAT.md file support in workspace
- [ ] **HRTB-02**: Periodic heartbeat check (30m default, configurable)
- [ ] **HRTB-03**: `HEARTBEAT_OK` response contract (suppresses if nothing to report)
- [ ] **HRTB-04**: User can save notes to HEARTBEAT.md via conversation ("remember to check X")
- [ ] **HRTB-05**: Heartbeat distinct from cron (awareness vs scheduled tasks)
- [ ] **HRTB-06**: Heartbeat configurable (interval, enabled/disabled)

### Testing

- [ ] **TEST-01**: Unit tests for core modules (gateway, spawner, memory, cron)
- [ ] **TEST-02**: E2E tests for critical flows (onboard, message handling, cron execution)
- [ ] **TEST-03**: Test coverage ensures "tests pass = app works" confidence
- [ ] **TEST-04**: CI/CD pipeline runs tests on push

### Release

- [ ] **RLSE-01**: README with step-by-step installation guide
- [ ] **RLSE-02**: README includes "Why I built it" section
- [ ] **RLSE-03**: Complete documentation for all commands
- [ ] **RLSE-04**: Configuration reference documentation
- [ ] **RLSE-05**: Troubleshooting guide

## Future Requirements

Deferred to later milestones.

### v2 Candidates

- Multi-platform integration (calendar, email, task managers via OAuth)
- Multi-agent routing (specialized agents for different tasks)
- Native Windows support (without WSL2)
- Voice call support (real-time audio)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-user support | Personal assistant, single user only |
| Web UI | Telegram is the interface |
| Native Windows service | WSL2 provides better compatibility (OpenClaw pattern) |
| Mobile app | Telegram handles mobile access |
| OAuth for external services | Deferred to v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | TBD | Pending |
| SETUP-02 | TBD | Pending |
| SETUP-03 | TBD | Pending |
| SETUP-04 | TBD | Pending |
| SETUP-05 | TBD | Pending |
| SERV-01 | TBD | Pending |
| SERV-02 | TBD | Pending |
| SERV-03 | TBD | Pending |
| SERV-04 | TBD | Pending |
| SERV-05 | TBD | Pending |
| STRM-01 | TBD | Pending |
| STRM-02 | TBD | Pending |
| STRM-03 | TBD | Pending |
| STRM-04 | TBD | Pending |
| TELE-01 | TBD | Pending |
| TELE-02 | TBD | Pending |
| SECU-01 | TBD | Pending |
| SECU-02 | TBD | Pending |
| SECU-03 | TBD | Pending |
| PLAT-01 | TBD | Pending |
| PLAT-02 | TBD | Pending |
| PLAT-03 | TBD | Pending |
| PLAT-04 | TBD | Pending |
| PLAT-05 | TBD | Pending |
| PLAT-06 | TBD | Pending |
| DTCT-01 | TBD | Pending |
| DTCT-02 | TBD | Pending |
| DTCT-03 | TBD | Pending |
| DTCT-04 | TBD | Pending |
| DTCT-05 | TBD | Pending |
| DOCT-01 | TBD | Pending |
| DOCT-02 | TBD | Pending |
| DOCT-03 | TBD | Pending |
| DOCT-04 | TBD | Pending |
| DOCT-05 | TBD | Pending |
| DOCT-06 | TBD | Pending |
| DOCT-07 | TBD | Pending |
| DOCT-08 | TBD | Pending |
| HRTB-01 | TBD | Pending |
| HRTB-02 | TBD | Pending |
| HRTB-03 | TBD | Pending |
| HRTB-04 | TBD | Pending |
| HRTB-05 | TBD | Pending |
| HRTB-06 | TBD | Pending |
| TEST-01 | TBD | Pending |
| TEST-02 | TBD | Pending |
| TEST-03 | TBD | Pending |
| TEST-04 | TBD | Pending |
| RLSE-01 | TBD | Pending |
| RLSE-02 | TBD | Pending |
| RLSE-03 | TBD | Pending |
| RLSE-04 | TBD | Pending |
| RLSE-05 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 49 total
- Mapped to phases: 0
- Unmapped: 49

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 after initial definition*
