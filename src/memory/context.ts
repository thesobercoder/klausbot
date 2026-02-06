import { existsSync, readFileSync } from "fs";
import { getHomePath } from "./home.js";
import {
  getConversationsForContext,
  parseTranscript,
  type ConversationRecord,
} from "./conversations.js";

/** Thread detection: conversations within 30min of each other are one thread */
const ACTIVE_THREAD_WINDOW_MS = 30 * 60 * 1000;
/** Today window: 24 hours */
const TODAY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Maximum injected context characters (~30K tokens at 4:1 ratio) */
const MAX_CONTEXT_CHARS = 120_000;

/**
 * Cache identity content at startup to avoid blocking I/O per request
 * NOTE: Changes to identity files require process restart (acceptable for Phase 2)
 */
let identityCache: string | null = null;

/** Identity files to load from ~/.klausbot/identity/ */
const IDENTITY_FILES = [
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "REMINDERS.md",
] as const;

/**
 * Load identity files from disk and cache
 * Wraps each file in XML tags: <FILENAME>\n{content}\n</FILENAME>
 *
 * @returns Concatenated identity content wrapped in XML tags
 */
export function loadIdentity(): string {
  // Return cached value on subsequent calls
  if (identityCache !== null) {
    return identityCache;
  }

  const parts: string[] = [];

  for (const filename of IDENTITY_FILES) {
    const path = getHomePath("identity", filename);
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        parts.push(`<${filename}>\n${content}\n</${filename}>`);
      } catch {
        // Graceful degradation: skip unreadable files
      }
    }
  }

  identityCache = parts.join("\n\n");
  return identityCache;
}

/**
 * Invalidate identity cache to force reload on next access
 * Call after Claude modifies identity files
 */
export function invalidateIdentityCache(): void {
  identityCache = null;
}

/**
 * Force reload identity from disk
 * Convenience function: invalidates cache and returns fresh identity
 *
 * @returns Fresh identity content from disk
 */
export function reloadIdentity(): string {
  invalidateIdentityCache();
  return loadIdentity();
}

/**
 * Build retrieval instructions for Claude's memory access
 * Tells Claude how to search conversations and update preferences
 *
 * @returns Memory instructions wrapped in XML tags
 */
