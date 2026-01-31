# Roadmap: klausbot

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- 🚧 **v1.1 Production Ready** - Phases 9-17 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-8) - SHIPPED 2026-01-31</summary>

See archived roadmap: `.planning/milestones/v1-ROADMAP.md`

Summary:
- 12 phases total (including decimal phases 1.1, 3.1, 4.1, 6.1)
- 46 plans completed
- 7,359 LOC delivered
- Features: Gateway, spawner, memory, identity, cron, skills, evolution

</details>

### 🚧 v1.1 Production Ready (In Progress)

**Milestone Goal:** Polish klausbot for release with proper setup, cross-platform support, streaming, and comprehensive testing.

**Phase Numbering:**
- Integer phases (9, 10, 11...): Planned milestone work
- Decimal phases (9.1, 9.2): Urgent insertions (marked with INSERTED)

#### Phase 9: Platform Foundation
**Goal**: Reliable detection of environment capabilities and clear diagnostics
**Depends on**: v1.0 complete
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-05, PLAT-06, DTCT-01, DTCT-02, DTCT-03, DTCT-04, DTCT-05
**Success Criteria** (what must be TRUE):
  1. User can run klausbot on macOS (Intel/Apple Silicon), Linux, or WSL2 with identical behavior
  2. User sees clear startup message indicating which features are available (embeddings, Claude Code)
  3. User sees clear message when a feature is disabled due to missing env vars
  4. App reads all config from environment variables (12-factor compliant)
  5. execPath correctly identifies the running binary location across platforms
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md - Platform detection module (Wave 1)
- [x] 09-02-PLAN.md - Environment capability detection (Wave 2)
- [x] 09-03-PLAN.md - Graceful degradation framework (Wave 2)

#### Phase 10: Doctor Command
**Goal**: Users can diagnose setup issues before running the bot
**Depends on**: Phase 9
**Requirements**: DOCT-01, DOCT-02, DOCT-03, DOCT-04, DOCT-05, DOCT-06, DOCT-07, DOCT-08
**Success Criteria** (what must be TRUE):
  1. User runs `klausbot doctor` and sees pass/fail for all prerequisites
  2. Each failed check includes a remediation hint (what to do)
  3. Doctor checks: env vars, Node version, disk space, network, Telegram token, Claude Code
  4. Output is clearly formatted with visual pass/fail indicators
**Plans**: TBD

Plans:
- [ ] 10-01: Doctor command framework
- [ ] 10-02: Individual health checks

#### Phase 11: Setup & Onboarding
**Goal**: First-time users can configure klausbot through a guided wizard
**Depends on**: Phase 10
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05
**Success Criteria** (what must be TRUE):
  1. User runs `klausbot onboard` and completes interactive setup wizard
  2. Wizard creates JSON config file with selected model and preferences
  3. Pairing code is stored encrypted in SQLite (not plaintext in config)
  4. Gateway refuses to start if setup incomplete, showing clear error message
  5. Setup never prompts for secrets (reads from env vars per 12-factor)
**Plans**: TBD

Plans:
- [ ] 11-01: Onboard wizard command
- [ ] 11-02: Config file management
- [ ] 11-03: Encrypted pairing storage

#### Phase 12: Service Management
**Goal**: Users can install klausbot as a system service that starts automatically
**Depends on**: Phase 11
**Requirements**: SERV-01, SERV-02, SERV-03, SERV-04, SERV-05
**Success Criteria** (what must be TRUE):
  1. User runs `klausbot service install` and daemon is registered with OS
  2. User runs `klausbot service uninstall` and daemon is removed
  3. User runs `klausbot service status` and sees daemon state
  4. On macOS: plist installed to ~/Library/LaunchAgents
  5. On Linux/WSL2: systemd user unit installed
**Plans**: TBD

Plans:
- [ ] 12-01: Service management CLI
- [ ] 12-02: launchd support (macOS)
- [ ] 12-03: systemd support (Linux)

#### Phase 13: Security Hardening
**Goal**: User input is safely processed and sensitive data is protected
**Depends on**: Phase 11 (needs encrypted storage)
**Requirements**: SECU-01, SECU-02, SECU-03
**Success Criteria** (what must be TRUE):
  1. User prompts are sanitized before passing to Claude (injection prevention)
  2. Input validation rejects malformed/malicious input with clear errors
  3. Sensitive data (pairing codes, tokens) never appears in logs
