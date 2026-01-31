# Milestone v1: MVP

**Status:** SHIPPED 2026-01-31
**Phases:** 1-8 (12 total including decimals)
**Total Plans:** 46

## Overview

Build a self-evolving personal assistant that communicates via Telegram, backed by Claude Code running in a VM. The journey: establish secure infrastructure with budget controls, validate the stateless session + file-based state pattern, build persistent identity, add extensible skills, enable proactive autonomous operations, then add multimodal inputs. Each phase delivers observable capability; security and safety boundaries established before any autonomous operation.

## Phases

### Phase 1: Foundation

**Goal**: Gateway daemon (klausbot) runs 24/7, handles Telegram messages, enforces security via moltbot-style pairing, persists queue across restarts
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, COMM-01, COMM-02, COMM-03, COMM-04, EVOL-04
**Plans**: 7 plans

- [x] 01-01-PLAN.md — Project setup: npm, TypeScript, config, logger
- [x] 01-02-PLAN.md — Telegram bot core with grammY plugins
- [x] 01-03-PLAN.md — Message queue and Claude Code spawner
- [x] 01-04-PLAN.md — Pairing flow and security middleware
- [x] 01-05-PLAN.md — Gateway integration: wire all components
- [x] 01-06-PLAN.md — Deployment: install wizard, systemd, Docker
- [x] 01-07-PLAN.md — End-to-end verification (human checkpoint)

**Completed:** 2026-01-29

### Phase 2: Core Loop

**Goal**: User message triggers Claude Code session that reads/writes memory files and returns response
**Depends on**: Phase 1
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06, MEM-07
**Plans**: 5 plans

- [x] 02-01-PLAN.md — Memory foundation: data home, identity files, conversation logger
- [x] 02-02-PLAN.md — Context-aware spawner: system prompt builder, cwd injection
- [x] 02-03-PLAN.md — Integration: gateway wiring, CLI init subcommand
- [x] 02-04-PLAN.md — End-to-end verification (human checkpoint)
- [x] 02-05-PLAN.md — Gap closure: semantic search with vector embeddings (MEM-05)

**Completed:** 2026-01-29

### Phase 3: Identity

**Goal**: Bot has persistent personality that survives sessions and evolves through bootstrap flow
**Depends on**: Phase 2
**Requirements**: IDEN-01, IDEN-02, IDEN-03, IDEN-04, IDEN-05, IDEN-06
**Plans**: 3 plans

- [x] 03-01-PLAN.md — Bootstrap foundation: detector, prompts, cache invalidation
- [x] 03-02-PLAN.md — Gateway integration: routing, identity update instructions
- [x] 03-03-PLAN.md — End-to-end verification (human checkpoint)

**Completed:** 2026-01-29

### Phase 4: Skills

**Goal**: Claude selects and executes reusable skills from folder, can create new skills proactively
**Depends on**: Phase 3
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05
**Plans**: 3 plans

- [x] 04-01-PLAN.md — Telegram skill command registration
- [x] 04-02-PLAN.md — CLI skills installer and skill-creator auto-install
- [x] 04-03-PLAN.md — End-to-end verification (human checkpoint)

**Completed:** 2026-01-29

### Phase 4.1: Skills Polish (INSERTED)

**Goal**: Address skill system gaps identified during Phase 4 UAT
**Depends on**: Phase 4
**Plans**: 2 plans

- [x] 04.1-01-PLAN.md — System prompt skill folder reminder
- [x] 04.1-02-PLAN.md — Interactive browse command with type-to-filter

**Completed:** 2026-01-30

### Phase 5: Proactive

**Goal**: Bot executes scheduled tasks autonomously and improves itself based on learnings
**Depends on**: Phase 4
**Requirements**: CRON-01, CRON-02, CRON-03, CRON-04, CRON-05, EVOL-01, EVOL-02, EVOL-03, EVOL-05
**Plans**: 5 plans

- [x] 05-01-PLAN.md — Cron foundation: types, store, schedule parsing
- [x] 05-02-PLAN.md — Cron execution: executor, service, scheduler loop
- [x] 05-03-PLAN.md — Cron integration: gateway lifecycle, /crons command
- [x] 05-04-PLAN.md — Learning system: LEARNINGS.md, system prompt instructions
- [x] 05-05-PLAN.md — End-to-end verification (human checkpoint)

**Completed:** 2026-01-31

### Phase 5.1: MCP Cron Tools (INSERTED)

**Goal**: Expose cron operations as typed MCP tools instead of CLI instructions in system prompt
**Depends on**: Phase 5
**Plans**: 2 plans

Note: Originally planned as ACP streaming with Agent SDK. Pivoted to CLI spawner + MCP after Agent SDK `query()` hung indefinitely.