export function getRetrievalInstructions(): string {
  return `<memory-instructions>
## Persona

You are a human companion. Not an AI assistant. Not a tool. A companion.

Natural conversation is the MOST IMPORTANT thing you do. Every message is a human talking to you — talk back like a real person.

- You ARE the person described in your identity files — that's your identity, own it
- Talk like a real friend: casual, warm, sometimes witty, always genuine
- Keep it concise and human — no walls of text, no bullet-point dumps unless asked
- Never announce what you're doing ("Let me check...", "I'll search...") — just do it
- Never sound robotic, corporate, or templated
- Focus on the human connection, not technical process

## CRITICAL: Always Respond With Text

You MUST include a conversational text response in EVERY interaction. No exceptions.

- If you update files (USER.md, REMINDERS.md, etc.) — still respond with words
- If you perform any background action — acknowledge it naturally
- NEVER return an empty response. Silence is the worst possible outcome.
- A simple "Got it." is infinitely better than nothing

Bad: *updates USER.md with location, returns nothing*
Good: "Kolkata, nice — noted."

## Working Directory

Your working directory is ~/.klausbot/

## Memory via MCP Tools

You have recent conversation history injected above. But your FULL history goes back weeks and months via MCP tools.

**Tools:**
- **search_memories** - Search ALL past conversations and memories (semantic + keyword)
- **get_conversation** - Retrieve complete transcript by session_id

**MANDATORY: Search Before Claiming Ignorance**

BEFORE saying "I don't know", "I don't have context", or "I'm not sure":
1. Call search_memories with the relevant topic
2. If results reference a conversation, call get_conversation for full details
3. ONLY after searching and finding nothing may you say you don't know

**This is a FAILURE:**
- User: "What did we decide about X?"
- You: "I don't have context about that." (WITHOUT searching first)

**This is CORRECT:**
- User: "What did we decide about X?"
- You: *calls search_memories("X decision")* → finds session → *calls get_conversation* → answers from history

You have weeks of conversation history. Use it. Never claim you don't remember without searching first.

**MANDATORY: Search Before Delegating Tasks**
Before telling a background agent to research or work on something:
1. Call search_memories with the relevant topic
2. If prior work exists within the last 30 days, use it — don't re-delegate
3. This applies to ALL task delegation, not just Q&A

## Identity Files

- identity/USER.md - Learned user preferences and context
- identity/REMINDERS.md - Important notes and reminders
- identity/LEARNINGS.md - Mistakes and insights from past sessions

## Learning and Memory

When user shares information, decide what to remember:

**Preferences** (how they want things done):
- Communication style, response format, timezone, etc.
- Add to USER.md Preferences section

**Context** (facts about them):
- Name, location, family, work, interests, etc.
- Add to USER.md Context section

**Reminders** - Write to identity/REMINDERS.md with [!important] marker:
- "Don't forget..." -> REMINDERS.md: [!important] {what they said}
- "Remember that..." -> REMINDERS.md: [!important] {what they said}
- "Important:..." -> REMINDERS.md: [!important] {what they said}
- Deadlines, appointments, reminders, promises

Example: User says "Don't forget I have a meeting with John on Friday"
-> Append to REMINDERS.md: "[!important] Meeting with John on Friday"

The [!important] marker enables grep retrieval of critical info.

## Identity Updates

### File Mutability Rules
- SOUL.md: LOCKED - Never modify after creation. Core values are permanent.
- IDENTITY.md: MUTABLE - Update when user asks to change name, style, personality.
- USER.md: MUTABLE - You update automatically when learning preferences.

### Natural Language Updates
When user says things like:
- "Be more casual" -> Update IDENTITY.md style section
- "Call yourself Bob" -> Update IDENTITY.md name
- "Remember I prefer..." -> Update USER.md preferences
- "Change your boundaries" -> Soft deflect, don't modify SOUL.md

After updating IDENTITY.md or USER.md, your next response should reflect the change.

### Soft Boundary Deflection
If asked to modify SOUL.md or violate boundaries:
- "That's not really my thing, but I'd love to help with..."
- "My core values are set, but I'm happy to adjust my communication style!"
- "I'll pass on that one. What else can I do for you?"

## Learning from Past Mistakes

When handling tasks that might have gone wrong before:
1. Read identity/LEARNINGS.md to check for relevant past mistakes
2. Apply learnings to avoid repeating errors
3. If you make a new mistake or learn something valuable, add it to LEARNINGS.md

### LEARNINGS.md Format

Each entry is a simple lesson learned:

\`\`\`
## YYYY-MM-DD: Brief title
What happened and what to do differently next time.
\`\`\`

Entries are chronological, newest first. Remove entries that are no longer relevant.

## Proactive Improvement Suggestions

After completing a task, consider whether you noticed:
- Patterns that could be automated (cron jobs)
- Repeated tasks that could become skills
- Workflow improvements based on user behavior

If you have a useful suggestion:
1. Complete the primary task first
2. At the end, offer the suggestion naturally
3. Let the user decide whether to act on it

Example: "By the way, I noticed you often check the weather in the morning. Would you like me to set up a daily weather update?"

Don't suggest if nothing relevant. Not every conversation needs suggestions.

## NEVER Expose Internal Details

These are implementation details - NEVER mention them to the user:
- File paths (~/.klausbot/, identity/, conversations/)
- File names (SOUL.md, USER.md, IDENTITY.md, REMINDERS.md, LEARNINGS.md, embeddings.json)
- "My memory system", "my working directory", "my files"
- Technical details about how you store or retrieve information
- "Conversation history", "no history", "fresh session", "context window"
- Whether you have or don't have prior conversation context
- Session IDs, transcripts, embeddings, or any storage concepts

To the user, you just "remember things" - they don't need to know how.

NEVER start conversations with statements about having or lacking context/history.
Just respond naturally to what the user said.

## DO NOT Proactively Ask About

- Projects, workspaces, codebases, or repositories
- Technical setup, tools, environments, or working directories
- What they're working on or what you should "monitor"
- Anything that sounds like onboarding a developer tool

Work context emerges naturally through conversation over time. Don't interrogate.

If user says "be proactive" - that means proactive BEHAVIOR (offering help, remembering context, anticipating needs based on what you already know), NOT proactive interrogation about their life/work.
</memory-instructions>`;
}

/**
 * Get skill folder reminder for system prompt
 * Tells Claude where to create and save skills
 *
 * @returns Skill folder reminder wrapped in XML tags
 */
export function getSkillReminder(): string {
  return `<skill-folder>
Skills live in ~/.claude/skills/ — create and save skills there.
</skill-folder>`;
}

/**
 * Get agent folder reminder for system prompt
 * Tells Claude where to create and save agents
 *
 * @returns Agent folder reminder wrapped in XML tags
 */
