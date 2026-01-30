# Roadmap: klausbot

## Overview

Build a self-evolving personal assistant that communicates via Telegram, backed by Claude Code running in a VM. The journey: establish secure infrastructure with budget controls, validate the stateless session + file-based state pattern, build persistent identity, add extensible skills, enable proactive autonomous operations, then add multimodal inputs. Each phase delivers observable capability; security and safety boundaries established before any autonomous operation.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Gateway daemon with Telegram integration and security boundaries
- [x] **Phase 2: Core Loop** - Claude Code integration with stateless sessions and file-based memory
- [x] **Phase 3: Identity** - Bootstrap flow and persistent personality system
- [x] **Phase 4: Skills** - Extensible capabilities system with skill isolation
- [x] **Phase 4.1: Skills Polish** - Skill registry and system prompt enhancements (INSERTED)
- [ ] **Phase 5: Proactive** - Cron scheduling and self-evolution system
- [x] **Phase 5.1: MCP Cron Tools** - Typed MCP tools for cron management via CLI spawner (INSERTED)
- [x] **Phase 6: Multimodal** - Voice transcription and image analysis
- [x] **Phase 7: Resilience & Tooling** - Timeout recovery, skills cleanup, agent authoring
- [ ] **Phase 7.1: Memory Search MCP** - Migrate embeddings to SQLite, add search_memories MCP tool (INSERTED)
- [ ] **Phase 8: CLI Theme System** - Consistent output formatting with helper methods and unified color scheme

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

- [x] 01-01-PLAN.md — Project setup: npm, TypeScript, config, logger
- [x] 01-02-PLAN.md — Telegram bot core with grammY plugins
- [x] 01-03-PLAN.md — Message queue and Claude Code spawner
- [x] 01-04-PLAN.md — Pairing flow and security middleware
- [x] 01-05-PLAN.md — Gateway integration: wire all components
- [x] 01-06-PLAN.md — Deployment: install wizard, systemd, Docker
- [x] 01-07-PLAN.md — End-to-end verification (human checkpoint)

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
   **Plans**: 5 plans in 5 waves

Plans:

- [x] 02-01-PLAN.md — Memory foundation: data home, identity files, conversation logger
- [x] 02-02-PLAN.md — Context-aware spawner: system prompt builder, cwd injection
- [x] 02-03-PLAN.md — Integration: gateway wiring, CLI init subcommand
- [x] 02-04-PLAN.md — End-to-end verification (human checkpoint)
- [x] 02-05-PLAN.md — Gap closure: semantic search with vector embeddings (MEM-05)

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
   **Plans**: 3 plans in 3 waves

Plans:

- [x] 03-01-PLAN.md — Bootstrap foundation: detector, prompts, cache invalidation
- [x] 03-02-PLAN.md — Gateway integration: routing, identity update instructions
- [x] 03-03-PLAN.md — End-to-end verification (human checkpoint)

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
**Plans**: 3 plans in 2 waves

Plans:

- [x] 04-01-PLAN.md — Telegram skill command registration
- [x] 04-02-PLAN.md — CLI skills installer and skill-creator auto-install
- [x] 04-03-PLAN.md — End-to-end verification (human checkpoint)

### Phase 4.1: Skills Polish (INSERTED)

**Goal**: Address skill system gaps identified during Phase 4 UAT
**Depends on**: Phase 4
**Requirements**: None (UAT-derived enhancements)
**Success Criteria** (what must be TRUE):

1. System prompt includes reminder that skills must be created in global `~/.claude/skills/` folder
2. CLI `klausbot skills` shows option to browse/install from skill registry
**Plans**: 2 plans in 1 wave

Plans:

- [x] 04.1-01-PLAN.md — System prompt skill folder reminder
- [x] 04.1-02-PLAN.md — Interactive browse command with type-to-filter

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
**Plans**: 5 plans in 4 waves

Plans:

- [ ] 05-01-PLAN.md — Cron foundation: types, store, schedule parsing
- [ ] 05-02-PLAN.md — Cron execution: executor, service, scheduler loop
- [ ] 05-03-PLAN.md — Cron integration: gateway lifecycle, /crons command
- [ ] 05-04-PLAN.md — Learning system: LEARNINGS.md, system prompt instructions
- [ ] 05-05-PLAN.md — End-to-end verification (human checkpoint)

### Phase 5.1: MCP Cron Tools (INSERTED)

**Goal**: Expose cron operations as typed MCP tools instead of CLI instructions in system prompt
**Depends on**: Phase 5
**Requirements**: None (UX improvement - typed tools > string parsing)
**Success Criteria** (what must be TRUE):

1. Claude calls `mcp__klausbot__create_cron` with typed parameters (no CLI string construction)
2. Claude calls `mcp__klausbot__list_crons`, `mcp__klausbot__delete_cron` for cron management
3. MCP server runs via stdio transport, config passed via `--mcp-config` CLI flag
4. Existing functionality preserved (identity, memory, skills all still work)
5. Cron CLI instructions removed from system prompt (tools replace them)
**Plans**: 2 plans in 2 waves

