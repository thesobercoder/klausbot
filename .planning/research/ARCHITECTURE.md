# Architecture Patterns

**Domain:** Personal AI Assistant (Telegram + Claude Code)
**Researched:** 2026-01-28
**Confidence:** MEDIUM-HIGH

## Recommended Architecture

```
                                    +------------------+
                                    |    Telegram      |
                                    |   Bot API        |
                                    +--------+---------+
                                             |
                                             | Long Polling
                                             v
+------------------+              +----------+-----------+
|   Identity       |              |      Gateway         |
|   Files          |<------------>|    (Node.js)         |
| SOUL.md          |   reads      +----------+-----------+
| IDENTITY.md      |              |          |
| USER.md          |              |   +------+------+
| LEARNINGS.md     |              |   |             |
+------------------+              |   v             v
                                  | Cron        Message
+------------------+              | Scheduler   Router
|   Memory         |              |   |             |
|   Files          |              |   v             v
| conversations/   |<-------------+ +------+  +----------+
| memory/          |              | | Job  |  | Session  |
| context/         |              | | Queue|  | Spawner  |
+------------------+              | +------+  +----+-----+
                                  |                |
+------------------+              |                | spawn per message
|   Skills         |              |                v
| .claude/skills/  |<-------------+     +----------+-----------+
| reusable/        |              |     |   Claude Agent SDK   |
+------------------+              |     |   (Python/TS)        |
                                  |     +----------+-----------+
                                  |                |
                                  +----------------+
```

### Component Boundaries

| Component                | Responsibility                                                                             | Communicates With                                                |
| ------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **Gateway**              | Long-running daemon. Polls Telegram, routes messages, manages cron, spawns Claude sessions | Telegram API, Agent Sessions, File System                        |
| **Session Spawner**      | Creates Claude Agent SDK sessions per message. Manages tool permissions, working directory | Gateway (receives messages), Agent SDK (spawns)                  |
| **Claude Agent Session** | Executes user request. Reads/writes files. Has full tool access. Terminates after task     | Identity Files, Memory Files, Skills, Gateway (returns response) |
| **Identity Files**       | Static-ish personality definition. Written during bootstrap, rarely updated after          | Read by every session                                            |
| **Memory Files**         | Conversation history, learned context. Frequently updated by sessions                      | Read/written by sessions                                         |
| **Skills System**        | Reusable task patterns in markdown. Claude selects and uses based on task                  | Read by sessions, created by sessions                            |
| **Cron Scheduler**       | Stores scheduled tasks, triggers at specified times                                        | Gateway (stores/triggers), spawns sessions for execution         |

### Data Flow

**Inbound Message Flow:**

```
User sends Telegram message
    -> Gateway receives via long polling
    -> Gateway spawns Claude Agent SDK session
    -> Session reads: SOUL.md, IDENTITY.md, USER.md, LEARNINGS.md
    -> Session reads: recent conversation history (agentic file access)
    -> Session processes user message with full context
    -> Session reads/uses relevant Skills if applicable
    -> Session produces response
    -> Session optionally updates: USER.md, LEARNINGS.md, conversation log
    -> Gateway sends response to Telegram
    -> Session terminates
```

**Cron Task Flow:**

```
Cron scheduler triggers at scheduled time
    -> Gateway spawns Claude Agent SDK session with task instruction
    -> Session executes task (may involve file access, web, etc.)
    -> Session produces result
    -> Gateway optionally sends result to Telegram
    -> Session terminates
```

**Bootstrap Flow (First Run):**

```
User sends first message
    -> Gateway detects no IDENTITY.md exists
    -> Gateway spawns session with BOOTSTRAP.md as system context
    -> Session conducts onboarding conversation
    -> Session creates: IDENTITY.md, SOUL.md, USER.md
    -> Session deletes BOOTSTRAP.md
    -> Normal operation begins
```

## Patterns to Follow

### Pattern 1: Stateless Session + File-Based State

**What:** Each Claude session is stateless. All state lives in files. Session reads files at start, writes files at end.

**Why:**

