# Phase 2: Core Loop - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

User message triggers Claude Code session that reads/writes memory files and returns response. Claude operates agentically within ~/.klausbot/ — reading conversations, identity files, and writing learned preferences. Stateless sessions with file-based persistence.

</domain>

<decisions>
## Implementation Decisions

### Data Home

- All klausbot data lives in `~/.klausbot/`
- Claude Code spawned with cwd=~/.klausbot/ (sandbox workaround)
- Gateway config also moves to ~/.klausbot/config/
- Flat folder structure: `conversations/`, `identity/`, `config/`

### Conversation Storage

- One file per day: `conversations/2026-01-29.md`
- Markdown format — human-readable, grep-friendly
- Minimal metadata: timestamp, role (user/assistant), content
- Final exchanges only — no tool calls or reasoning in log
- Retained forever — no deletion, disk is cheap
- Human-editable — user can add notes, corrections
- `[!important]` markers for pinning significant messages (searchable via grep)

### Memory Retrieval

- Fully agentic — Claude uses grep/glob/read tools to search
- Filename-based date targeting (2026-01-29.md for "yesterday")
- Smart keyword retrieval (synonyms, context) — no embedding infrastructure
- `[!important]` markers searchable as category
- Prompt-level hint: Claude can optimize retrieval if it sees benefit

### Identity Files

- Three files in `identity/`: SOUL.md, IDENTITY.md, USER.md
- SOUL.md: core boundaries and values (immutable principles)
- IDENTITY.md: personality, name, vibe, style
- USER.md: learned user preferences (free-form sections)
- All files editable by both human and Claude
- Positive framing only in SOUL.md — define what bot IS, not prohibitions

### Session Context Injection

- Identity files (SOUL.md, IDENTITY.md, USER.md) loaded at session start
- Explicit guidance prepended to user message:
  - Where conversations live: `~/.klausbot/conversations/{date}.md`
  - Instruction to read recent conversation before responding
- Guidance stripped from conversation log (only user's actual message saved)
- Same guidance every session — no adaptive variation

### CLI Refactor

- Subcommand pattern: `klausbot gateway`, `klausbot pair`, etc.
- Additional subcommands added as needed in future phases

### Claude's Discretion

- Exact markdown format for conversation files
- How to handle "not found" gracefully
- Retrieval optimization strategies
- Identity file section organization

</decisions>

<specifics>
## Specific Ideas

- "Claude is agentic and it can use the grep tool really really well" — trust Claude's retrieval capabilities
- Single `~/.klausbot/` folder as source of truth for everything
- Clean conversation logs (no machinery visible)

</specifics>

<deferred>
## Deferred Ideas

- Embedding-based semantic search — revisit if keyword retrieval proves insufficient
- Hot topics index / retrieval learning — prompt-level only for now
- Adaptive guidance per message type — keeping it simple

</deferred>

---

_Phase: 02-core-loop_
_Context gathered: 2026-01-29_
