/**
 * In-memory SQLite test database factory
 * Creates isolated DB per test — no file I/O, no extensions
 */

import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../../src/memory/schema.js";

export interface TestDb {
  /** Raw better-sqlite3 instance */
  sqlite: Database.Database;
  /** Drizzle ORM instance with schema */
  db: BetterSQLite3Database<typeof schema>;
  /** Close the database (call in afterEach) */
  close: () => void;
}

/**
 * Create an in-memory SQLite test database
 * Mirrors src/memory/db.ts runMigrations() SQL exactly (minus FTS5 + sqlite-vec)
 */
export function createTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");

  // conversations table — matches runMigrations()
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      transcript TEXT NOT NULL,
      summary TEXT NOT NULL,
      message_count INTEGER NOT NULL,
      chat_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_ended_at ON conversations(ended_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(chat_id);
  `);

  // conversation_embeddings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversation_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv_emb_conv_id ON conversation_embeddings(conversation_id);
  `);

  const db = drizzle(sqlite, { schema });

  return { sqlite, db, close: () => sqlite.close() };
}
