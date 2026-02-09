# klausbot

## What This Is

A self-evolving personal assistant based on Claude Code with persistent memory, scheduled tasks, multimodal input, real-time Telegram streaming, and infinite conversation context. Uses file-based identity system and SQLite storage for conversations and embeddings. Fully autonomous and self-servicing — can update its own files, create skills, spawn sub-agents, and improve over time.

## Core Value

24/7 personal assistant that never forgets, never loses context, and self-improves through use.

## Requirements

### Validated

- INFRA-01 through INFRA-05 — v1.0 (gateway, spawner, security, graceful restart)
- COMM-01 through COMM-06 — v1.0 (text, voice, images, thinking indicator, errors)
- MEM-01 through MEM-07 — v1.0 (SQLite storage, hybrid context, semantic search)
- IDEN-01 through IDEN-06 — v1.0 (identity files, bootstrap, persistence)
- CRON-01 through CRON-05 — v1.0 (persistent crons, natural language, notifications)
- SKILL-01, SKILL-03, SKILL-05 — v1.0 (skill folder, pre-installed, standard format)
- EVOL-01 through EVOL-04 — v1.0 (learnings, consults, modifies, git)
- PLAT-01, PLAT-02, PLAT-03, PLAT-05, PLAT-06 — v1.1 (cross-platform, execPath, 12-factor)
- DTCT-01 through DTCT-05 — v1.1 (capability detection, graceful degradation)
- STRM-01 through STRM-04 — v1.1 (Telegram streaming, throttling, configurable)
- TELE-01, TELE-02 — v1.1 (threading, reply linking)
- HRTB-01 through HRTB-06 — v1.1 (heartbeat, periodic check, note collection)
- RLSE-01 through RLSE-05 — v1.1 (README, docs, troubleshooting)
- TEST-01 through TEST-03 — v1.1 (unit tests, evals, confidence)

### Active

No active milestone. Run `/gsd:new-milestone` to plan next.

### Out of Scope

- Multi-user support — personal assistant, single user only
- Web UI — Telegram is the interface (extensible to other channels)
- Sandbox/restrictions — runs in VM, fully autonomous
- Mobile app — Telegram handles mobile access
- OAuth for external services — deferred to v2
- Native Windows support — WSL2 provides better compatibility
- CI/CD pipeline — not needed for fork-and-run model

## Context

**Current State (v1.1):**

- 11,502 LOC TypeScript across 74 source files
- 3,311 LOC tests (253 unit tests), 1,778 LOC evals (43 cases, 7 suites)
- Tech stack: Node.js, grammY, better-sqlite3, sqlite-vec, Drizzle ORM, Vitest, Evalite
- MCP tools: create_cron, list_crons, update_cron, delete_cron, search_memories, get_conversation
- Database: SQLite with WAL, FTS5, sqlite-vec for vectors
- Claude Code hooks: SessionStart, PreCompact, SessionEnd
- Streaming: Real-time Telegram draft streaming with throttled updates
- Heartbeat: Periodic HEARTBEAT.md awareness checks with note collection
- Subagents: Claude can spawn background Claude agents for parallel work
- Context: Infinite conversation context with thread detection and tiered history injection

**Architecture:**

- Gateway daemon polls Telegram, spawns Claude Code per message
- Stateless sessions with file-based state reconstruction
- Identity files (SOUL.md, IDENTITY.md, USER.md) stuffed in context
- Conversations stored in SQLite with AI-generated summaries
- Embeddings via text-embedding-3-small, stored in sqlite-vec
- Conversation context engine: thread detection, tiered formatting, 120K char budget
- Streaming: Callback pattern with throttled draft updates to Telegram

**Tech Debt:**

- SKILL-02/04: Skill selection depends on Claude Code native Skill tool
- EVOL-05: Proactive suggestions rely on Claude inference, no automation
- DTCT-03: Graceful degradation framework exists but no consumer feature uses it
- Global test coverage 19% (individual modules 92-100%)

## Constraints

- **Backend**: Claude Code — the assistant IS Claude Code, not a separate LLM
- **Environment**: VM — no sandbox needed, fully autonomous
- **Interface**: Telegram primary (extensible)
- **User**: Single user (personal software)

## Key Decisions

| Decision                          | Rationale                                          | Outcome |
| --------------------------------- | -------------------------------------------------- | ------- |
| Claude Code as backend            | Full agentic capabilities, not just chat           | Good    |
| File-based memory + agentic read  | RLM approach: Claude reads what it needs           | Good    |
| Self-writable identity files      | Enables self-improvement and evolution             | Good    |
| SQLite for embeddings             | Replaced JSON file, enables MCP tool access        | Good    |
| MCP tools for cron/memory         | Typed operations, self-describing                  | Good    |
| Claude Code hooks                 | Session continuity without full history in context | Good    |
| Drizzle ORM                       | Schema migrations, type safety                     | Good    |
| CLI spawner + MCP (not Agent SDK) | Agent SDK query() hung; CLI + MCP reliable         | Good    |
| Callback streaming (not generator)| Return value access; skip during bootstrap         | Good    |
| Heartbeat + HEARTBEAT_OK contract | Suppression prevents spam; hot reload via config   | Good    |
| 120K char context budget          | ~30K tokens via character estimation, no tokenizer | Good    |
| Thread detection via 30min gaps   | Walk backward through conversation timestamps      | Good    |
| XML user message wrapping         | Security without full prompt injection framework   | Good    |
| Descoped Setup/Service/Doctor     | Fork-and-run model doesn't need wizard/service mgmt| Good    |
| Evalite for LLM evals             | Vitest-based, AI SDK integration, LLM-as-judge    | Good    |

---

_Last updated: 2026-02-09 after v1.1 milestone completed_