- RLM paper insight: store context in environment, not in LLM context window
- Claude Agent SDK sessions are ephemeral by design
- Files provide durable, inspectable, Git-trackable state

**Example:**

```typescript
// Gateway spawns session
const session = await query({
  prompt: userMessage,
  options: {
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    systemPrompt: `
      You are ${identityFromFile}.
      Read your identity files first: SOUL.md, IDENTITY.md, USER.md
      Read recent conversation from conversations/${today}.md
      After responding, update relevant files.
    `,
  },
});
```

**Source:** [RLM Paper](https://arxiv.org/html/2512.24601v1) - context as environment variable pattern

### Pattern 2: Gateway as Single Daemon

**What:** One long-running process owns all external connections (Telegram) and spawns sessions as needed.

**Why:**

- Telegram long polling requires persistent connection
- Cron needs always-on scheduler
- Single process simplifies state management

**Implementation:**

```typescript
// Gateway main loop (simplified)
class Gateway {
  private scheduler: CronScheduler;
  private telegram: TelegramClient;

  async start() {
    this.scheduler = new CronScheduler(this.executeTask.bind(this));
    this.telegram = new TelegramClient(BOT_TOKEN);

    // Main polling loop
    for await (const message of this.telegram.pollUpdates()) {
      this.handleMessage(message); // non-blocking spawn
    }
  }

  async handleMessage(msg: TelegramMessage) {
    const response = await this.spawnSession(msg.text);
    await this.telegram.sendMessage(msg.chatId, response);
  }
}
```

**Source:** [Moltbot Architecture](https://docs.molt.bot/concepts/architecture) - Gateway daemon pattern

### Pattern 3: Agentic Context Reconstruction

**What:** Don't pass full conversation history in prompt. Let Claude agentic-ally read what it needs.

**Why:**

- Avoids context window limits
- Claude decides relevance
- Matches RLM "peek at subsets" approach

**How:**

```markdown
# System Prompt

You wake up fresh each session. Your identity files are your persistent self:

- Read SOUL.md for your core values
- Read IDENTITY.md for your surface attributes
- Read USER.md for user context
- Read conversations/YYYY-MM-DD.md for today's conversation history
- Read LEARNINGS.md for past mistakes to avoid

Read what you need. Don't load everything at once.
```

**Source:** [RLM Paper](https://arxiv.org/html/2512.24601v1), [Anthropic Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)

### Pattern 4: Skills as Markdown Instructions

**What:** Store reusable task patterns as markdown files in `.claude/skills/`. Claude reads and follows them.

**Why:**

- No code execution needed
- Human-readable and editable
- Claude can create new skills
- Matches Claude Code's built-in skill system

**Structure:**

```
.claude/skills/
  send-email.md       # How to compose and send emails
  research-topic.md   # How to research a topic
  schedule-reminder.md # How to create reminders
```

**Skill File Format:**

```markdown
# Skill: Research Topic

## When to Use

When user asks to research something, learn about something, or investigate a topic.

## Steps

1. Formulate search queries
2. Use WebSearch to find sources
3. Use WebFetch to read key sources
4. Synthesize findings
5. Present summary with sources

## Output Format

Structured summary with:

- Key findings (3-5 bullets)
- Sources with URLs
- Confidence assessment
```

**Source:** [Claude Code Skills](https://code.claude.com/docs/en/skills), [Moltbot Skills Pattern](https://docs.molt.bot/)

### Pattern 5: Plaintext Cron Storage

**What:** Store scheduled tasks as simple files, not database rows.

**Why:**

- Claude can read/write them directly
- Human inspectable
- No database dependency

**Structure:**

```
cron/
  daily-standup.md    # "Every day at 9am, ask about today's priorities"
  weekly-review.md    # "Every Sunday at 8pm, summarize the week"
```

**Cron File Format:**

```markdown
# Task: Daily Standup

**Schedule:** 0 9 \* \* \*
**Created:** 2026-01-15
**Last Run:** 2026-01-28

## Instruction

Ask me about my priorities for today. Reference yesterday's accomplishments from conversations/yesterday.md.

## Response Channel

Send result to Telegram.
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding Full History in Prompt

**What:** Passing entire conversation history as system/user prompt each request.

**Why bad:**

- Context window fills up fast
- Costs scale linearly with history size
- Can't handle infinite conversation
- Violates RLM principle

**Instead:** Agentic file reading. Claude reads what it needs from conversation files.

### Anti-Pattern 2: Webhook for Telegram

**What:** Using Telegram webhooks instead of long polling.

**Why bad for this use case:**

- Requires public HTTPS endpoint
- More complex infrastructure
- VM may not have stable public IP
- Overkill for single-user bot

**Instead:** Long polling. Simple, works behind NAT, no SSL needed.

**Exception:** If deploying to serverless/cloud function, webhooks become appropriate.

**Source:** [grammY Deployment Types](https://grammy.dev/guide/deployment-types)

### Anti-Pattern 3: Persistent Claude Session

**What:** Trying to keep a single Claude session running across messages.

**Why bad:**

- Agent SDK sessions are designed to be ephemeral
- Context accumulates unboundedly
- No clean way to manage session lifecycle
- Crashes lose everything

**Instead:** New session per message. State in files. Session reads files, does work, writes files, terminates.

### Anti-Pattern 4: Database for Identity/Memory

**What:** Storing identity and memory in SQLite/Postgres instead of files.

**Why bad for this use case:**

- Claude can't directly read/write SQL
- Extra abstraction layer needed
- Harder to inspect/debug
- Overkill for single-user

**Instead:** Markdown files. Claude reads/writes directly. Human can inspect.

**When database IS appropriate:**

- Multi-user scenario
- High-frequency writes causing file conflicts
- Complex relational queries needed

### Anti-Pattern 5: Over-Complicated Skill Selection

**What:** Building ML-based intent classification to route to skills.

**Why bad:**

- Claude's reasoning is better than external classifiers
- Extra moving parts
- Skill descriptions in prompt sufficient

**Instead:** List available skills in system prompt. Let Claude decide.

**Source:** [Anthropic Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) - "The decision happens inside Claude's forward pass"

## Scalability Considerations

| Concern             | Single User (Target) | Notes                                |
| ------------------- | -------------------- | ------------------------------------ |
| Message Volume      | ~100/day             | Long polling fine, no queue needed   |
| Context Size        | Unlimited via files  | RLM approach handles this            |
| Concurrent Sessions | 1-2                  | Sequential is fine                   |
| File Access         | Local filesystem     | Fast, simple                         |
| Memory Growth       | ~1MB/week            | Prune old conversations periodically |

**Not designed for:**

- Multi-user (would need user isolation)
- High concurrency (would need message queue)
- Mobile/edge deployment (needs VM/server)

## Build Order Implications

Based on component dependencies:

**Phase 1: Foundation**

- Gateway process (can exist without Claude)
- Telegram polling (tests external connection)
- Basic file structure

**Phase 2: Core Loop**

- Claude Agent SDK integration (can test without Telegram)
- Session spawning per message
- Response flow back to Telegram

**Phase 3: Identity**

- Identity file structure
- Bootstrap flow
- System prompt construction

**Phase 4: Memory**

- Conversation persistence
- Agentic file reading
- Context reconstruction

**Phase 5: Advanced**

- Cron scheduler
- Skills system
- Self-improvement loop

**Rationale:**

- Gateway and Telegram first: validates external integration
- Claude integration second: validates core capability
- Identity before memory: establishes "who" before "what remembers"
- Cron and skills last: depends on everything else working

## Sources

**HIGH Confidence:**

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview) - Official, current
- [Claude Code Headless Mode](https://code.claude.com/docs/en/headless) - Official, current
- [Anthropic Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) - Official research

**MEDIUM Confidence:**

- [RLM Paper](https://arxiv.org/html/2512.24601v1) - Academic, verified concepts
- [Moltbot Documentation](https://docs.molt.bot/concepts/architecture) - Third-party but production-tested
- [grammY Deployment Types](https://grammy.dev/guide/deployment-types) - Library documentation

**LOW Confidence (WebSearch only):**

- Specific library version comparisons - verify before adopting