**Plans**: TBD

Plans:
- [ ] 13-01: Prompt sanitization
- [ ] 13-02: Input validation framework
- [ ] 13-03: Sensitive data log scrubbing

#### Phase 14: Telegram Streaming
**Goal**: Users see real-time response generation in Telegram
**Depends on**: Phase 9 (platform foundation)
**Requirements**: STRM-01, STRM-02, STRM-03, STRM-04
**Success Criteria** (what must be TRUE):
  1. User sees draft message updating as Claude generates response
  2. Draft updates are throttled to avoid Telegram API rate limits
  3. Final message replaces draft when streaming completes
  4. Streaming can be disabled via config
**Plans**: TBD

Plans:
- [ ] 14-01: Telegram draft streaming
- [ ] 14-02: Throttling and finalization

#### Phase 15: Telegram Threading
**Goal**: Conversations stay organized in threads
**Depends on**: Phase 14
**Requirements**: TELE-01, TELE-02
**Success Criteria** (what must be TRUE):
  1. Bot respects message_thread_id for threaded conversations
  2. Replies are properly threaded to maintain conversation context
**Plans**: TBD

Plans:
- [ ] 15-01: Thread support implementation

#### Phase 16: Heartbeat System
**Goal**: klausbot periodically checks in and can be reminded of things
**Depends on**: Phase 9 (platform foundation)
**Requirements**: HRTB-01, HRTB-02, HRTB-03, HRTB-04, HRTB-05, HRTB-06
**Success Criteria** (what must be TRUE):
  1. HEARTBEAT.md file in workspace is checked periodically (30m default)
  2. Bot responds with HEARTBEAT_OK if nothing to report (suppresses message)
  3. User can say "remember to check X" and it's saved to HEARTBEAT.md
  4. Heartbeat is distinct from cron (awareness check vs scheduled tasks)
  5. Heartbeat interval and enabled state are configurable
**Plans**: TBD

Plans:
- [ ] 16-01: HEARTBEAT.md file support
- [ ] 16-02: Periodic heartbeat scheduler
- [ ] 16-03: User note saving

#### Phase 17: Docker & Release
**Goal**: klausbot is documented and containerized for easy deployment
**Depends on**: Phase 16 (all features implemented)
**Requirements**: PLAT-04, RLSE-01, RLSE-02, RLSE-03, RLSE-04, RLSE-05
**Success Criteria** (what must be TRUE):
  1. Docker container runs klausbot with identical behavior to native
  2. README includes step-by-step installation guide
  3. README includes "Why I built it" section
  4. All commands are documented
  5. Configuration reference and troubleshooting guide exist
**Plans**: TBD

Plans:
- [ ] 17-01: Docker containerization
- [ ] 17-02: README and installation guide
- [ ] 17-03: Command and config documentation
- [ ] 17-04: Troubleshooting guide

#### Phase 18: Testing Framework
**Goal**: Comprehensive tests ensure "tests pass = app works" confidence
**Depends on**: Phase 17 (all features and docs complete)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Unit tests exist for core modules (gateway, spawner, memory, cron)
  2. E2E tests cover critical flows (onboard, message handling, cron execution)
  3. Test coverage gives confidence that passing tests = working app
  4. CI/CD pipeline runs tests on push
**Plans**: TBD

Plans:
- [ ] 18-01: Test infrastructure setup
- [ ] 18-02: Unit test suite
- [ ] 18-03: E2E test suite
- [ ] 18-04: CI/CD integration

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 9. Platform Foundation | v1.1 | 3/3 | ✓ Complete | 2026-01-31 |
| 10. Doctor Command | v1.1 | 0/2 | Not started | - |
| 11. Setup & Onboarding | v1.1 | 0/3 | Not started | - |
| 12. Service Management | v1.1 | 0/3 | Not started | - |
| 13. Security Hardening | v1.1 | 0/3 | Not started | - |
| 14. Telegram Streaming | v1.1 | 0/2 | Not started | - |
| 15. Telegram Threading | v1.1 | 0/1 | Not started | - |
| 16. Heartbeat System | v1.1 | 0/3 | Not started | - |
| 17. Docker & Release | v1.1 | 0/4 | Not started | - |
| 18. Testing Framework | v1.1 | 0/4 | Not started | - |

---
*Roadmap created: 2026-01-31*
*v1.1 milestone: 10 phases, 28 plans, 49 requirements*
