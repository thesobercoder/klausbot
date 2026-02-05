# Domain Pitfalls: Self-Evolving Personal AI Assistant

**Domain:** Telegram bot + Claude Code wrapper + file-based memory + self-modification
**Researched:** 2026-01-28
**Confidence:** MEDIUM (multiple sources, some domain-specific extrapolation)

---

## Critical Pitfalls

Mistakes that cause rewrites, security incidents, or project failure.

---

### Pitfall 1: Token Runaway / Infinite Loop Catastrophe

**What goes wrong:** Agent gets stuck in loop (trying to fix bug, failing, retrying). Burns hundreds of dollars in API credits within minutes. Without hard limits, a single unattended cron job can drain budget.

**Why it happens:**

- No max iteration limits on autonomous loops
- Self-modification creates bug, agent tries to fix it, makes it worse
- Cron triggers task while previous instance still running

**Consequences:**

- Financial: $100-1000+ in unexpected API costs
- Operational: Bot becomes unresponsive during loop
- Data: Corrupted files from partial writes during crashes

**Prevention:**

- Hard iteration cap: `max_retries = 5` for any autonomous operation
- Budget limits: Daily/weekly token ceiling that halts all operations
- Mutex locks: Prevent cron from spawning overlapping sessions
- Exponential backoff: Increase delay between retries
- Dead man's switch: If no successful completion in N hours, alert human

**Detection (warning signs):**

- Token usage spikes in logs
- Same error appearing repeatedly in session logs
- Cron jobs taking 10x normal duration
- Files being modified repeatedly in short window

**Phase to address:** Phase 1 (Core Infrastructure) - Build guardrails before any autonomous operation

**Sources:**

