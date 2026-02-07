# Roadmap: klausbot

## Milestones

- **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- **v1.1 Production Ready** - Phases 9-14 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-8) - SHIPPED 2026-01-31</summary>

See archived roadmap: `.planning/milestones/v1-ROADMAP.md`

Summary:

- 12 phases total (including decimal phases 1.1, 3.1, 4.1, 6.1)
- 46 plans completed
- 7,359 LOC delivered
- Features: Gateway, spawner, memory, identity, cron, skills, evolution

</details>

### v1.1 Production Ready (In Progress)

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
   **Plans**: 2 plans

Plans:

- [x] 10-01-PLAN.md - Streaming infrastructure (config, throttler, Claude stream spawner)
- [x] 10-02-PLAN.md - Gateway integration and Telegram draft streaming

#### Phase 11: Telegram Threading

**Goal**: Conversations stay organized in threads
**Depends on**: Phase 10
**Requirements**: TELE-01, TELE-02
**Success Criteria** (what must be TRUE):

1. Bot respects message_thread_id for threaded conversations
2. Replies are properly threaded to maintain conversation context
   **Plans**: 1 plan

Plans:

- [x] 11-01-PLAN.md - Thread context extraction and reply linking

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
   **Plans**: 3 plans

Plans:

- [x] 12-01-PLAN.md - Heartbeat core (config, scheduler, executor with HEARTBEAT_OK suppression)
- [x] 12-02-PLAN.md - Gateway integration (start/stop lifecycle)
- [x] 12-03-PLAN.md - Note collection (trigger phrase detection, conversation integration)

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

- [x] 13-01-PLAN.md - Documentation files (LICENSE, .env.example, README.md)
- [x] 13-02-PLAN.md - User review checkpoint (fill story, add screenshots)

#### Phase 13.1: Dockerfile Dependencies (INSERTED)

**Goal**: Dockerfile includes Python and other runtime dependencies
**Depends on**: Phase 13 (Docker & Release)
**Success Criteria** (what must be TRUE):

1. Dockerfile includes Python 3 + pip
2. Dockerfile includes uv (fast Python package manager)
3. Dockerfile includes pnpm via corepack
4. Dockerfile includes agent tools (poppler, ffmpeg, ripgrep, jq, imagemagick, pandoc)
   **Plans**: 1 plan (direct execution)

Plans:

- [x] Direct execution — added apt packages, uv, pnpm to Dockerfile

#### Phase 13.2: Subagent Orchestration (INSERTED)

**Goal**: Claude can spawn and coordinate background Claude agents for parallel work
**Depends on**: Phase 13.1 (Dockerfile Dependencies)
**Success Criteria** (what must be TRUE):

1. Claude can spawn background Claude processes for delegated work
2. Agent-to-agent communication channel exists
3. Context sharing mechanism between parent and child agents
4. Parent agent can track and collect results from child agents
   **Plans**: 1 plan

Plans:

- [x] 13.2-01-PLAN.md — Enable Task tool in spawner, orchestration instructions, config integration

#### Phase 13.3: Infinite Conversation Context (INSERTED)

**Goal**: Eliminate multi-turn context loss by injecting timestamped conversation history into every session with thread detection and retrieval-first instructions
**Depends on**: Phase 13.2 (Subagent Orchestration)
**Success Criteria** (what must be TRUE):

1. Active conversation thread detected by time proximity and full transcript injected
2. Conversation history injected with XML tags, timestamps, and relative time labels (today/yesterday/older)
3. Tiered injection: full transcripts for recent, summaries for older, within 30K token budget
4. Retrieval instructions rewritten to enforce "search first, never say I don't remember"
5. Claude knows it's in a continuation vs new conversation
   **Plans**: 2 plans

Plans:

- [x] 13.3-01-PLAN.md — Conversation context engine (query layer, thread detection, tiered formatting, retrieval rewrite)
- [x] 13.3-02-PLAN.md — Gateway integration and hook simplification

#### Phase 14: Testing Framework

**Goal**: Unit tests for deterministic logic + LLM evals for behavioral quality ensure "tests pass = app works" confidence
**Depends on**: Phase 13 (all features and docs complete)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):

1. Unit tests exist for core modules (cron, utils, config, queue, memory, context)
2. Evalite eval suite covers LLM behavior (system prompt personality, heartbeat, cron output quality)
3. Test coverage gives confidence that passing tests = working app
   **Plans**: 4 plans

Plans:

- [ ] 14-01-PLAN.md — Test infrastructure (Vitest config, helpers, npm scripts)
- [ ] 14-02-PLAN.md — Unit tests: pure logic (cron/parse, cron/schedule, utils/split, utils/telegram-html, config/schema)
- [ ] 14-03-PLAN.md — Unit tests: stateful modules (daemon/queue, daemon/spawner, daemon/gateway, memory/conversations, memory/context)
- [ ] 14-04-PLAN.md — Evalite eval suite (system prompt, heartbeat, cron LLM behavior evals)

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12 -> 13 -> 13.1 -> 13.2 -> 13.3 -> 14

| Phase                  | Milestone | Plans Complete | Status      | Completed  |
| ---------------------- | --------- | -------------- | ----------- | ---------- |
| 9. Platform Foundation | v1.1      | 3/3            | Complete    | 2026-01-31 |
| 10. Telegram Streaming | v1.1      | 2/2            | Complete    | 2026-02-05 |
| 11. Telegram Threading | v1.1      | 1/1            | Complete    | 2026-02-05 |
| 12. Heartbeat System   | v1.1      | 3/3            | Complete    | 2026-02-05 |
| 13. Docker & Release   | v1.1      | 2/2            | Complete    | 2026-02-05 |
| 13.1 Dockerfile Deps   | v1.1      | 1/1            | Complete    | 2026-02-05 |
| 13.2 Subagent Orch     | v1.1      | 1/1            | Complete    | 2026-02-05 |
| 13.3 Infinite Context  | v1.1      | 2/2            | Complete    | 2026-02-06 |
| 14. Testing Framework  | v1.1      | 0/4            | Planned     | -          |

---

_Roadmap created: 2026-01-31_
_v1.1 milestone: 6 phases, 16 plans (after removing Doctor/Setup/Service phases)_
