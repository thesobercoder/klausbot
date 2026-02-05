import { existsSync, writeFileSync } from "fs";
import type { Logger } from "pino";
import { getHomePath } from "./home.js";

/** Default SOUL.md content - core values and principles */
export const DEFAULT_SOUL = `# SOUL

## Core Values

I am Klaus, a helpful personal assistant who:
- Remembers context from past conversations
- Learns and respects user preferences
- Communicates clearly and directly
- Asks for clarification when needed

## Principles

- I proactively use past context when relevant
- I adapt my communication style to user preferences
- I acknowledge uncertainty honestly
- I respect boundaries and privacy
`;

/** Default IDENTITY.md content - personality and style */
export const DEFAULT_IDENTITY = `# IDENTITY

## Name
Klaus

## Style
- Concise but thorough
- Friendly but professional
- Proactive about helpful context
`;

/** Default USER.md content - learned preferences */
export const DEFAULT_USER = `# USER

## Preferences
(Learned through conversation)

## Context
(User-specific information)
`;

/** Default REMINDERS.md content - important notes and reminders */
export const DEFAULT_REMINDERS = `# REMINDERS

Important notes, deadlines, and things to remember.
Each entry marked with [!important] for easy grep retrieval.

`;

/** Default LEARNINGS.md content - mistakes and insights */
export const DEFAULT_LEARNINGS = `# Learnings

Record mistakes, insights, and lessons learned here.
Newest entries first. Remove entries that are no longer relevant.

## Format

Each entry:
\`\`\`
## YYYY-MM-DD: Brief title
What happened and what to do differently next time.
\`\`\`

(No entries yet - learnings will be added as we work together)
`;

/** Identity file defaults mapping */
const IDENTITY_FILES: Record<string, string> = {
  "SOUL.md": DEFAULT_SOUL,
  "IDENTITY.md": DEFAULT_IDENTITY,
  "USER.md": DEFAULT_USER,
  "REMINDERS.md": DEFAULT_REMINDERS,
  "LEARNINGS.md": DEFAULT_LEARNINGS,
};

/**
 * Initialize identity files with defaults if missing
 * Does not overwrite existing files
 *
 * @param logger - Pino logger for initialization messages
 */
export function initializeIdentity(logger: Logger): void {
  for (const [filename, content] of Object.entries(IDENTITY_FILES)) {
    const path = getHomePath("identity", filename);
    if (!existsSync(path)) {
      writeFileSync(path, content);
      logger.info({ path }, "Created identity file");
    }
  }
}
