# Roadmap: klausbot

## Overview

Build a self-evolving personal assistant that communicates via Telegram, backed by Claude Code running in a VM. The journey: establish secure infrastructure with budget controls, validate the stateless session + file-based state pattern, build persistent identity, add extensible skills, enable proactive autonomous operations, then add multimodal inputs. Each phase delivers observable capability; security and safety boundaries established before any autonomous operation.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Gateway daemon with Telegram integration and security boundaries
- [ ] **Phase 2: Core Loop** - Claude Code integration with stateless sessions and file-based memory
- [ ] **Phase 3: Identity** - Bootstrap flow and persistent personality system
- [ ] **Phase 4: Skills** - Extensible capabilities system with skill isolation
- [ ] **Phase 5: Proactive** - Cron scheduling and self-evolution system
- [ ] **Phase 6: Multimodal** - Voice transcription and image analysis

## Phase Details

### Phase 1: Foundation

**Goal**: Gateway daemon (klausbot) runs 24/7, handles Telegram messages, enforces security via moltbot-style pairing, persists queue across restarts
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, COMM-01, COMM-02, COMM-03, COMM-04, EVOL-04
**Success Criteria** (what must be TRUE):

1. User sends message to Telegram bot, receives acknowledgment within 5 seconds
2. Unauthorized chat IDs are rejected with clear error (no silent ignore)
3. Processing indicator ("Thinking...") appears while Claude executes
4. Errors surfaced to user with actionable context (never silent failures)
5. Gateway survives restart without losing pending messages
   **Plans**: 7 plans in 6 waves

Plans:

- [ ] 01-01-PLAN.md — Project setup: npm, TypeScript, config, logger
- [ ] 01-02-PLAN.md — Telegram bot core with grammY plugins
- [ ] 01-03-PLAN.md — Message queue and Claude Code spawner
- [ ] 01-04-PLAN.md — Pairing flow and security middleware
- [ ] 01-05-PLAN.md — Gateway integration: wire all components
- [ ] 01-06-PLAN.md — Deployment: install wizard, systemd, Docker
- [ ] 01-07-PLAN.md — End-to-end verification (human checkpoint)

### Phase 2: Core Loop

**Goal**: User message triggers Claude Code session that reads/writes memory files and returns response
**Depends on**: Phase 1
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06, MEM-07
**Success Criteria** (what must be TRUE):

1. User asks "what did we discuss yesterday?" and Claude retrieves relevant conversation via agentic file reading
2. All conversations persisted to storage (queryable later)
3. Claude's response reflects context from identity files (SOUL.md, IDENTITY.md, USER.md)
4. User preferences stated in conversation appear in USER.md within same session
5. Semantic search returns relevant memories when queried about past topics
   **Plans**: TBD

Plans:

- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Identity

**Goal**: Bot has persistent personality that survives sessions and evolves through bootstrap flow
**Depends on**: Phase 2
**Requirements**: IDEN-01, IDEN-02, IDEN-03, IDEN-04, IDEN-05, IDEN-06
**Success Criteria** (what must be TRUE):

1. First interaction triggers bootstrap conversation that creates SOUL.md, IDENTITY.md, USER.md
2. Bot's personality (name, vibe, emoji) remains consistent across sessions
3. Bot refers to user preferences learned in previous sessions
4. User can ask bot to update its identity and see changes persist
5. Personality boundaries defined in SOUL.md are respected (refuses out-of-bounds requests)
   **Plans**: TBD

Plans:

- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Skills

**Goal**: Claude selects and executes reusable skills from folder, can create new skills proactively
**Depends on**: Phase 3
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05
**Success Criteria** (what must be TRUE):

1. User requests task, Claude selects appropriate skill from available options
2. Pre-installed skills (skill-creator, etc.) work out of the box
3. Claude suggests "should I create a skill for this?" after recognizing repeated patterns
4. User approves skill creation, skill persists in folder and works in future sessions
5. Skills use standard format (SKILL.md or similar) readable by both human and Claude
   **Plans**: TBD

Plans:

- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Proactive

**Goal**: Bot executes scheduled tasks autonomously and improves itself based on learnings
**Depends on**: Phase 4
**Requirements**: CRON-01, CRON-02, CRON-03, CRON-04, CRON-05, EVOL-01, EVOL-02, EVOL-03, EVOL-05
**Success Criteria** (what must be TRUE):

1. User says "remind me every morning at 9am about X" and cron executes reliably
2. User can list, modify, delete existing crons through natural conversation
3. Cron execution results sent to user via Telegram (success and failure)
4. LEARNINGS.md contains mistakes and insights from past sessions
5. Bot avoids repeating documented mistakes (consults LEARNINGS.md)
6. Bot proactively suggests improvements based on usage patterns
   **Plans**: TBD

Plans:

- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Multimodal

**Goal**: Bot processes voice messages and images as naturally as text
**Depends on**: Phase 2 (can parallelize after Phase 2)
**Requirements**: COMM-05, COMM-06
**Success Criteria** (what must be TRUE):

1. User sends voice message, bot transcribes and responds to content
2. User sends image, bot analyzes and describes/acts on content
3. Voice/image processing errors surfaced clearly (codec issues, API failures)
   **Plans**: TBD

Plans:

- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
(Phase 6 can parallelize with Phase 3-5 if prioritized)

| Phase         | Plans Complete | Status      | Completed |
| ------------- | -------------- | ----------- | --------- |
| 1. Foundation | 0/7            | Planned     | -         |
| 2. Core Loop  | 0/TBD          | Not started | -         |
| 3. Identity   | 0/TBD          | Not started | -         |
| 4. Skills     | 0/TBD          | Not started | -         |
| 5. Proactive  | 0/TBD          | Not started | -         |
| 6. Multimodal | 0/TBD          | Not started | -         |

---

_Roadmap created: 2026-01-28_
_Last updated: 2026-01-28_
