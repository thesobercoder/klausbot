/**
 * Heartbeat note collection - detect trigger phrases and generate instructions
 * Claude interprets user intent and stores cleaned notes to HEARTBEAT.md
 */

import { getHeartbeatPath } from "./executor.js";

/**
 * Trigger phrases that indicate user wants to add a heartbeat reminder
 * Case-insensitive matching
 */
const TRIGGER_PHRASES = [
  /\bremind me\b/i,
  /\bdon'?t forget\b/i,
  /\bcheck on\b/i,
  /\bremember to\b/i,
  /\bheartbeat:/i,
  /\badd.*reminder\b/i,
  /\bkeep track of\b/i,
];

/**
 * Check if message text contains a heartbeat note trigger phrase
 *
 * @param text - User message text
 * @returns true if message should trigger note collection
 */
export function shouldCollectNote(text: string): boolean {
  return TRIGGER_PHRASES.some(pattern => pattern.test(text));
}

/**
 * Generate additional instructions for Claude to collect and store a heartbeat note
 * Claude interprets user intent and stores a cleaned/structured note (not verbatim)
 *
 * @param text - Original user message
 * @returns Instructions to append to system prompt
 */
export function getNoteCollectionInstructions(text: string): string {
  const heartbeatPath = getHeartbeatPath();

  return `<heartbeat-note-request>
The user is asking to add something to their heartbeat reminders.
Their message: "${text}"

Instructions:
1. Interpret the user's intent (what do they want to remember/check?)
2. Clean and structure the note appropriately
3. Add the note to ${heartbeatPath} under "## Active Items"
4. Include any expiry dates if the user mentioned timing (e.g., "by Friday" -> [expires: YYYY-MM-DD])
5. Respond with a brief confirmation like "Added to heartbeat reminders"

HEARTBEAT.md format:
- Use markdown checkboxes: "- [ ] Item description"
- Add optional expiry: "- [ ] Item [expires: YYYY-MM-DD]"
- Keep notes concise and actionable

Do NOT store the user's message verbatim - interpret and clean it.
</heartbeat-note-request>`;
}
