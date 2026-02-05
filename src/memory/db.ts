import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { getHomePath } from "./home.js";
import * as schema from "./schema.js";

/** Lazy-initialized database instances */
let sqliteDb: Database.Database | null = null;
let drizzleDb: BetterSQLite3Database<typeof schema> | null = null;

/**
 * Get or create SQLite database with vector extension
 * Lazy initialization - creates DB on first call
 *
 * @returns Raw better-sqlite3 database instance
 */
export function getDb(): Database.Database {
  if (sqliteDb !== null) {
    return sqliteDb;
  }

  const dbPath = getHomePath("klausbot.db");
  sqliteDb = new Database(dbPath);

  // Enable WAL mode for concurrent reads
  sqliteDb.pragma("journal_mode = WAL");

  // Load sqlite-vec extension
  sqliteVec.load(sqliteDb);

  // Create legacy schema (vec table needs raw SQL)
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_id TEXT UNIQUE NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_embeddings_timestamp ON embeddings(timestamp);
    CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source);

    CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
      embedding float[1536]
    );
  `);

  return sqliteDb;
}

/**
 * Get Drizzle ORM instance
 * Creates raw DB first if needed
 *
 * @returns Drizzle database instance with schema
 */
export function getDrizzle(): BetterSQLite3Database<typeof schema> {
  if (drizzleDb !== null) {
    return drizzleDb;
  }

  // Ensure raw DB is initialized first (creates tables)
  const db = getDb();
  drizzleDb = drizzle(db, { schema });

  return drizzleDb;
}

/**
 * Run schema migrations
 * Creates conversations table if not exists
 * Safe to call multiple times (idempotent)
 */
export function runMigrations(): void {
  const db = getDb();

  // Create conversations table (Drizzle schema equivalent)
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS conversation_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv_emb_conv_id ON conversation_embeddings(conversation_id);

    -- FTS5 full-text search on conversation summaries
    CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
      summary,
      content='conversations',
      content_rowid='id'
    );

    -- Triggers to keep FTS index in sync
    CREATE TRIGGER IF NOT EXISTS conversations_ai AFTER INSERT ON conversations BEGIN
      INSERT INTO conversations_fts(rowid, summary) VALUES (new.id, new.summary);
    END;
    CREATE TRIGGER IF NOT EXISTS conversations_ad AFTER DELETE ON conversations BEGIN
      INSERT INTO conversations_fts(conversations_fts, rowid, summary) VALUES('delete', old.id, old.summary);
    END;
    CREATE TRIGGER IF NOT EXISTS conversations_au AFTER UPDATE ON conversations BEGIN
      INSERT INTO conversations_fts(conversations_fts, rowid, summary) VALUES('delete', old.id, old.summary);
      INSERT INTO conversations_fts(rowid, summary) VALUES (new.id, new.summary);
    END;
  `);
}

/**
 * Close database connection
 * Call on shutdown for clean exit
 */
export function closeDb(): void {
  if (sqliteDb !== null) {
    sqliteDb.close();
    sqliteDb = null;
    drizzleDb = null;
  }
}
