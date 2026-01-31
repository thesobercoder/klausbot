import { existsSync, readFileSync, renameSync } from 'fs';
import { getHomePath } from './home.js';
import { getDb } from './db.js';
import type { EmbeddingEntry } from './embeddings.js';
import { theme } from '../cli/theme.js';

/** Legacy embeddings file format */
interface EmbeddingsFile {
  entries: EmbeddingEntry[];
}

/**
 * Migrate embeddings from JSON file to SQLite
 * Idempotent - safe to call multiple times
 *
 * Steps:
 * 1. Check if embeddings.json exists
 * 2. If not, return (nothing to migrate)
 * 3. Read JSON and insert into SQLite in a transaction
 * 4. Rename JSON to embeddings.json.migrated
 *
 * @returns Number of entries migrated (0 if already migrated or no data)
 */
export async function migrateEmbeddings(): Promise<number> {
  const jsonPath = getHomePath('embeddings.json');

  // Check if JSON file exists
  if (!existsSync(jsonPath)) {
    return 0;
  }

  // Read JSON file
  let data: EmbeddingsFile;
  try {
    const content = readFileSync(jsonPath, 'utf-8');
    data = JSON.parse(content) as EmbeddingsFile;
  } catch (err) {
    theme.warn(`Migration: Failed to read embeddings.json: ${err}`);
    return 0;
  }

  const entries = data.entries || [];
  if (entries.length === 0) {
    // Empty file - just rename it
    renameSync(jsonPath, jsonPath + '.migrated');
    theme.info('Migration: Empty embeddings.json archived');
    return 0;
  }

  // Get database
  const db = getDb();

  // Prepare statements
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO embeddings (text_id, text, timestamp, source)
    VALUES (?, ?, ?, ?)
  `);
  const vecStmt = db.prepare(`
    INSERT OR IGNORE INTO vec_embeddings (rowid, embedding)
    VALUES (?, ?)
  `);
  const getRowidStmt = db.prepare(`
    SELECT id FROM embeddings WHERE text_id = ?
  `);

  // Insert in a transaction for atomicity and performance
  let migrated = 0;

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      // Insert metadata
      insertStmt.run(entry.id, entry.text, entry.timestamp, entry.source);

      // Get the rowid (could be from existing row or new insert)
      const row = getRowidStmt.get(entry.id) as { id: number } | undefined;
      if (!row) {
        continue;
      }

      // Use BigInt for rowid and Float32Array directly for sqlite-vec
      vecStmt.run(BigInt(row.id), new Float32Array(entry.embedding));

      migrated++;
    }
  });

  transaction();

  // Rename JSON file to mark migration complete
  renameSync(jsonPath, jsonPath + '.migrated');
  theme.success(`Migration: ${migrated} embeddings moved to SQLite`);

  return migrated;
}