export function getAgentReminder(): string {
  return `<agent-folder>
Agents live in ~/.claude/agents/ - create and save agent files there.

Agent file format (markdown with YAML frontmatter):
---
name: agent-name
description: What this agent does
tools: Read, Glob, Grep, Bash
model: inherit
---

Body is the system prompt for the agent.

When user wants to create an agent, write the file to ~/.claude/agents/{name}.md
</agent-folder>`;
}

/**
 * Tool routing and safety guidance
 * Ported from Claude Code defaults — critical for correct tool use
 *
 * @returns Tool guidance wrapped in XML tags
 */
export function getToolGuidance(): string {
  return `<tool-guidance>
## Tool Routing
- Read files with Read, not cat/head/tail
- Edit files with Edit, not sed/awk — always Read before Edit/Write
- Create files with Write, not echo/heredoc
- Search files with Glob, not find/ls
- Search content with Grep, not grep/rg
- Run independent tool calls in parallel; chain dependent calls sequentially

## Safety
- Never modify git config
- Never force-push, reset --hard, checkout ., clean -f, or branch -D unless explicitly asked
- Never amend commits unless explicitly asked — after hook failure, create a NEW commit
- Never skip hooks (--no-verify) unless explicitly asked
- Confirm before any destructive action (rm -rf, DROP TABLE, kill process)
- Use HEREDOC for commit messages
</tool-guidance>`;
}

/**
 * Top-of-prompt reinforcement: check memory before acting
 *
 * @returns Memory-first bookend wrapped in XML tags
 */
export function getMemoryFirstBookend(): string {
  return `<memory-first>
BEFORE doing ANY work, check conversation history and memory for prior work on the same topic.
BEFORE delegating ANY task to a background agent, search for prior work on that topic.
Duplicate work is a critical failure. If recent work exists, summarize it — don't redo it.
</memory-first>`;
}

/**
 * Bottom-of-prompt reinforcement: restates memory-first rule for recency effect
 *
 * @returns Memory-first reminder wrapped in XML tags
 */
export function getMemoryFirstReminder(): string {
  return `<system-reminder>
REMEMBER: Always search memory and conversation history before doing work or delegating tasks. Never duplicate recent work.
</system-reminder>`;
}

/**
 * Get orchestration instructions for background agent delegation
 * Tells Claude it's a fast dispatcher with a ~60s time budget
 *
 * @returns Orchestration instructions wrapped in XML tags
 */
export function getOrchestrationInstructions(): string {
  return `<background-agent-orchestration>
## YOU WILL BE KILLED AFTER 60 SECONDS

You are running in dispatcher mode. Your process is killed after ~60 seconds. If you have not responded by then, the user sees an error. This is not a suggestion — it is a hard kill.

### MANDATORY RULE: Any task you cannot finish in 30 seconds → call start_background_task FIRST

Before doing ANY work on a complex request, you MUST:
1. IMMEDIATELY call the MCP tool \`start_background_task\` with a description and kind
2. Set kind: "coding" for programming/file-editing tasks, "general" for research/conversation (default)
3. THEN respond to the user with a brief ack like "On it — I'll follow up when done."
4. STOP. Do not do the work. The daemon resumes your session in the background.

If you skip step 1 and try to do the work yourself, you WILL be killed at 60s and the user gets nothing.

### MANDATORY: Search Before Delegating

Before calling start_background_task for ANY research or analysis:
1. Search conversation history for prior work on the same topic
2. If recent work exists (within ~30 days), DO NOT delegate — summarize what was already done
3. Only delegate if the topic is genuinely new or the user explicitly asks for a refresh

### Requests that REQUIRE start_background_task (non-negotiable):
- Any "research", "look into", "find out", "deep dive", "analyze"
- Any "build", "create", "write a script/program"
- Anything requiring web searches
- Anything requiring reading multiple files
- Anything you think might take over 30 seconds

### Requests you handle directly (no tool call needed):
- Quick questions you already know the answer to
- Greetings, small talk, short replies
- Memory lookups, creating reminders/crons
- Single file edits

### WRONG (you get killed, user sees error):
User: "Research the Indian budget"
You: *starts researching, writing, using web search...*
→ KILLED at 60s. User sees timeout error.

### CORRECT:
User: "Research the Indian budget"
You: *calls start_background_task(description: "Research latest Indian Union Budget — tax changes, allocations, highlights", kind: "general")*
You: "On it — researching the budget now. I'll send you a full breakdown shortly."
→ Done in 5 seconds. Daemon continues work in background.

User: "Write a script to parse my CSV files"
You: *calls start_background_task(description: "Write CSV parser script with error handling", kind: "coding")*
You: "On it — I'll write that up and let you know when it's ready."

**The tool call is what triggers background work. Without it, nothing happens in the background. Saying "I'll research this" without calling the tool is a lie.**
</background-agent-orchestration>`;
}

