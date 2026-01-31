# Requirements Archive: v1 MVP

**Archived:** 2026-01-31
**Status:** SHIPPED

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: klausbot

**Defined:** 2026-01-28
**Core Value:** 24/7 personal assistant that never forgets, never loses context, and self-improves through use.

## v1 Requirements

### Infrastructure

- [x] **INFRA-01**: Wrapper process runs 24/7, polls Telegram for new messages
- [x] **INFRA-02**: On message arrival, wrapper spawns Claude Code session with context
- [x] **INFRA-03**: Claude Code response sent back to user via Telegram
- [x] **INFRA-04**: Single-user security — only authorized Telegram chat ID can interact
- [x] **INFRA-05**: Graceful shutdown and restart without losing state

### Communication

- [x] **COMM-01**: User can send text messages and receive responses
- [x] **COMM-02**: Conversation context maintained within session
- [x] **COMM-03**: "Thinking..." indicator shown while processing
- [x] **COMM-04**: Errors surfaced transparently (never silent failures)
- [x] **COMM-05**: Voice messages transcribed and processed as text
- [x] **COMM-06**: Images analyzed and described/acted upon

### Memory

- [x] **MEM-01**: All conversations persisted to storage (SQLite or file)
- [x] **MEM-02**: Hybrid context model — identity files stuffed in context, history via agentic lookup
- [x] **MEM-03**: Session bootstrap includes: SOUL.md, IDENTITY.md, USER.md, latest message pointer, memory index
- [x] **MEM-04**: RLM-inspired retrieval — Claude queries conversation history agentic-ally (not fed full history)
- [x] **MEM-05**: Semantic retrieval — vector embeddings for relevant memory recall
- [x] **MEM-06**: User preferences extracted and stored in USER.md
- [x] **MEM-07**: Conversation history queryable by Claude during session

### Identity

- [x] **IDEN-01**: SOUL.md defines personality, values, boundaries
- [x] **IDEN-02**: IDENTITY.md defines surface attributes (name, vibe, emoji)
- [x] **IDEN-03**: USER.md stores info about user (preferences, context)
- [x] **IDEN-04**: Bootstrap flow — first interaction creates identity files through conversation
- [x] **IDEN-05**: Identity files consulted every session for consistent personality
- [x] **IDEN-06**: Claude can update identity files based on learnings

### Cron System

- [x] **CRON-01**: Cron tasks stored persistently (survive restarts)
- [x] **CRON-02**: Cron tasks execute at scheduled times by spawning Claude Code
- [x] **CRON-03**: User can create crons through natural conversation
- [x] **CRON-04**: User can list, modify, delete existing crons
- [x] **CRON-05**: Cron execution results sent to user via Telegram

### Skills System

- [x] **SKILL-01**: Skills are reusable capabilities stored in folder
- [x] **SKILL-02**: Claude selects appropriate skill based on task (partial — Claude Code native)
- [x] **SKILL-03**: Pre-installed skills included (skill-creator, etc.)
- [x] **SKILL-04**: Claude can create new skills proactively (partial — depends on Claude behavior)
- [x] **SKILL-05**: Skills use standard format (SKILL.md or similar)

### Self-Evolution

- [x] **EVOL-01**: LEARNINGS.md tracks mistakes and insights
- [x] **EVOL-02**: Claude consults learnings to avoid repeating mistakes
- [x] **EVOL-03**: Claude can modify own behavior based on feedback
- [x] **EVOL-04**: All self-modifications version controlled (git)
- [x] **EVOL-05**: Claude proactively suggests improvements (partial — no automation)

## v2 Requirements (Deferred)

### Advanced Memory

- **MEM-V2-01**: Memory pruning/archival for old conversations
- **MEM-V2-02**: Sensitive data classification and encryption
- **MEM-V2-03**: Explicit "forget this" command

### Multi-Platform

- **PLAT-01**: Calendar integration (Google Calendar)
- **PLAT-02**: Email integration
- **PLAT-03**: Task manager integration

### Advanced Proactive

- **CRON-V2-01**: Event-triggered tasks (not just time-based)
- **CRON-V2-02**: Chained tasks (task A triggers task B)

## Out of Scope

| Feature                     | Reason                                              |
| --------------------------- | --------------------------------------------------- |
| Multi-user support          | Personal assistant, single user only                |
| Web UI                      | Telegram is the interface                           |
| Mobile app                  | Telegram handles mobile                             |
| Sandbox/restrictions        | Runs in VM, fully autonomous by design              |
| Multi-agent routing         | Premature optimization; Claude Code handles routing |
| OAuth for external services | Deferred to v2                                      |

## Traceability

| Requirement | Phase     | Status   |
| ----------- | --------- | -------- |
| INFRA-01    | Phase 1   | Complete |
| INFRA-02    | Phase 1   | Complete |
| INFRA-03    | Phase 1   | Complete |
| INFRA-04    | Phase 1   | Complete |
| INFRA-05    | Phase 1   | Complete |
| COMM-01     | Phase 1   | Complete |
| COMM-02     | Phase 1   | Complete |
| COMM-03     | Phase 1   | Complete |
| COMM-04     | Phase 1   | Complete |
| COMM-05     | Phase 6   | Complete |
| COMM-06     | Phase 6   | Complete |
| MEM-01      | Phase 2   | Complete |
| MEM-02      | Phase 2   | Complete |
| MEM-03      | Phase 2   | Complete |
| MEM-04      | Phase 2   | Complete |
| MEM-05      | Phase 2   | Complete |
| MEM-06      | Phase 2   | Complete |
| MEM-07      | Phase 2   | Complete |
| IDEN-01     | Phase 3   | Complete |
| IDEN-02     | Phase 3   | Complete |
| IDEN-03     | Phase 3   | Complete |
| IDEN-04     | Phase 3   | Complete |
| IDEN-05     | Phase 3   | Complete |
| IDEN-06     | Phase 3   | Complete |
| CRON-01     | Phase 5   | Complete |
| CRON-02     | Phase 5   | Complete |
| CRON-03     | Phase 5   | Complete |
| CRON-04     | Phase 5   | Complete |
| CRON-05     | Phase 5   | Complete |
| SKILL-01    | Phase 4   | Complete |
| SKILL-02    | Phase 4   | Partial  |
| SKILL-03    | Phase 4   | Complete |
| SKILL-04    | Phase 4   | Partial  |
| SKILL-05    | Phase 4   | Complete |
| EVOL-01     | Phase 5   | Complete |
| EVOL-02     | Phase 5   | Complete |
| EVOL-03     | Phase 5   | Complete |
| EVOL-04     | Phase 1   | Complete |
| EVOL-05     | Phase 5   | Partial  |

**Coverage:**

- v1 requirements: 35 total
- Complete: 32
- Partial: 3 (behavioral, depend on Claude Code native capabilities)

---

## Milestone Summary

**Shipped:** 32 of 35 v1 requirements (3 partial)

**Partial requirements (accepted as tech debt):**

- SKILL-02: Skill selection depends on Claude Code Skill tool
- SKILL-04: Proactive skill creation depends on Claude behavior
- EVOL-05: Proactive suggestions rely on Claude inference, no automation

**Adjusted during implementation:**

- MEM-01: Changed from file to SQLite storage
- MEM-05: Embeddings migrated from JSON to SQLite with sqlite-vec

**Dropped:** None

---

_Archived: 2026-01-31 as part of v1 milestone completion_
