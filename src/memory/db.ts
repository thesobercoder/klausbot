import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { getHomePath } from './home.js';

/** Lazy-initialized database instance */
let db: Database.Database | null = null;

/**
 * Get or create SQLite database with vector extension
 * Lazy initialization - creates DB on first call
 *
 * @returns Database instance with sqlite-vec loaded
 */
export function getDb(): Database.Database {
  if (db !== null) {
    return db;
  }

  const dbPath = getHomePath('klausbot.db');
  db = new Database(dbPath);

  // Enable WAL mode for concurrent reads
  db.pragma('journal_mode = WAL');

  // Load sqlite-vec extension (uses load() instead of loadExtension for proper binding support)
  sqliteVec.load(db);

  // Create schema
  db.exec(`
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

  return db;
}

/**
 * Close database connection
 * Call on shutdown for clean exit
 */
export function closeDb(): void {
  if (db !== null) {
    db.close();
    db = null;
  }
}