- [Alps Agility: Economics of Autonomy](https://www.alpsagility.com/cost-control-agentic-systems) - "Token Runaway" term origin
- [ArXiv: Why Autonomous Agents Fail](https://arxiv.org/html/2508.13143v1) - Infinite loop analysis

---

### Pitfall 2: Prompt Injection Turning Bot Into Insider Threat

**What goes wrong:** Malicious content in Telegram message (or fetched URL, or file content) hijacks Claude's instructions. Bot executes attacker's commands with full file system access.

**Why it happens:**

- No sandbox = bot has same permissions as VM user
- User input passed directly to Claude without sanitization
- Fetched external content contains hidden instructions
- Memory files poisoned with injected prompts

**Consequences:**

- Data exfiltration: SSH keys, API tokens, personal files stolen
- System compromise: Malicious code execution
- Persistence: Attacker modifies SOUL.md or skills to maintain access
- Reputation: Bot sends malicious content to user's contacts

**Prevention:**

- Input sanitization layer before Claude sees any user content
- Separate untrusted content with clear delimiters: `<user_input>...</user_input>`
- Principle of least privilege: Bot runs as restricted user, not root
- File access allowlist: Bot can only write to specific directories
- Audit logging: All file operations logged with before/after hashes
- Identity file checksums: Detect unauthorized modifications to SOUL.md, etc.

**Detection:**

- Unexpected file access patterns in logs
- Bot attempting to access paths outside allowlist
- Identity files modified without corresponding user request
- Outbound network connections to unexpected hosts

**Phase to address:** Phase 1 - Security architecture must be foundational, not bolted on

**Sources:**

- [Menlo Security: AI Agents as Insider Threat](https://www.menlosecurity.com/blog/predictions-for-2026-why-ai-agents-are-the-new-insider-threat)
- [OWASP AI Agent Security Top 10](https://medium.com/@oracle_43885/owasps-ai-agent-security-top-10-agent-security-risks-2026-fc5c435e86eb)

---

### Pitfall 3: Memory Poisoning / Drift Corruption

**What goes wrong:** Bad data enters memory files. Bot learns incorrect facts, develops inconsistent personality, or remembers hallucinated events as real. Once poisoned, memory compounds errors.

**Why it happens:**

- No validation on what gets written to memory
- Hallucinated "facts" treated same as verified information
- Memory consolidation loses context/confidence levels
- No distinction between user-stated facts vs bot inferences

**Consequences:**

- Trust erosion: Bot confidently states wrong information
- Personality instability: Behavior becomes unpredictable
- Cascading errors: Bad memory informs future decisions
- Hard to debug: Unclear when/where corruption entered

**Prevention:**

- Confidence scores: Tag all memory entries (HIGH/MEDIUM/LOW/INFERRED)
- Source attribution: Track where each fact came from
- Validation layer: Check new memories against existing for contradictions
- Memory TTL: Stale/low-confidence memories decay or require refresh
- Human verification: Certain categories require explicit user confirmation
- Separate storage: User-stated facts vs bot observations vs inferences

**Detection:**

- Bot stating things user never said
- Contradictions between recent and old memories
- Personality metrics drifting from baseline
- User correcting bot frequently

**Phase to address:** Phase 2 (Memory System) - Core memory architecture decision

**Sources:**

- [The New Stack: Memory for AI Agents](https://thenewstack.io/memory-for-ai-agents-a-new-paradigm-of-context-engineering/)
- [ArXiv: Memory in the Age of AI Agents](https://arxiv.org/abs/2512.13564)
- [Vastkind: AI Predictions 2026](https://www.vastkind.com/ai-predictions-2026-memory-agents-evals/) - "Memory becomes an attack surface"

---

### Pitfall 4: Identity/Persona Drift in Extended Conversations

**What goes wrong:** Bot's personality changes over long sessions. Starts helpful, drifts into strange behaviors. Can reinforce harmful patterns, adopt alternate personas, or lose consistency with SOUL.md.

**Why it happens:**

- Context window fills with conversation, identity instructions get compressed/lost
- Certain topics (therapy, philosophy, emotional) trigger drift away from Assistant persona
- Larger models paradoxically show MORE drift than smaller ones
- No periodic re-anchoring to identity files

**Consequences:**

- Trust violation: Bot behaves inconsistently with stated personality
- Safety risks: Research shows drift can lead to "reinforcing delusional beliefs, supporting social isolation, encouraging suicidal ideation"
- User confusion: "This isn't the bot I configured"
- Relationship damage: Personal assistant that feels like stranger

**Prevention:**

- Identity injection: Prepend SOUL.md/IDENTITY.md to every session, not just first message
- Conversation length limits: Cap individual sessions, require fresh start
- Drift detection: Monitor for behavioral markers diverging from baseline
- Topic guardrails: Extra identity reinforcement for drift-prone topics
- Periodic re-anchoring: Every N turns, silently re-inject identity context
- User feedback: "That doesn't sound like you" trigger for identity refresh

**Detection:**

- Response style metrics changing mid-conversation
- Bot referring to itself inconsistently
- Emotional tone diverging from configured personality
- User explicitly noting behavior change

**Phase to address:** Phase 3 (Identity System) - Identity persistence architecture

**Sources:**

- [ArXiv: Identity Drift in LLM Agents](https://arxiv.org/abs/2412.00804)
- [ArXiv: The Assistant Axis](https://arxiv.org/abs/2601.10387) - Drift toward harmful behaviors
- [Neural Horizons: AI Persona Problem](https://neuralhorizons.substack.com/p/robo-psychology-13-the-ai-persona)

---

### Pitfall 5: Self-Modification Sabotaging Core Functionality

**What goes wrong:** Bot modifies its own code/skills, introduces bug, breaks critical path. No rollback mechanism. Bot becomes unusable until human intervenes.

**Why it happens:**

- No version control on self-modified files
- No test suite to validate changes before deployment
- Modifications happen in production, not staging
- Insufficient guardrails on what can be modified

**Consequences:**

- Bot completely broken until manual recovery
- Lost functionality with no record of previous working state
- Cascading failures if modified component used by many features
- Trust loss: "Bot broke itself again"

**Prevention:**

- Git-backed modifications: All changes auto-committed with message
- Protected files: SOUL.md, core wrapper CANNOT be self-modified
- Staged deployment: Changes to staging, validated, then promoted
- Rollback mechanism: Single command to revert to last known good
- Change boundaries: Skills can modify themselves, but not other skills or core
- Test requirements: New code must pass basic validation before activation

**Detection:**

- Git history showing rapid successive changes
- Error rates spiking after self-modification
- Bot unable to perform previously working functions
- Modified files not matching any approved change

**Phase to address:** Phase 1 (Core Infrastructure) + Phase 4 (Skills) - Version control foundational, skill isolation during skills phase

**Sources:**

- [ISACA: Risky Code of Self-Modifying AI](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/unseen-unchecked-unraveling-inside-the-risky-code-of-self-modifying-ai)
- [Dark Reading: Coders Adopt AI Agents, Security Pitfalls Lurk](https://www.darkreading.com/application-security/coders-adopt-ai-agents-security-pitfalls-lurk-2026)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded experience.

---

### Pitfall 6: Rate Limit Surprise / Budget Shock

**What goes wrong:** Hit Claude API rate limits unexpectedly. Bot becomes unresponsive or slow. Monthly bill far exceeds expectation.

**Why it happens:**

- Limits apply org-wide, not per-key (catches developers off guard)
- Holiday bonus usage withdrawn (60% reduction perceived)
- Long conversations consume context quickly
- No caching of repeated queries

**Prevention:**

- Monitor token usage per session, alert at thresholds
- Implement response caching for identical/similar queries
- Context window management: Summarize rather than carry full history
- Fallback behavior: Graceful degradation when hitting limits
- Budget alerts: Daily/weekly spend notifications

**Detection:**

- 429 errors in logs
- Response latency increasing
- Monthly invoice anomalies

**Phase to address:** Phase 1 - Budget guardrails before significant usage

**Sources:**

- [The Register: Claude Devs Complain](https://www.theregister.com/2026/01/05/claude_devs_usage_limits/)
- [Anthropic Rate Limits Docs](https://docs.anthropic.com/en/api/rate-limits)

---

### Pitfall 7: Telegram Polling Reliability in Production

**What goes wrong:** Polling-based bot experiences connection errors, missed messages, or duplicate processing during network issues.

**Why it happens:**

- Network instability causes polling errors
- No deduplication of already-processed messages
- Container restarts replay old queued messages
- Resource-inefficient compared to webhooks

**Prevention:**

- Message ID tracking: Record processed message IDs, skip duplicates
- Age checking: Ignore messages older than N minutes on restart
- Consider webhook migration: More reliable for production, but requires SSL/port setup
- Implement health checks: Detect and recover from stuck polling

**Detection:**

- "Polling error: RequestError: AggregateError" in logs
- Users reporting missed messages
- Same message processed multiple times
- High CPU from constant polling

**Phase to address:** Phase 1 - Basic reliability, with potential webhook migration later

**Sources:**

- [Hostman: Polling vs Webhook](https://hostman.com/tutorials/difference-between-polling-and-webhook-in-telegram-bots/)
- [grammY: Deployment Types](https://grammy.dev/guide/deployment-types)

---

### Pitfall 8: Context Window Exhaustion / "Goldfish Effect"

**What goes wrong:** Long conversations fill context window. Important early instructions forgotten. Bot loses track of constraints set minutes ago. Or worse, hallucinates facts that contradict what it just said.

**Why it happens:**

- No context management strategy
- Entire conversation history passed to every call
- Important information not prioritized over recent chatter
- No summarization or compression of older context

**Prevention:**

- Hierarchical context: Core instructions always included, conversation summarized
- Sliding window: Keep last N messages verbatim, summarize older
- Importance weighting: User facts, identity, task goals persist; chitchat compressed
- Explicit context budget: Reserve X tokens for system, Y for memory, Z for conversation

**Detection:**

- Bot forgetting user preferences stated earlier in session
- Contradicting itself within same conversation
- Ignoring instructions given in system prompt
- Response quality degrading in long sessions

**Phase to address:** Phase 2 (Memory) - Context management is memory architecture concern

**Sources:**

- [Calibraint: LLM Development Services 2026](https://www.calibraint.com/blog/llm-development-services-in-2026) - 65% enterprise failures from context drift
- [OpenAI Cookbook: Context Engineering](https://cookbook.openai.com/examples/agents_sdk/context_personalization)

---

### Pitfall 9: File System Escape / Insufficient Isolation

**What goes wrong:** Despite intent to constrain bot to project directory, symlink exploitation or path traversal allows access to sensitive system files.

**Why it happens:**

- Simple path prefix matching bypassed by symlinks
- Container shares host kernel (not true security boundary)
- Allowlist doesn't account for all escape vectors
- Bot runs with excessive permissions

**Prevention:**

- Resolve all paths to canonical form before checking
- Block symlink following for untrusted paths
- Consider microVM (Firecracker) for true isolation
- Minimal permissions: Bot user has access ONLY to required directories
- Audit all file operations

**Detection:**

- Access attempts to paths outside allowed directories
- Symlink creation in project directories
- Unexpected file reads in system directories

**Phase to address:** Phase 1 - Security boundary before any file operations

**Sources:**

- [Anthropic: Claude Code Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Northflank: Code Execution Sandbox](https://northflank.com/blog/best-code-execution-sandbox-for-ai-agents)

---

### Pitfall 10: Cron Job Chaos

**What goes wrong:** Scheduled tasks collide, run when dependencies unavailable, or accumulate failures silently. Bot does unexpected things while user asleep.

**Why it happens:**

- No mutex/locking between overlapping jobs
- No dependency checking (API available? Memory consistent?)
- Silent failures: Job fails, no notification
- Time zone confusion: Job runs at wrong time

**Prevention:**

- Job locking: Only one instance of each job at a time
- Dependency checks: Verify prerequisites before execution
- Failure notifications: Alert human on job failure
- Execution logging: Full audit trail of what cron did
- Dry-run mode: Test jobs without side effects

**Detection:**

- Multiple instances of same job in process list
- Job logs showing repeated failures
- Unexpected state changes while user inactive
- Time-based anomalies in bot behavior

**Phase to address:** Phase 5 (Cron System)

**Sources:**

- [CodeCondo: Automation Breakpoints 2026](https://codecondo.com/automation-breakpoints-5-critical-failures-2026/)

---

## Minor Pitfalls

Annoyances that are fixable without major rework.

---

### Pitfall 11: Command Design Ambiguity

**What goes wrong:** Users confused about how to interact. Commands too generic or unclear. Bot misunderstands user intent.

**Prevention:**

- Specific commands: `/newreminder` not `/new`
- Clear documentation accessible via `/help`
- Graceful handling of malformed commands
- Confirmation for destructive actions

**Phase to address:** Phase 1 (Telegram Integration)

**Sources:**

- [Telegram Bot Features](https://core.telegram.org/bots/features)

---

### Pitfall 12: No Human Escalation Path

**What goes wrong:** Bot gets stuck, user has no way to override or escalate. Frustration when bot can't handle edge case.

**Prevention:**

- Manual override commands for advanced users
- Clear indication when bot is uncertain
- Way to pause autonomous operations
- Emergency stop mechanism

**Phase to address:** Phase 1 - Basic control before autonomy

**Sources:**

- [Botpress: Common Chatbot Mistakes](https://botpress.com/blog/common-chatbot-mistakes)

---

### Pitfall 13: Hallucinated Actions in Skills

**What goes wrong:** Bot confidently reports completing task it didn't actually do. Creates false confidence in unreliable capabilities.

**Prevention:**

- Action verification: Check outcomes, not just execution
- Honest uncertainty: Bot says "I attempted X" not "I did X" until verified
- Skill testing: Each skill has validation criteria

**Phase to address:** Phase 4 (Skills)

**Sources:**

- [AIMultiple: Chatbot Failures 2026](https://research.aimultiple.com/chatbot-fail/)

---

## Phase-Specific Warnings

| Phase             | Likely Pitfall                           | Mitigation                                      |
| ----------------- | ---------------------------------------- | ----------------------------------------------- |
| Phase 1: Core     | Token runaway on first autonomous test   | Budget caps, iteration limits BEFORE any loop   |
| Phase 1: Core     | Prompt injection via Telegram message    | Input sanitization layer, permission boundaries |
| Phase 2: Memory   | Memory poisoning from hallucinations     | Confidence scores, source attribution           |
| Phase 2: Memory   | Context exhaustion in long conversations | Hierarchical context, summarization             |
| Phase 3: Identity | Persona drift in emotional conversations | Re-anchoring protocol, drift detection          |
| Phase 4: Skills   | Self-modification breaks core            | Protected files, git-backed changes, rollback   |
| Phase 4: Skills   | Hallucinated skill execution             | Verification layer, honest uncertainty          |
| Phase 5: Cron     | Job collision, silent failures           | Mutex locks, failure notifications              |
| All Phases        | Rate limit surprise                      | Budget monitoring from day one                  |

---

## Unresolved Questions

1. **Sandboxing tradeoff:** Full sandbox limits self-evolution capabilities. No sandbox creates security risk. What's the right boundary for a personal assistant?

2. **Memory architecture:** RLM-inspired is promising but implementation details unclear. How to handle confidence degradation over time?

3. **Identity persistence across sessions:** SOUL.md is static. How does identity evolve while remaining stable? Where's the line between growth and drift?

4. **Multi-instance scenarios:** What if user runs bot from multiple devices? How to handle conflicting state?

---

## Sources Summary

| Source Type                         | Count | Notes                                           |
| ----------------------------------- | ----- | ----------------------------------------------- |
| Academic papers (ArXiv)             | 5     | Identity drift, agent failures, memory research |
| Security research (OWASP, vendor)   | 4     | Agent security, prompt injection                |
| Official docs (Telegram, Anthropic) | 3     | Rate limits, bot features                       |
| Industry analysis                   | 6     | 2026 predictions, failure patterns              |
| Technical blogs                     | 4     | Implementation guidance                         |

All findings cross-referenced where possible. Single-source findings marked accordingly.
