/**
 * Conversation storage operations
 * Stores and retrieves conversation transcripts with summaries
 */

import { eq, desc, gte } from 'drizzle-orm';
import { getDrizzle } from './db.js';
import { conversations } from './schema.js';
import OpenAI from 'openai';

/** Lazy-initialized OpenAI client */
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (openaiClient !== null) return openaiClient;
  if (!process.env.OPENAI_API_KEY) return null;
  openaiClient = new OpenAI();
  return openaiClient;
}

/** Conversation record for storage */
export interface ConversationRecord {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  transcript: string;
  summary: string;
  messageCount: number;
  chatId?: number;
}

/** Transcript entry structure (from Claude CLI JSONL) */
interface TranscriptEntry {
  type: 'user' | 'assistant' | 'summary' | 'system';
  timestamp?: string;
  message?: {
    role?: string;
    content?: Array<{ type: string; text?: string }>;
  };
}

/**
 * Parse JSONL transcript file content
 */
export function parseTranscript(content: string): TranscriptEntry[] {
  const lines = content.split('\n').filter(line => line.trim());
  const entries: TranscriptEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as TranscriptEntry);
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Extract text content from transcript entries
 */
export function extractConversationText(entries: TranscriptEntry[]): string {
  const parts: string[] = [];

  for (const entry of entries) {
    if ((entry.type === 'user' || entry.type === 'assistant') && entry.message?.content) {
      let textContent: string;

      // Handle both string and array content formats
      if (typeof entry.message.content === 'string') {
        textContent = entry.message.content;
      } else if (Array.isArray(entry.message.content)) {
        textContent = entry.message.content
          .filter(c => c.type === 'text' && c.text)
          .map(c => c.text)
          .join('\n');
      } else {
        continue;
      }

      if (textContent) {
        const role = entry.type === 'user' ? 'User' : 'Assistant';
        parts.push(`${role}: ${textContent}`);
      }
    }
  }

  return parts.join('\n\n');
}

/**
 * Generate summary of conversation using OpenAI
 */
export async function generateSummary(conversationText: string): Promise<string> {
  // Skip if conversation is very short
  if (conversationText.length < 100) {
    return 'Brief conversation.';
  }

  // Skip if no OpenAI API key
  const openai = getOpenAIClient();
  if (!openai) {
    const preview = conversationText.slice(0, 200).replace(/\n/g, ' ');
    return `${preview}...`;
  }

  // Truncate very long conversations for summarization
  const maxLength = 10000;
  const truncated = conversationText.length > maxLength
    ? conversationText.slice(0, maxLength) + '\n...[truncated]'
    : conversationText;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Summarize this conversation in 2-3 sentences. Focus on the main topics discussed and any conclusions or outcomes.',
        },
        {
          role: 'user',
          content: truncated,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content ?? 'Conversation summary unavailable.';
  } catch (err) {
    // Fallback if API fails
    const preview = conversationText.slice(0, 200).replace(/\n/g, ' ');
    return `Conversation about: ${preview}...`;
  }
}

/**
 * Store a conversation record
 */
export function storeConversation(record: ConversationRecord): void {
  const db = getDrizzle();

  db.insert(conversations)
    .values({
      sessionId: record.sessionId,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      transcript: record.transcript,
      summary: record.summary,
      messageCount: record.messageCount,
      chatId: record.chatId ?? null,
    })
    .onConflictDoUpdate({
      target: conversations.sessionId,
      set: {
        endedAt: record.endedAt,
        transcript: record.transcript,
        summary: record.summary,
        messageCount: record.messageCount,
      },
    })
    .run();
}

/**
 * Get recent conversation summaries for context injection
 */
export function getRecentConversations(limit: number = 3, daysBack?: number): ConversationRecord[] {
  const db = getDrizzle();

  let query = db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.endedAt))
    .limit(limit);

  if (daysBack) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    query = db
      .select()
      .from(conversations)
      .where(gte(conversations.endedAt, cutoff.toISOString()))
      .orderBy(desc(conversations.endedAt))
      .limit(limit);
  }

  return query.all() as ConversationRecord[];
}

/**
 * Get a conversation by session ID
 */
export function getConversationBySessionId(sessionId: string): ConversationRecord | null {
  const db = getDrizzle();

  const result = db
    .select()
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .get();

  return result as ConversationRecord | null;
}
