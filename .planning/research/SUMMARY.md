# Project Research Summary

**Project:** klausbot
**Domain:** Self-Evolving Personal AI Assistant (Telegram Bot + Claude Code Backend)
**Researched:** 2026-01-28
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a personal AI assistant delivered as a Telegram bot with Claude Code as the backend execution engine. The defining characteristics are: (1) file-based memory system inspired by RLM principles, (2) proactive autonomous messaging via cron scheduling, and (3) self-evolution capabilities where the bot can improve itself. Expert implementations use stateless session architecture where each user interaction spawns a fresh Claude session that reads context from identity/memory files, executes the task, writes back to files, then terminates. This differs from traditional chatbots that maintain persistent conversation state in memory or databases.

The recommended approach: Node.js 24 LTS runtime with grammY for Telegram integration, native SQLite for structured data (sessions/cron), and markdown files for human-readable memory (SOUL.md for identity, conversation logs, learnings). Claude Code is invoked via CLI subprocess spawning (`spawn()` with `--output-format json`), not the Anthropic SDK, because we need the full toolset (file operations, bash, etc) not just API chat. Architecture centers on a single long-running Gateway daemon that polls Telegram and spawns ephemeral Claude sessions per message. Skills are stored as markdown instructions that Claude reads and follows, enabling extensibility without code changes.

Key risks are well-documented in production AI agent deployments: token runaway from uncontrolled loops (prevention: hard iteration caps, budget limits), prompt injection turning bot into insider threat (prevention: input sanitization, least privilege file access), and memory poisoning where hallucinated facts corrupt long-term memory (prevention: confidence scores, source attribution). The self-evolution capability is novel territory with unique risks around the bot breaking its own core functionality through self-modification (prevention: Git-backed changes, protected files, rollback mechanisms).

## Key Findings

### Recommended Stack

