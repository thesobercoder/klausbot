# clawdbot

## What This Is

A self-evolving personal assistant that communicates via Telegram, backed by Claude Code running in a VM. Uses file-based memory and identity system inspired by the Recursive Language Model paper and Moltbot's architecture. Fully autonomous and self-servicing — can update its own files, create skills, and improve over time.

## Core Value

24/7 personal assistant that never forgets, never loses context, and self-improves through use.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Telegram bot interface — send message, get response
- [ ] Wrapper process — runs 24/7, polls Telegram, spawns Claude Code sessions per message
- [ ] Conversation persistence — all conversations saved to SQLite or file
- [ ] Identity files — SOUL.md, IDENTITY.md, USER.md with Claude-writable access
- [ ] Bootstrap flow — onboarding conversation creates identity files on first run
- [ ] Context restoration — each session reads memory files + conversation history agentic-ally
- [ ] Cron system — scheduled tasks from plaintext instructions, stored and executed
- [ ] Skills system — reusable capabilities in folder, Claude selects based on task
- [ ] Proactive skill creation — Claude asks "should I create a skill for this?" when patterns emerge
- [ ] Self-improvement — learnings and mistakes written to files, consulted in future sessions

### Out of Scope

- Multi-user support — personal assistant, single user only
- Web UI — Telegram is the interface
- Sandbox/restrictions — runs in VM, fully autonomous
- Mobile app — Telegram handles mobile access

## Context

**Architecture (RLM-inspired):**
- Don't stuff everything into context window
- Claude uses tools to agentic-ally read conversation history and identity files
- New session each message, but full context reconstructed from files
- Infinite conversation without context loss

**Identity system (Moltbot-inspired):**
- `BOOTSTRAP.md` — onboarding conversation, creates other files, self-deletes
- `IDENTITY.md` — surface attributes: name, vibe, emoji
- `SOUL.md` — constitution: core truths, boundaries, values
- `USER.md` — info about user: preferences, context
- `LEARNINGS.md` — mistakes and insights, consulted to avoid repeating errors

**Wrapper process:**
- Python/Node script runs continuously
- Polls Telegram for new messages
- On message: invokes Claude Code with message + file references
- Sends Claude's response back via Telegram
- Handles cron scheduling separately

**References:**
- RLM paper: https://arxiv.org/html/2512.24601v1
- Moltbot: https://github.com/moltbot/moltbot
- Moltbot docs: https://docs.molt.bot/reference/templates/BOOTSTRAP

## Constraints

- **Backend**: Claude Code — the assistant IS Claude Code, not a separate LLM
- **Environment**: VM — no sandbox needed, fully autonomous
- **Interface**: Telegram only
- **User**: Single user (personal software)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude Code as backend | User wants Claude's full agentic capabilities, not just chat | — Pending |
| File-based memory over embeddings | RLM approach: agentic file reading vs vector search | — Pending |
| Self-writable identity files | Enables self-improvement and evolution | — Pending |
| Skill-based task execution | Reusable, composable, Claude can create new ones | — Pending |

---
*Last updated: 2025-01-28 after initialization*
