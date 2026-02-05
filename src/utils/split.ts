import type { MyContext } from "../telegram/bot.js";

/** Telegram message character limit */
const MAX_LENGTH = 4096;

/**
 * Split long text into chunks that fit Telegram's message limit
 * Prefers splitting at sentence boundaries, then word boundaries, then hard split
 * @param text - Text to split
 * @returns Array of text chunks, each <= MAX_LENGTH
 */
export function splitMessage(text: string): string[] {
  if (text.length <= MAX_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_LENGTH) {
    // Try to split at sentence boundary (". ")
    let splitIdx = remaining.lastIndexOf(". ", MAX_LENGTH - 1);

    // If no good sentence boundary (too early or not found), try word boundary
    if (splitIdx === -1 || splitIdx < MAX_LENGTH / 2) {
      splitIdx = remaining.lastIndexOf(" ", MAX_LENGTH - 1);
    }

    // Hard split if no boundary found
    if (splitIdx === -1) {
      splitIdx = MAX_LENGTH - 1;
    }

    const chunk = remaining.slice(0, splitIdx + 1).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitIdx + 1).trim();
  }

  // Add remaining text if any
  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Send a potentially long message, automatically splitting if needed
 * @param ctx - grammY context
 * @param text - Message text (can exceed 4096 chars)
 */
export async function sendLongMessage(
  ctx: MyContext,
  text: string,
): Promise<void> {
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    await ctx.reply(chunk);
    // Small delay between chunks to maintain order
    if (chunks.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