Node.js 24 LTS provides built-in SQLite (Stability 1.1) eliminating native compilation dependencies. grammY is the clear choice for Telegram integration over Telegraf due to TypeScript-first design, Bot API 9.3 support (vs Telegraf's 7.1 lag), and superior documentation. Claude Code integration uses direct CLI spawning via `child_process.spawn()` with `--output-format json` flag rather than the Anthropic SDK, giving access to full tool capabilities (Read, Write, Edit, Bash, Glob, Grep). Memory architecture blends SQLite for structured data (sessions, user prefs, cron schedules) with markdown files for identity (SOUL.md, IDENTITY.md, USER.md) and conversation history. This file-based approach aligns with RLM principles where context lives in the environment, not the LLM's context window, and is directly manipulable by Claude's file tools.

**Core technologies:**

- **Node.js 24.x LTS**: Runtime with built-in SQLite, OpenSSL 3.5 security, supported until Apr 2028
- **grammY 1.39.x**: TypeScript-first Telegram framework, Bot API 9.3 support, active maintenance
- **Claude Code CLI**: Backend via subprocess spawning (`-p "prompt" --output-format json`), gives full toolset
- **node:sqlite**: Native structured data storage (Stability 1.1), zero deps, fallback to better-sqlite3 if needed
- **Markdown files**: Identity/memory storage (SOUL.md, daily notes), human-readable, git-friendly, Claude-writable
- **node-cron 4.2.x**: Lightweight scheduling for proactive messaging, no external deps
- **zod 4.3.x**: Schema validation for configs, API responses, Claude output parsing

### Expected Features

Personal AI assistants have shifted from novelty to utility by 2026. Table stakes now include persistent memory ("remember what I told you"), voice message transcription (Telegram-native, users send voice constantly), and image analysis (users will send screenshots). Missing any of these makes the product feel incomplete. Error transparency is critical after 2025's high-profile AI failures; users must know when things fail, not experience silent errors. Privacy transparency is legally required given Telegram's server-side message passing.

**Must have (table stakes):**

- Text message handling with conversation context (window buffer)
- Persistent memory (long-term storage + retrieval)
- Voice message transcription (Whisper/similar, 120+ languages)
- Image analysis (Vision model integration)
- Identity files (SOUL.md, IDENTITY.md, USER.md for consistent personality)
- Error handling with graceful degradation (no silent failures)
- Privacy transparency (clear data handling policy)

**Should have (competitive differentiators):**

- Proactive messaging (bot initiates contact: reminders, alerts, briefings)
- Self-evolution (bot improves itself, adds capabilities autonomously)
- Skills system (pluggable, reusable capabilities)
- Semantic memory retrieval (vector embeddings for relevant recall)
- User learning (adapts to preferences over time, writes to USER.md)

**Defer (v2+):**

- Multi-platform integration (calendar, email, task managers - OAuth complexity)
- Multi-agent routing (specialized agents for different tasks - premature optimization)
- Code execution in production (security requires careful design)
- Price/flight monitoring (nice-to-have, not core value proposition)

**Anti-features to deliberately avoid:**

- Pretending to be human (legal liability, trust violation)
- Sycophancy/excessive agreeableness (sacrifices truthfulness)
- Autonomous actions without confirmation (prevents "steaming pile of regret" scenarios)
- Silent failures (worse than crashing)
- Unlimited context retention (privacy nightmare)

### Architecture Approach

Stateless session + file-based state pattern dominates production implementations. Gateway runs as single long-lived daemon handling Telegram long polling and cron scheduling. Each user message spawns a fresh Claude Agent SDK session that reads identity files (SOUL.md, IDENTITY.md, USER.md), conversation history, and any relevant skills, processes the request with full tool access, updates memory files, returns response, then terminates. This RLM-inspired approach stores context in environment (files) not LLM context window, enabling unlimited conversation length and inspectable state. Sessions are ephemeral by design; all state persists in files.

**Major components:**

1. **Gateway (Node.js daemon)** — Polls Telegram, manages cron, spawns Claude sessions, routes messages
2. **Session Spawner** — Creates Claude Agent SDK sessions per message, manages tool permissions, working directory
3. **Claude Agent Session** — Executes user request with full tool access, reads/writes files, terminates after task
4. **Identity Files** — Static personality definition (SOUL.md, IDENTITY.md), written during bootstrap, rarely updated
5. **Memory Files** — Conversation history, learned context (conversations/, LEARNINGS.md), frequently updated by sessions
6. **Skills System** — Reusable task patterns as markdown, Claude selects and uses based on task

**Key patterns:**

- Long polling over webhooks (simpler for single-user, no SSL/public IP required)
- Agentic context reconstruction (don't pass full history in prompt, let Claude read what it needs)
- Skills as markdown instructions (human-readable, Claude-editable, no code execution needed)
- Plaintext cron storage (files not database rows, Claude can modify directly)

### Critical Pitfalls

Production AI agent deployments in 2025-2026 reveal consistent failure modes. Top risks by severity:

1. **Token Runaway / Infinite Loop Catastrophe** — Agent stuck in retry loop burns $100-1000 in minutes. Prevention: hard iteration caps (`max_retries=5`), daily budget ceiling, mutex locks on cron, exponential backoff. Address in Phase 1 before any autonomous operation.

2. **Prompt Injection as Insider Threat** — Malicious content in Telegram message hijacks Claude's instructions, executes attacker's commands with full file system access. Prevention: input sanitization layer, separate untrusted content with delimiters (`<user_input>...</user_input>`), least privilege file access (bot user can only write to specific directories), identity file checksums detect unauthorized modifications. Address in Phase 1; security architecture must be foundational.

3. **Memory Poisoning / Drift Corruption** — Bad data enters memory, bot learns incorrect facts, develops inconsistent personality, remembers hallucinated events as real. Once poisoned, memory compounds errors. Prevention: confidence scores (HIGH/MEDIUM/LOW/INFERRED tags), source attribution tracking, validation layer checking contradictions, memory TTL (stale entries decay), separate storage for user-stated facts vs bot observations. Address in Phase 2 during core memory architecture.

4. **Identity/Persona Drift in Extended Conversations** — Bot's personality changes over long sessions, research shows drift toward "reinforcing delusional beliefs, supporting social isolation, encouraging suicidal ideation" in therapy/emotional topics. Prevention: identity re-injection every session (prepend SOUL.md/IDENTITY.md), conversation length limits, drift detection monitoring behavioral markers, periodic re-anchoring every N turns. Address in Phase 3 during identity persistence design.

5. **Self-Modification Sabotaging Core Functionality** — Bot modifies own code/skills, introduces bug, breaks critical path, no rollback. Prevention: Git-backed modifications (auto-commit all changes), protected files (SOUL.md, core wrapper CANNOT be self-modified), staged deployment (changes to staging, validate, promote), rollback mechanism (revert to last known good), change boundaries (skills can modify themselves but not other skills or core). Address in Phase 1 (Git foundation) + Phase 4 (skill isolation).

**Moderate pitfalls:**

- Rate limit surprise (org-wide limits, holiday bonus withdrawal - 60% reduction)
- Telegram polling reliability (network issues, message duplication)
- Context window exhaustion (goldfish effect in long conversations)
- File system escape via symlinks (insufficient isolation)
- Cron job chaos (collision, silent failures, time zone confusion)

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order and risk mitigation priority:

### Phase 1: Foundation (Gateway + Security)

**Rationale:** Gateway and security boundaries must exist before any autonomous operation. Token runaway and prompt injection are Phase 1 risks that cause rewrites if addressed later. Telegram polling validates external integration early.

**Delivers:**

- Long-running Gateway daemon (Node.js, grammY)
- Telegram long polling (tests external connection)
- Basic file structure (.memory/, .claude/skills/, cron/)
- Security architecture (input sanitization, file access allowlist, budget caps)
- Git integration (all self-modifications auto-committed)
- Error handling with transparency (no silent failures)

**Addresses features:**

- Text message handling (table stakes)
- Error handling with graceful degradation (table stakes)

**Avoids pitfalls:**

- Pitfall 1: Token runaway (budget caps, iteration limits before any loop)
- Pitfall 2: Prompt injection (sanitization layer, permission boundaries)
- Pitfall 5: Self-modification breakage (Git foundation, protected files)
- Pitfall 6: Rate limit surprise (budget monitoring from day one)

**Research needs:** LOW (grammY docs, Node.js process management are well-documented)

### Phase 2: Core Loop (Claude Integration + Memory)

**Rationale:** Validates the core capability (Gateway spawns Claude session, gets response) before adding complexity. Memory architecture decisions are foundational; changing later causes data migration pain. This phase answers "can the stateless session + file-based state pattern actually work?"

**Delivers:**

- Claude Agent SDK integration (CLI subprocess spawning)
- Session spawning per message (Gateway -> Claude -> Gateway flow)
- Response delivery to Telegram
- Identity file structure (SOUL.md, IDENTITY.md, USER.md)
- Conversation persistence (conversations/YYYY-MM-DD.md)
- Agentic file reading (Claude reads context as needed)
- Memory validation (confidence scores, source attribution)

**Addresses features:**

- Conversation context (table stakes)
- Persistent memory (table stakes)
- Identity files (differentiator)

**Uses stack:**

- Claude Code CLI (`spawn()` with `--output-format json`)
- Markdown files (identity, memory)
- zod (response validation)

**Implements architecture:**

- Session Spawner component
- Claude Agent Session pattern
- Identity Files component
- Memory Files component

**Avoids pitfalls:**

- Pitfall 3: Memory poisoning (confidence scores, source attribution)
- Pitfall 8: Context exhaustion (agentic reading, not full history in prompt)

**Research needs:** MEDIUM (RLM-inspired memory implementation is novel, may need refinement during build)

### Phase 3: Identity Persistence (Bootstrap + Personality)

**Rationale:** Once memory works, establish persistent personality. Bootstrap flow creates initial identity. Drift detection prevents personality degradation over time. This phase makes the bot feel like a consistent entity, not generic chatbot.

**Delivers:**

- Bootstrap flow (first-run onboarding creates SOUL.md, IDENTITY.md, USER.md)
- System prompt construction (includes identity files)
- Identity re-injection protocol (every session reads identity)
- Drift detection (behavioral markers, personality metrics)
- User learning (writes to USER.md based on preferences)

**Addresses features:**

- Basic personality/tone (table stakes)
- User learning (differentiator)

**Avoids pitfalls:**

- Pitfall 4: Identity drift (re-anchoring protocol, drift detection)

**Research needs:** LOW (personality file patterns established, drift detection is behavioral monitoring)

### Phase 4: Extensibility (Skills System)

**Rationale:** Skills provide growth path without rewriting core. Must come after identity/memory work because skills need to read context. Skill isolation prevents self-modification from breaking other components.

**Delivers:**

- Skills file structure (.claude/skills/)
- Skill file format (markdown instructions)
- Skill selection (Claude decides which to use based on task)
- Skill execution tracking
- Change boundaries (skills can modify themselves, not other skills or core)
- Skill testing framework

**Addresses features:**

- Skills system (differentiator)

**Avoids pitfalls:**

- Pitfall 5: Self-modification sabotage (skill isolation, rollback mechanisms)
- Pitfall 13: Hallucinated skill actions (verification layer, honest uncertainty)

**Research needs:** LOW (markdown-based skills pattern documented in Claude Code, Agent Skills)

### Phase 5: Proactive System (Cron + Autonomous Operations)

**Rationale:** Comes last because it combines everything: spawns sessions, reads memory, uses skills, requires robust error handling. This is the differentiator that sets klausbot apart from ChatGPT, but it's the highest-risk component.

**Delivers:**

- Cron scheduler (node-cron)
- Cron file storage (cron/\*.md with schedule metadata)
- Job locking (prevent overlapping execution)
- Dependency checking (prerequisites before execution)
- Failure notifications
- Proactive messaging (reminders, alerts, briefings)
- Self-evolution triggers (scheduled improvement tasks)

**Addresses features:**

- Proactive messaging (core differentiator)
- Self-evolution (core differentiator)

**Avoids pitfalls:**

- Pitfall 1: Token runaway (mutex prevents cron collision causing loops)
- Pitfall 10: Cron job chaos (locking, dependency checks, failure alerts)

**Research needs:** MEDIUM (self-evolution scope unclear - what can bot safely modify? Needs boundary definition)

### Phase 6: Multimodal (Voice + Vision)

**Rationale:** Deferred until core functionality proven. Voice/vision are table stakes but independent of core loop. Can be added in parallel after Phase 2 completes if prioritized.

**Delivers:**

- Voice message transcription (Whisper API integration)
- Image analysis (Vision model integration)

**Addresses features:**

- Voice message transcription (table stakes)
- Image analysis (table stakes)

**Avoids pitfalls:**

- Pitfall 6: Rate limit surprise (voice/image APIs have costs, need monitoring)

**Research needs:** LOW (Whisper/Vision APIs well-documented)

### Phase Ordering Rationale

**Dependency-driven:**

- Gateway must exist before Claude can be spawned (Phase 1 → 2)
- Identity files must exist before personality can persist (Phase 2 → 3)
- Skills require memory/identity context to function (Phase 2,3 → 4)
- Cron uses everything: spawns sessions, reads memory, executes skills (Phase 1,2,3,4 → 5)

**Risk mitigation:**

- Security boundaries in Phase 1 prevent prompt injection from day one
- Memory validation in Phase 2 prevents poisoning before it accumulates
- Identity re-injection in Phase 3 prevents drift before bad habits form
- Skill isolation in Phase 4 prevents self-modification breakage before autonomy
- Cron comes last when error handling, budget caps, and safety mechanisms proven

**Validation points:**

- Phase 1 validates: External integration works (Telegram), security boundaries hold
- Phase 2 validates: Core capability works (stateless session + file-based state)
- Phase 3 validates: Personality persistence works across sessions
- Phase 4 validates: Extensibility works without rewriting core
- Phase 5 validates: Autonomous operation works safely

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 2 (Memory):** RLM-inspired implementation is emerging pattern, may need iteration to get right. Confidence score schema, source attribution format, contradiction detection logic need design.
- **Phase 5 (Cron + Self-Evolution):** Self-evolution scope unclear - what boundaries exist? What can bot modify? How to validate changes before deployment? Novel territory.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Gateway):** grammY long polling, child_process.spawn() well-documented
- **Phase 3 (Identity):** Bootstrap flow, system prompt construction standard patterns
- **Phase 4 (Skills):** Markdown-based skills documented in Claude Code, Agent Skills references
- **Phase 6 (Multimodal):** Whisper/Vision API integration straightforward

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                                                                                                                                         |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH        | All technologies verified via npm registry, official docs, version numbers confirmed as of 2026-01-28. grammY vs Telegraf comparison thorough.                                                                |
| Features     | MEDIUM      | Table stakes consistent across all sources (memory, voice, image). Differentiators (proactive, self-evolution) emerging patterns with less production data. Anti-features well-documented from 2025 failures. |
| Architecture | MEDIUM-HIGH | Stateless session + file-based state pattern confirmed in multiple production implementations (Moltbot, RLM paper, Anthropic research). Component boundaries clear.                                           |
| Pitfalls     | HIGH        | Critical pitfalls (token runaway, prompt injection, memory poisoning, identity drift, self-modification) verified in academic papers, security research, production incidents. Phase mappings logical.        |

**Overall confidence:** MEDIUM-HIGH

Research synthesizes official documentation (Claude Agent SDK, grammY, Node.js), academic research (RLM paper, identity drift, agent failures), security research (OWASP, Anthropic), and production implementations (Moltbot). Core technical decisions (Node.js 24, grammY, CLI spawning, markdown files) have HIGH confidence. Architectural patterns (stateless sessions, file-based state, agentic reading) validated by multiple independent sources. Feature expectations and pitfalls cross-referenced across industry analysis, academic papers, and documented failures.

Novel aspects (self-evolution, RLM-inspired memory at this scale) have MEDIUM confidence due to limited production data, but architectural principles sound and risks identified.

### Gaps to Address

**Gap 1: Self-evolution boundaries**

- What can bot safely modify? (Skills yes, SOUL.md no - but where's the line?)
- How to validate changes before deployment? (Test suite requirement? Staging environment?)
- What rollback mechanism? (Git revert sufficient or need snapshot system?)
- **Resolution:** Needs design during Phase 5 planning, potentially `/gsd:research-phase` on self-modification patterns

**Gap 2: Memory granularity and retention**

- What gets persisted vs ephemeral? (All conversations? Summarized after N days?)
- User explicit control needed? (Commands to forget, export, prune?)
- Sensitive data handling? (Automatic detection? User flags?)
- **Resolution:** Design during Phase 2 planning, inform from privacy regulations (GDPR-style)

**Gap 3: Multi-instance scenarios**

- What if user runs bot from multiple devices/VMs?
- How to handle conflicting state in files?
- File locking for concurrent access?
- **Resolution:** Defer to post-MVP, document as single-instance assumption for V1

**Gap 4: Native SQLite stability**

- node:sqlite is Stability 1.1 (Active Development), not 2 (Stable)
- May encounter bugs or limitations
- **Resolution:** Fallback plan to better-sqlite3 if issues arise, keep abstraction layer thin

**Gap 5: Claude Code rate limits**

- CLI may have different limits than API
- Need to verify burst handling
- **Resolution:** Monitor during Phase 1, add queue if needed

## Sources

### Primary (HIGH confidence)

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview) - Official Anthropic docs, session patterns
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) - Official flags, session management
- [Claude Code Headless Mode](https://code.claude.com/docs/en/headless) - Automation patterns
- [Claude Code Skills](https://code.claude.com/docs/en/skills) - Skill system design
- [Anthropic Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) - Official research on agent patterns
- [Node.js 24 LTS](https://nodejs.org/en/about/previous-releases) - Version verification, native SQLite
- [Node.js SQLite docs](https://nodejs.org/api/sqlite.html) - Native module capabilities
- [grammY documentation](https://grammy.dev/) - TypeScript-first framework, Bot API 9.3
- [grammY comparison](https://grammy.dev/resources/comparison) - vs Telegraf analysis
- [grammY Deployment Types](https://grammy.dev/guide/deployment-types) - Polling vs webhooks
- [Telegram Bot Features](https://core.telegram.org/bots/features) - Official API capabilities
- [Anthropic Rate Limits](https://docs.anthropic.com/en/api/rate-limits) - Org-wide limits
- npm registry - Version verification for grammY 1.39.x, TypeScript 5.9.x, tsx 4.21.x, node-cron 4.2.x, zod 4.3.x

### Secondary (MEDIUM confidence)

- [RLM Paper (arXiv)](https://arxiv.org/html/2512.24601v1) - Context as environment variable pattern
- [ArXiv: Identity Drift in LLM Agents](https://arxiv.org/abs/2412.00804) - Drift research
- [ArXiv: The Assistant Axis](https://arxiv.org/abs/2601.10387) - Drift toward harmful behaviors
- [ArXiv: Why Autonomous Agents Fail](https://arxiv.org/html/2508.13143v1) - Infinite loop analysis
- [ArXiv: Memory in the Age of AI Agents](https://arxiv.org/abs/2512.13564) - Memory architecture research
- [OWASP AI Agent Security Top 10](https://medium.com/@oracle_43885/owasps-ai-agent-security-top-10-agent-security-risks-2026-fc5c435e86eb) - Security risks
- [Moltbot Documentation](https://docs.molt.bot/concepts/architecture) - Production implementation reference
- [Moltbot Guide - DEV Community](https://dev.to/czmilo/moltbot-the-ultimate-personal-ai-assistant-guide-for-2026-d4e) - Feature landscape
- [Alps Agility: Economics of Autonomy](https://www.alpsagility.com/cost-control-agentic-systems) - Token runaway
- [Menlo Security: AI Agents as Insider Threat](https://www.menlosecurity.com/blog/predictions-for-2026-why-ai-agents-are-the-new-insider-threat) - Prompt injection risks
- [The New Stack: Memory for AI Agents](https://thenewstack.io/memory-for-ai-agents-a-new-paradigm-of-context-engineering/) - Memory engineering
- [ISACA: Risky Code of Self-Modifying AI](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/unseen-unchecked-unraveling-inside-the-risky-code-of-self-modifying-ai) - Self-modification risks
- [Anthropic: Claude Code Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing) - Isolation patterns
- [Northflank: Code Execution Sandbox](https://northflank.com/blog/best-code-execution-sandbox-for-ai-agents) - Sandbox comparison
- [Jeff Bailey: What are Agent Skills](https://jeffbailey.us/blog/2026/01/24/what-are-agent-skills/) - Skills pattern
- [Medium: Skills Hooks Plugins How Anthropic Redefined AI Coding Tool Extensibility](https://medium.com/@hunterzhang86/skills-hooks-plugins-how-anthropic-redefined-ai-coding-tool-extensibility-72fb410fef2d) - Extensibility patterns

### Tertiary (LOW confidence, needs validation)

- [Better Stack: Best Node.js Schedulers](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) - node-cron comparison
- [Hostman: Polling vs Webhook](https://hostman.com/tutorials/difference-between-polling-and-webhook-in-telegram-bots/) - Deployment patterns
- [n8n Telegram AI Workflows](https://n8n.io/workflows/2986-all-in-one-telegrambaserow-ai-assistant-voicephotosave-noteslong-term-mem/) - Memory architecture examples
- [ChatBot.com: Common Chatbot Mistakes](https://www.chatbot.com/blog/common-chatbot-mistakes/) - Anti-patterns
- [AIMultiple: Chatbot Failures 2026](https://research.aimultiple.com/chatbot-fail/) - Failure cases
- [ISACA: Avoiding AI Pitfalls in 2026](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents) - Industry lessons
- [IEEE Spectrum: AI Coding Degrades](https://spectrum.ieee.org/ai-coding-degrades) - Quality degradation
- [Calibraint: LLM Development Services 2026](https://www.calibraint.com/blog/llm-development-services-in-2026) - 65% enterprise failures from context drift
- [CodeCondo: Automation Breakpoints 2026](https://codecondo.com/automation-breakpoints-5-critical-failures-2026/) - Cron failures
- [The Register: Claude Devs Complain](https://www.theregister.com/2026/01/05/claude_devs_usage_limits/) - Rate limit incidents

---

_Research completed: 2026-01-28_
_Ready for roadmap: yes_
