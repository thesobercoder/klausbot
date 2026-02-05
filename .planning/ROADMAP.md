# Roadmap: klausbot

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- 🚧 **v1.1 Production Ready** - Phases 9-14 (in progress)

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

#### Phase 10: Telegram Streaming

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

- [ ] 10-01: Telegram draft streaming
- [ ] 10-02: Throttling and finalization

#### Phase 11: Telegram Threading

**Goal**: Conversations stay organized in threads
**Depends on**: Phase 10
**Requirements**: TELE-01, TELE-02
**Success Criteria** (what must be TRUE):

1. Bot respects message_thread_id for threaded conversations
2. Replies are properly threaded to maintain conversation context
   **Plans**: TBD

Plans:

- [ ] 11-01: Thread support implementation

#### Phase 12: Heartbeat System

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

- [ ] 12-01: HEARTBEAT.md file support
- [ ] 12-02: Periodic heartbeat scheduler
- [ ] 12-03: User note saving

#### Phase 13: Docker & Release

**Goal**: klausbot is documented for easy deployment
**Depends on**: Phase 12 (all features implemented)
**Requirements**: PLAT-04, RLSE-01, RLSE-02, RLSE-03, RLSE-04, RLSE-05
**Success Criteria** (what must be TRUE):

1. README includes step-by-step installation guide
2. README includes "Why I built it" section
3. All commands are documented
4. Configuration reference and troubleshooting guide exist
5. Dockerfile installs Claude Code CLI
   **Plans**: 2 plans

Plans:

- [x] 13-01-PLAN.md — Documentation files (LICENSE, .env.example, README.md)
- [x] 13-02-PLAN.md — User review checkpoint (fill story, add screenshots)

#### Phase 14: Testing Framework

**Goal**: Comprehensive tests ensure "tests pass = app works" confidence
**Depends on**: Phase 13 (all features and docs complete)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):

1. Unit tests exist for core modules (gateway, spawner, memory, cron)
2. E2E tests cover critical flows (onboard, message handling, cron execution)
3. Test coverage gives confidence that passing tests = working app
4. CI/CD pipeline runs tests on push
   **Plans**: TBD

Plans:

- [ ] 14-01: Test infrastructure setup
- [ ] 14-02: Unit test suite
- [ ] 14-03: E2E test suite
- [ ] 14-04: CI/CD integration

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12 → 13 → 14

| Phase                  | Milestone | Plans Complete | Status      | Completed  |
| ---------------------- | --------- | -------------- | ----------- | ---------- |
| 9. Platform Foundation | v1.1      | 3/3            | ✓ Complete  | 2026-01-31 |
| 10. Telegram Streaming | v1.1      | 0/2            | Not started | -          |
| 11. Telegram Threading | v1.1      | 0/1            | Not started | -          |
| 12. Heartbeat System   | v1.1      | 0/3            | Not started | -          |
| 13. Docker & Release   | v1.1      | 2/2            | ✓ Complete  | 2026-02-05 |
| 14. Testing Framework  | v1.1      | 0/4            | Not started | -          |

---

_Roadmap created: 2026-01-31_
_v1.1 milestone: 6 phases, 15 plans (after removing Doctor/Setup/Service phases)_
