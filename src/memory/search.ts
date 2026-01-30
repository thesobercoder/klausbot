import { getDb } from './db.js';
import { generateEmbedding } from './embeddings.js';

/** Search result with relevance score */
export interface SearchResult {
  text: string;
  score: number;
  source: string;
  timestamp: string;
}

/** Search options */
export interface SearchOptions {
  topK?: number;
  daysBack?: number;  // Filter to last N days
}

/**
 * Semantic search over stored embeddings using sqlite-vec KNN
 * Finds the most relevant entries for a query
 *
 * @param query - Natural language query
 * @param options - Search options (topK, daysBack)
 * @returns Array of search results sorted by relevance
 */
export async function semanticSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { topK = 5, daysBack } = options;

  // Check for API key first
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[search] OPENAI_API_KEY not set, semantic search unavailable');
    return [];
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    return [];
  }

  const db = getDb();

  // Build query with optional date filter
  // sqlite-vec uses k = ? constraint for KNN, not LIMIT
  // Join vec_embeddings.rowid to embeddings.id for text data
  let sql: string;
  const params: (Float32Array | number | string)[] = [new Float32Array(queryEmbedding), topK];

  if (daysBack !== undefined && daysBack > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    sql = `
      SELECT
        e.text,
        e.source,
        e.timestamp,
        v.distance
      FROM vec_embeddings v
      INNER JOIN embeddings e ON e.id = v.rowid
      WHERE v.embedding MATCH ?
        AND v.k = ?
        AND e.timestamp >= ?
      ORDER BY v.distance
    `;
    params.push(cutoff.toISOString());
  } else {
    sql = `
      SELECT
        e.text,
        e.source,
        e.timestamp,
        v.distance
      FROM vec_embeddings v
      INNER JOIN embeddings e ON e.id = v.rowid
      WHERE v.embedding MATCH ?
        AND v.k = ?
      ORDER BY v.distance
    `;
  }

  // Execute KNN search
  const rows = db.prepare(sql).all(...params) as Array<{
    text: string;
    source: string;
    timestamp: string;
    distance: number;
  }>;

  // Convert distance to similarity score (sqlite-vec returns L2 distance)
  // Lower distance = more similar, convert to 0-1 score where 1 = identical
  return rows.map(row => ({
    text: row.text,
    source: row.source,
    timestamp: row.timestamp,
    score: 1 / (1 + row.distance),
  }));
}