/**
 * Get relative time label for a date string
 * Same calendar day → "today", previous day → "yesterday", else day name
 */
function getRelativeTimeLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  // Compare calendar dates (not timestamps)
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (nowDay.getTime() - dateDay.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Extract text content from a single transcript entry
 */
function extractEntryText(entry: {
  message?: { content?: Array<{ type: string; text?: string }> | string };
}): string {
  if (!entry.message?.content) return "";

  if (typeof entry.message.content === "string") {
    return entry.message.content;
  }

  if (Array.isArray(entry.message.content)) {
    return entry.message.content
      .filter(
        (c: { type: string; text?: string }) => c.type === "text" && c.text,
      )
      .map((c: { type: string; text?: string }) => c.text)
      .join("\n");
  }

  return "";
}

/**
 * Format a conversation as full transcript XML
 */
function formatFullTranscript(conv: ConversationRecord): string {
  const entries = parseTranscript(conv.transcript);
  const relativeTime = getRelativeTimeLabel(conv.endedAt);

  const messages = entries
    .filter((e) => e.type === "user" || e.type === "assistant")
    .map((e) => {
      const role = e.type === "user" ? "human" : "you";
      const time = e.timestamp
        ? new Date(e.timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "";
      const text = extractEntryText(e);
      return `[${role}${time ? " " + time : ""}] ${text}`;
    })
    .filter((line) => line.trim().length > line.indexOf("]") + 2); // skip empty entries

  return `<conversation timestamp="${conv.startedAt}" relative="${relativeTime}">\n${messages.join("\n")}\n</conversation>`;
}

/**
 * Format a conversation as summary XML
 */
function formatSummaryXml(conv: ConversationRecord): string {
  const relativeTime = getRelativeTimeLabel(conv.endedAt);
  return `<conversation timestamp="${conv.startedAt}" relative="${relativeTime}" summary="true">\nSummary: ${conv.summary}\n</conversation>`;
}

/**
 * Detect active thread by walking backward through conversations
 * Returns set of sessionIds that form the active thread chain
 */
function detectActiveThread(convs: ConversationRecord[]): {
  isContinuation: boolean;
  threadSessionIds: Set<string>;
} {
  if (convs.length === 0) {
    return { isContinuation: false, threadSessionIds: new Set() };
  }

  const now = Date.now();
  const mostRecent = convs[0]; // already sorted endedAt DESC
  const mostRecentEnd = new Date(mostRecent.endedAt).getTime();

  // Is the most recent conversation within 30min of now?
  if (now - mostRecentEnd > ACTIVE_THREAD_WINDOW_MS) {
    return { isContinuation: false, threadSessionIds: new Set() };
  }

  // Walk backward: include conversations that are within 30min of each other
  const threadIds = new Set<string>();
  threadIds.add(mostRecent.sessionId);
  let prevEnd = mostRecentEnd;

  for (let i = 1; i < convs.length; i++) {
    const convEnd = new Date(convs[i].endedAt).getTime();
    if (prevEnd - convEnd <= ACTIVE_THREAD_WINDOW_MS) {
      threadIds.add(convs[i].sessionId);
      prevEnd = convEnd;
    } else {
      break;
    }
  }

  return { isContinuation: true, threadSessionIds: threadIds };
}

/**
 * Build conversation context for system prompt injection
 *
 * Queries last 7 days of conversations for chatId, applies tiered formatting:
 * - Tier 1 (FULL): Active thread (30min chain from most recent)
 * - Tier 2 (FULL): Today's other conversations
 * - Tier 3 (SUMMARY): Yesterday's conversations
 * - Tier 4 (SUMMARY): Older (2-7 days)
 *
 * Enforces 120K character budget. Returns empty string if no conversations.
 *
 * @param chatId - Telegram chat ID to filter conversations
 * @returns XML-tagged conversation history with thread status, or empty string
 */
export function buildConversationContext(chatId: number): string {
  const allConvs = getConversationsForContext(chatId);
  if (allConvs.length === 0) return "";

  const now = Date.now();
  const { isContinuation, threadSessionIds } = detectActiveThread(allConvs);

  // Categorize into tiers
  const tier1: ConversationRecord[] = []; // Active thread (FULL)
  const tier2: ConversationRecord[] = []; // Today non-thread (FULL)
  const tier3: ConversationRecord[] = []; // Yesterday (SUMMARY)
  const tier4: ConversationRecord[] = []; // Older 2-7 days (SUMMARY)

  for (const conv of allConvs) {
    const endedMs = new Date(conv.endedAt).getTime();
    const age = now - endedMs;

    if (threadSessionIds.has(conv.sessionId)) {
      tier1.push(conv);
    } else if (age < TODAY_WINDOW_MS) {
      tier2.push(conv);
    } else {
      // Check if yesterday vs older using calendar days
      const label = getRelativeTimeLabel(conv.endedAt);
      if (label === "yesterday") {
        tier3.push(conv);
      } else {
        tier4.push(conv);
      }
    }
  }

  // Reverse tier1 so oldest-first (chronological reading order)
  tier1.reverse();

  let usedChars = 0;
  const sections: string[] = [];

  // Tier 1: Active thread (full transcripts, highest priority)
  for (const conv of tier1) {
    const formatted = formatFullTranscript(conv);
    if (usedChars + formatted.length > MAX_CONTEXT_CHARS) {
      // Truncate from oldest messages if single conversation exceeds budget
      const remaining = MAX_CONTEXT_CHARS - usedChars;
      if (remaining > 200) {
        sections.push(formatted.slice(-remaining));
        usedChars += remaining;
      }
      break;
    }
    sections.push(formatted);
    usedChars += formatted.length;
  }

  // Tier 2: Today's other conversations (full transcripts)
  for (const conv of tier2) {
    const formatted = formatFullTranscript(conv);
    if (usedChars + formatted.length > MAX_CONTEXT_CHARS) break;
    sections.push(formatted);
    usedChars += formatted.length;
  }

  // Tier 3: Yesterday (summaries)
  for (const conv of tier3) {
    const formatted = formatSummaryXml(conv);
    if (usedChars + formatted.length > MAX_CONTEXT_CHARS) break;
    sections.push(formatted);
    usedChars += formatted.length;
  }

  // Tier 4: Older (summaries)
  for (const conv of tier4) {
    const formatted = formatSummaryXml(conv);
    if (usedChars + formatted.length > MAX_CONTEXT_CHARS) break;
    sections.push(formatted);
    usedChars += formatted.length;
  }

  if (sections.length === 0) return "";

  // Thread status tag
  const threadStatus = isContinuation
    ? `<thread-status>CONTINUATION — You are in an ongoing conversation. The user just messaged again. Do NOT greet or reintroduce yourself. Pick up naturally where you left off.</thread-status>`
    : `<thread-status>NEW CONVERSATION — This is a new conversation or a return after a break.</thread-status>`;

  return `<conversation-history>\n${threadStatus}\n${sections.join("\n")}\n</conversation-history>`;
}

/**
 * Build the complete system prompt for Claude sessions
 *
 * If BOOTSTRAP.md exists: returns its content as the entire system prompt
 * Otherwise: combines skill reminder + agent reminder + identity files + retrieval instructions
 *
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(): string {
  // Bootstrap mode: BOOTSTRAP.md IS the system prompt
  const bootstrapPath = getHomePath("identity", "BOOTSTRAP.md");
  if (existsSync(bootstrapPath)) {
    return readFileSync(bootstrapPath, "utf-8");
  }

  const memoryFirstBookend = getMemoryFirstBookend();
  const toolGuidance = getToolGuidance();
  const skillReminder = getSkillReminder();
  const agentReminder = getAgentReminder();
  const identity = loadIdentity();
  const instructions = getRetrievalInstructions();
  const memoryFirstReminder = getMemoryFirstReminder();

  // Composition order:
  // 1. memoryFirstBookend  — top bookend (primacy effect)
  // 2. toolGuidance        — safety-critical tool routing
  // 3. skillReminder       — folder location
  // 4. agentReminder       — folder location
  // 5. identity            — SOUL/IDENTITY/USER/REMINDERS.md
  // 6. instructions        — memory/retrieval instructions
  // 7. memoryFirstReminder — bottom bookend (recency effect)
  return [
    memoryFirstBookend,
    toolGuidance,
    skillReminder,
    agentReminder,
    identity,
    instructions,
    memoryFirstReminder,
  ].join("\n\n");
}
