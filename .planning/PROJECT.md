# klausbot

## What This Is

A self-evolving personal assistant based on Claude Code with persistent memory, scheduled tasks, and multimodal input. Uses file-based identity system and SQLite storage for conversations and embeddings. Fully autonomous and self-servicing — can update its own files, create skills, and improve over time.

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

### Active

**Current Milestone: v1.1 — Production Ready**

**Goal:** Polish klausbot for release with proper setup, cross-platform support, streaming, and comprehensive testing.

**Target features:**
- Onboard wizard with JSON config, encrypted pairing, gateway guards
- Service management (launchd/systemd) via CLI
- Telegram draft streaming and thread support
- Security hardening (prompt sanitization)
- Cross-platform (Mac/Linux/WSL2/Docker), execPath detection
- Feature detection via env vars, graceful degradation, 12-factor compliance
- Doctor command for prerequisite checks
- Heartbeat.md periodic awareness system (OpenClaw-inspired)
- Complete testing framework (unit + E2E)
- Release docs and README

### Out of Scope

- Multi-user support — personal assistant, single user only
- Web UI — Telegram is the interface (extensible to other channels)
- Sandbox/restrictions — runs in VM, fully autonomous
- Mobile app — Telegram handles mobile access
- OAuth for external services — deferred to v2

## Context

**Current State (v1.0):**

- 7,359 LOC TypeScript across 59 source files
- Tech stack: Node.js, grammY, better-sqlite3, sqlite-vec, Drizzle ORM
- MCP tools: create_cron, list_crons, update_cron, delete_cron, search_memories, get_conversation
- Database: SQLite with WAL, FTS5, sqlite-vec for vectors
- Claude Code hooks: SessionStart, PreCompact, SessionEnd

**Architecture:**

- Gateway daemon polls Telegram, spawns Claude Code per message
- Stateless sessions with file-based state reconstruction
- Identity files (SOUL.md, IDENTITY.md, USER.md) stuffed in context
- Conversations stored in SQLite with AI-generated summaries
- Embeddings via text-embedding-3-small, stored in sqlite-vec

**Tech Debt (v1.0):**

- SKILL-02/04: Skill selection depends on Claude Code native Skill tool
- EVOL-05: Proactive suggestions rely on Claude inference, no automation
- ASCII art aesthetics (functional but improvable)

## Constraints

- **Backend**: Claude Code — the assistant IS Claude Code, not a separate LLM
- **Environment**: VM — no sandbox needed, fully autonomous
- **Interface**: Telegram primary (extensible)
- **User**: Single user (personal software)

## Key Decisions

| Decision                          | Rationale                                              | Outcome     |
| --------------------------------- | ------------------------------------------------------ | ----------- |
| Claude Code as backend            | Full agentic capabilities, not just chat               | Good        |
| File-based memory + agentic read  | RLM approach: Claude reads what it needs               | Good        |
| Self-writable identity files      | Enables self-improvement and evolution                 | Good        |
| SQLite for embeddings             | Replaced JSON file, enables MCP tool access            | Good        |
| MCP tools for cron/memory         | Typed operations, self-describing                      | Good        |
| Claude Code hooks                 | Session continuity without full history in context     | Good        |
| Drizzle ORM                       | Schema migrations, type safety                         | Good        |
| CLI spawner + MCP (not Agent SDK) | Agent SDK query() hung; CLI + MCP reliable             | Good        |

---

*Last updated: 2026-01-31 after v1.1 milestone started*
