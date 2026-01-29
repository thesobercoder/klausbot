import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { KLAUSBOT_HOME, getHomePath } from './home.js';

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
function getToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Get current time in HH:MM:SS format (local timezone)
 */
function getTime(): string {
  return new Date().toLocaleTimeString('en-GB');
}

/**
 * Get path to today's conversation file
 *
 * @returns Path to conversations/{YYYY-MM-DD}.md
 */
export function getConversationPath(): string {
  return getHomePath('conversations', `${getToday()}.md`);
}

/**
 * Ensure conversation directory and file exist
 * Creates conversations/ directory and daily file with header if missing
 *
 * @returns Path to the conversation file
 */
export function ensureConversationFile(): string {
  const convDir = getHomePath('conversations');
  if (!existsSync(convDir)) {
    mkdirSync(convDir, { recursive: true });
  }

  const path = getConversationPath();
  if (!existsSync(path)) {
    appendFileSync(path, `# Conversation Log - ${getToday()}\n\n`);
  }

  return path;
}

/**
 * Log a user message to today's conversation file
 *
 * Format:
 * ## HH:MM:SS
 *
 * **User:**
 * {content}
 *
 * ---
 *
 * @param content - User message content
 */
export function logUserMessage(content: string): void {
  const path = ensureConversationFile();
  const entry = `## ${getTime()}\n\n**User:**\n${content}\n\n---\n\n`;
  appendFileSync(path, entry);
}

/**
 * Log an assistant message to today's conversation file
 *
 * Format:
 * ## HH:MM:SS
 *
 * **Assistant:**
 * {content}
 *
 * ---
 *
 * @param content - Assistant response content
 */
export function logAssistantMessage(content: string): void {
  const path = ensureConversationFile();
  const entry = `## ${getTime()}\n\n**Assistant:**\n${content}\n\n---\n\n`;
  appendFileSync(path, entry);
}
