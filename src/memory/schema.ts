/**
 * Drizzle ORM schema for klausbot SQLite database
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Embeddings table (migrated from raw SQL)
 * Stores text with vector embeddings for semantic search
 */
export const embeddings = sqliteTable('embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  textId: text('text_id').unique().notNull(),
  text: text('text').notNull(),
  timestamp: text('timestamp').notNull(),
  source: text('source').notNull(),
});

/**
 * Conversations table
 * Stores full transcripts with summaries for history search
 */
export const conversations = sqliteTable('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').unique().notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at').notNull(),
  transcript: text('transcript').notNull(),      // Full JSONL content
  summary: text('summary').notNull(),            // LLM-generated summary
  messageCount: integer('message_count').notNull(),
  chatId: integer('chat_id'),                    // Telegram chat ID (nullable)
});

/**
 * Conversation embeddings table
 * Links conversation chunks to vector embeddings for search
 */
export const conversationEmbeddings = sqliteTable('conversation_embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  text: text('text').notNull(),
});