Note: Originally planned as ACP streaming with Agent SDK. Pivoted to CLI spawner + MCP after Agent SDK `query()` hung indefinitely.

Plans:

- [x] 05.1-01-PLAN.md — Standalone MCP server with cron tools (stdio transport)
- [x] 05.1-02-PLAN.md — Spawner integration and end-to-end verification

### Phase 6: Multimodal

**Goal**: Bot processes voice messages and images as naturally as text
**Depends on**: Phase 2 (can parallelize after Phase 2)
**Requirements**: COMM-05, COMM-06
**Success Criteria** (what must be TRUE):

1. User sends voice message, bot transcribes and responds to content
2. User sends image, bot analyzes and describes/acts on content
3. Voice/image processing errors surfaced clearly (codec issues, API failures)
**Plans**: 5 plans in 4 waves

Plans:

- [x] 06-01-PLAN.md — Media foundation: types, download, transcription
- [x] 06-02-PLAN.md — Image storage and module exports
- [x] 06-03-PLAN.md — Queue and gateway media integration
- [x] 06-04-PLAN.md — Telegram voice/photo handlers
- [x] 06-05-PLAN.md — End-to-end verification (human checkpoint)

### Phase 7: Resilience & Tooling

**Goal**: Recover work from timed-out sessions, simplify skill management, enable agent authoring
**Depends on**: Phase 5
**Requirements**: None (bug fixes and enhancements)
**Success Criteria** (what must be TRUE):

1. When Claude times out (>5 min), system recovers response from transcript at `~/.claude/projects/`
2. Transcript path constructed dynamically from cwd (e.g., `/home/user/klausbot` -> `-home-user-klausbot`)
3. `klausbot skills` CLI subcommand removed entirely
4. Documentation points to `npx skills` for external skill installation
5. User can describe agent in natural language, Claude creates `~/.claude/agents/{name}.md`
6. System prompt reminds Claude that agents live in global `~/.claude/agents/` folder
**Plans**: 4 plans in 2 waves

Plans:

- [x] 07-01-PLAN.md — Timeout recovery: transcript path construction, JSONL parsing
- [x] 07-02-PLAN.md — Skills cleanup: remove CLI subcommand, add documentation
- [x] 07-03-PLAN.md — Agent authoring: natural language -> agent definition file
- [x] 07-04-PLAN.md — End-to-end verification (human checkpoint)

### Phase 7.1: Memory Search MCP (INSERTED)

**Goal**: Make embeddings actually usable - migrate to SQLite, expose as MCP tool
**Depends on**: Phase 7
**Requirements**: None (fixing gap - embeddings exist but Claude can't search them)
**Success Criteria** (what must be TRUE):

1. Embeddings stored in SQLite instead of single JSON file
2. `search_memories` MCP tool available to Claude
3. Claude can search past conversations semantically via tool call
4. Date-based filtering supported (search last N days)
5. Old embeddings migrated from JSON to SQLite
6. MCP tool calls are logged for observability
**Plans**: 3 plans in 2 waves

Plans:

- [x] 07.1-01-PLAN.md — SQLite vector storage: better-sqlite3 + sqlite-vec, migration
- [x] 07.1-02-PLAN.md — MCP tool: search_memories with date filtering
- [ ] 07.1-03-PLAN.md — Gap closure: add logging to MCP server tools

### Phase 8: CLI Theme System

**Goal**: Unified CLI output formatting with consistent colors, helper methods, and coherent visual identity
**Depends on**: Phase 7
**Requirements**: None (UX polish)
**Success Criteria** (what must be TRUE):

1. All CLI output uses consistent color scheme (not ad-hoc chalk calls scattered everywhere)
2. Theme module exports helper methods for common output types (success, error, info, header, table, list)
3. Different data types (lists, tables, confirmations, errors) have distinct but cohesive styling
4. Existing CLI commands migrated to use theme helpers
5. Theme easily customizable via single configuration point
**Plans**: (created by /gsd:plan-phase)

Plans:
- [ ] TBD (run /gsd:plan-phase 8 to break down)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
(Phase 6 can parallelize with Phase 3-5 if prioritized)

| Phase            | Plans Complete | Status      | Completed  |
| ---------------- | -------------- | ----------- | ---------- |
| 1. Foundation    | 7/7            | Complete    | 2026-01-29 |
| 2. Core Loop     | 5/5            | Complete    | 2026-01-29 |
| 3. Identity      | 3/3            | Complete    | 2026-01-29 |
| 4. Skills        | 3/3            | Complete    | 2026-01-29 |
| 4.1 Skills Polish| 2/2            | Complete    | 2026-01-30 |
| 5. Proactive     | 4/5            | In progress | -          |
| 5.1 MCP Cron     | 2/2            | Complete    | 2026-01-30 |
| 6. Multimodal    | 5/5            | Complete    | 2026-01-30 |
| 7. Resilience    | 4/4            | Complete    | 2026-01-30 |
| 7.1 Memory Search| 2/3            | In progress | -          |
| 8. CLI Theme     | 0/?            | Not started | -          |

---

_Roadmap created: 2026-01-28_
_Last updated: 2026-01-30_
