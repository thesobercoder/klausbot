import { getDb } from "./db.js";
import { generateEmbedding } from "./embeddings.js";

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
  daysBack?: number; // Filter to last N days
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
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const { topK = 5, daysBack } = options;

  // Check for API key first
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "[search] OPENAI_API_KEY not set, semantic search unavailable",
    );
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
  const params: (Float32Array | number | string)[] = [
    new Float32Array(queryEmbedding),
    topK,
  ];

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
  return rows.map((row) => ({
    text: row.text,
    source: row.source,
    timestamp: row.timestamp,
    score: 1 / (1 + row.distance),
  }));
}

/** Conversation search result */
export interface ConversationSearchResult {
  sessionId: string;
  summary: string;
  endedAt: string;
  messageCount: number;
  score: number; // Relevance score (0-1)
}

/**
 * Search conversations by summary content using FTS5 full-text search
 * Uses SQLite FTS5 for efficient keyword matching with ranking
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Matching conversations with relevance scores
 */
export function searchConversations(
  query: string,
  options: { topK?: number; daysBack?: number } = {},
): ConversationSearchResult[] {
  const { topK = 5, daysBack } = options;
  const db = getDb();

  // Escape FTS5 special characters and format query
  // FTS5 uses space-separated terms with implicit AND
  const ftsQuery = query
    .replace(/['"]/g, "") // Remove quotes
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => `"${w}"`) // Quote each term for exact matching
    .join(" OR "); // OR for broader results

  if (!ftsQuery) {
    return [];
  }

  // Build SQL with FTS5 search and optional date filter
  let sql: string;
  const params: (string | number)[] = [ftsQuery, topK];

  if (daysBack) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    sql = `
      SELECT
        c.session_id,
        c.summary,
        c.ended_at,
        c.message_count,
        bm25(conversations_fts) as rank
      FROM conversations_fts fts
      INNER JOIN conversations c ON c.id = fts.rowid
      WHERE conversations_fts MATCH ?
        AND c.ended_at >= ?
      ORDER BY rank
      LIMIT ?
    `;
    params.splice(1, 0, cutoff.toISOString()); // Insert cutoff between query and limit
  } else {
    sql = `
      SELECT
        c.session_id,
        c.summary,
        c.ended_at,
        c.message_count,
        bm25(conversations_fts) as rank
      FROM conversations_fts fts
      INNER JOIN conversations c ON c.id = fts.rowid
      WHERE conversations_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `;
  }

  try {
    const rows = db.prepare(sql).all(...params) as Array<{
      session_id: string;
      summary: string;
      ended_at: string;
      message_count: number;
      rank: number;
    }>;

    // Convert BM25 rank to 0-1 score (BM25 returns negative values, lower = better match)
    // Normalize: -10 (great) to 0 (poor) -> 1.0 to 0.0
    return rows.map((row) => ({
      sessionId: row.session_id,
      summary: row.summary,
      endedAt: row.ended_at,
      messageCount: row.message_count,
      score: Math.min(1, Math.max(0, 1 + row.rank / 10)),
    }));
  } catch (err) {
    // FTS5 query syntax error - fall back to empty results
    console.warn("[search] FTS5 query failed:", err);
    return [];
  }
}