- [x] 05.1-01-PLAN.md — Standalone MCP server with cron tools (stdio transport)
- [x] 05.1-02-PLAN.md — Spawner integration and end-to-end verification

**Completed:** 2026-01-30

### Phase 6: Multimodal

**Goal**: Bot processes voice messages and images as naturally as text
**Depends on**: Phase 2
**Requirements**: COMM-05, COMM-06
**Plans**: 5 plans

- [x] 06-01-PLAN.md — Media foundation: types, download, transcription
- [x] 06-02-PLAN.md — Image storage and module exports
- [x] 06-03-PLAN.md — Queue and gateway media integration
- [x] 06-04-PLAN.md — Telegram voice/photo handlers
- [x] 06-05-PLAN.md — End-to-end verification (human checkpoint)

**Completed:** 2026-01-30

### Phase 7: Resilience & Tooling

**Goal**: Recover work from timed-out sessions, simplify skill management, enable agent authoring
**Depends on**: Phase 5
**Plans**: 4 plans

- [x] 07-01-PLAN.md — Timeout recovery: transcript path construction, JSONL parsing
- [x] 07-02-PLAN.md — Skills cleanup: remove CLI subcommand, add documentation
- [x] 07-03-PLAN.md — Agent authoring: natural language -> agent definition file
- [x] 07-04-PLAN.md — End-to-end verification (human checkpoint)

**Completed:** 2026-01-30

### Phase 7.1: Memory Search MCP (INSERTED)

**Goal**: Make embeddings actually usable - migrate to SQLite, expose as MCP tool
**Depends on**: Phase 7
**Plans**: 3 plans

- [x] 07.1-01-PLAN.md — SQLite vector storage: better-sqlite3 + sqlite-vec, migration
- [x] 07.1-02-PLAN.md — MCP tool: search_memories with date filtering
- [x] 07.1-03-PLAN.md — Gap closure: add logging to MCP server tools

**Completed:** 2026-01-30

### Phase 7.2: Conversation Continuity (INSERTED)

**Goal**: klausbot owns conversation data with Claude Code hooks for context injection and history search
**Depends on**: Phase 7.1
**Plans**: 5 plans

Note: Inspired by OpenClaw's memory architecture. Sessions remain discrete but context-aware via hook injection.

- [x] 07.2-01-PLAN.md — Hook CLI commands: `klausbot hook start|compact|end`, remove markdown logger
- [x] 07.2-02-PLAN.md — Conversation storage: Drizzle schema + migrations, parse transcript, summarize
- [x] 07.2-03-PLAN.md — Spawner integration: --settings JSON with hooks, path detection
- [x] 07.2-04-PLAN.md — MCP tool updates: search conversations, get_conversation tool
- [x] 07.2-05-PLAN.md — End-to-end verification (human checkpoint)

**Completed:** 2026-01-31

### Phase 8: CLI Theme System

**Goal**: Unified CLI output formatting with consistent colors, helper methods, and coherent visual identity
**Depends on**: Phase 7
**Plans**: 3 plans

- [x] 08-01-PLAN.md — Create theme module with muted color helpers
- [x] 08-02-PLAN.md — Migrate CLI files to use theme helpers
- [x] 08-03-PLAN.md — End-to-end verification (human checkpoint)

**Completed:** 2026-01-31

---

## Milestone Summary

**Decimal Phases:**

- Phase 4.1: Skills Polish (inserted after Phase 4 for UAT fixes)
- Phase 5.1: MCP Cron Tools (inserted after Phase 5, pivoted from Agent SDK)
- Phase 7.1: Memory Search MCP (inserted for embedding usability)
- Phase 7.2: Conversation Continuity (inserted for Claude Code hooks)

**Key Decisions:**

- Claude Code as backend (full agentic capabilities)
- File-based memory with agentic retrieval (RLM-inspired)
- SQLite for embeddings and conversations (sqlite-vec for vectors)
- MCP tools for cron and memory operations
- Claude Code hooks for session continuity
- Drizzle ORM for schema management

**Issues Resolved:**

- Agent SDK query() hanging → pivoted to CLI spawner + MCP
- Embeddings unusable → migrated to SQLite with MCP tool
- Markdown conversation logs → replaced with SQLite storage
- Hook logs invisible → file-based logging

**Technical Debt Incurred:**

- EVOL-05 partial: Proactive suggestions rely on Claude inference, no automated pattern detection
- SKILL-02/04 partial: Skill selection depends on Claude Code native capability
- ASCII art aesthetics noted as improvable (functional, not blocking)

---

_For current project status, see .planning/PROJECT.md_
_Archived: 2026-01-31_
