import { existsSync, readFileSync } from 'fs';
import { getHomePath } from './home.js';
import { generateEmbedding, type EmbeddingEntry } from './embeddings.js';

/** Search result with relevance score */
export interface SearchResult {
  text: string;
  score: number;
  source: string;
  timestamp: string;
}

/** Minimum similarity score to include in results */
const MIN_SCORE_THRESHOLD = 0.7;

/** Default number of results to return */
const DEFAULT_TOP_K = 5;

/**
 * Calculate cosine similarity between two vectors
 * Pure TypeScript implementation (no dependencies)
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity (0 to 1, where 1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Load embeddings from storage
 *
 * @returns Array of embedding entries or empty array
 */
function loadStoredEmbeddings(): EmbeddingEntry[] {
  const path = getHomePath('embeddings.json');
  if (!existsSync(path)) {
    return [];
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content) as { entries: EmbeddingEntry[] };
    return data.entries || [];
  } catch {
    return [];
  }
}

/**
 * Semantic search over stored embeddings
 * Finds the most relevant entries for a query using cosine similarity
 *
 * @param query - Natural language query
 * @param topK - Number of results to return (default: 5)
 * @returns Array of search results sorted by relevance
 */
export async function semanticSearch(
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<SearchResult[]> {
  // Check for API key first
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[search] OPENAI_API_KEY not set, semantic search unavailable');
    return [];
  }

  // Load stored embeddings
  const entries = loadStoredEmbeddings();
  if (entries.length === 0) {
    return [];
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    return [];
  }

  // Calculate similarity scores
  const scored: { entry: EmbeddingEntry; score: number }[] = [];
  for (const entry of entries) {
    const score = cosineSimilarity(queryEmbedding, entry.embedding);
    if (score >= MIN_SCORE_THRESHOLD) {
      scored.push({ entry, score });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top K
  const topResults = scored.slice(0, topK);

  // Map to SearchResult format
  return topResults.map(({ entry, score }) => ({
    text: entry.text,
    score,
    source: entry.source,
    timestamp: entry.timestamp,
  }));
}
