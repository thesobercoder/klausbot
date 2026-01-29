import { existsSync, readFileSync } from 'fs';
import { getHomePath } from './home.js';

/**
 * Cache identity content at startup to avoid blocking I/O per request
 * NOTE: Changes to identity files require process restart (acceptable for Phase 2)
 */
let identityCache: string | null = null;

/** Identity files to load from ~/.klausbot/identity/ */
const IDENTITY_FILES = ['SOUL.md', 'IDENTITY.md', 'USER.md'] as const;

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
    const path = getHomePath('identity', filename);
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        parts.push(`<${filename}>\n${content}\n</${filename}>`);
      } catch {
        // Graceful degradation: skip unreadable files
      }
    }
  }

  identityCache = parts.join('\n\n');
  return identityCache;
}

/**
 * Build retrieval instructions for Claude's memory access
 * Tells Claude how to search conversations and update preferences
 *
 * @returns Memory instructions wrapped in XML tags
 */
export function getRetrievalInstructions(): string {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format

  return `<memory-instructions>
## CRITICAL: Read Context Before Responding

You are in an ONGOING conversation. Before responding to ANY message:
1. FIRST read conversations/${today}.md to see what was discussed earlier
2. Your response MUST acknowledge the conversation context

If you skip this step, you will give irrelevant responses.

## Working Directory

Your working directory is ~/.klausbot/

## Available Files

- conversations/${today}.md - TODAY'S conversation (READ THIS FIRST)
- conversations/{date}.md - Past conversation logs
- identity/USER.md - Learned user preferences

## Retrieval Workflow

1. **ALWAYS first:** Read conversations/${today}.md for current session context
2. **Historical search:** Use Grep tool to search conversations/ for past topics
3. **User preferences:** Check identity/USER.md for learned preferences

## Learning and Memory

When user shares information, decide what to remember:

**Preferences** (how they want things done):
- Communication style, response format, timezone, etc.
- Add to USER.md Preferences section

**Context** (facts about them):
- Name, location, family, work, interests, etc.
- Add to USER.md Context section

**Important notes** (things they explicitly want remembered):
- Deadlines, reminders, key decisions, promises made
- Add to USER.md Notes section with [!important] marker
- Example: User says "Don't forget I have a meeting with John on Friday"
  -> Add: "[!important] Meeting with John on Friday" to Notes

You decide what's important based on context - user doesn't need special syntax.
</memory-instructions>`;
}

/**
 * Build the complete system prompt for Claude sessions
 * Combines identity files + retrieval instructions
 *
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(): string {
  const identity = loadIdentity();
  const instructions = getRetrievalInstructions();

  // Combine with double newline separator
  return identity + '\n\n' + instructions;
}
