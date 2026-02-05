import OpenAI from "openai";
import { getDb } from "./db.js";

/** Embedding entry stored in SQLite */
export interface EmbeddingEntry {
  id: string;
  text: string;
  embedding: number[];
  timestamp: string;
  source: string;
}

/** Lazy-initialized OpenAI client */
let openaiClient: OpenAI | null = null;

/** Model for embeddings (1536 dimensions, $0.00002/1K tokens) */
const EMBEDDING_MODEL = "text-embedding-3-small";

/** Max chunk size for text splitting (~500 chars for better retrieval) */
const CHUNK_SIZE = 500;

/**
 * Get or create OpenAI client
 * Lazy initialization - only creates client when API key exists
 *
 * @returns OpenAI client or null if no API key
 */
function getOpenAIClient(): OpenAI | null {
  if (openaiClient !== null) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * Generate embedding for text using OpenAI API
 *
 * @param text - Text to embed
 * @returns Embedding vector (1536 dimensions) or null on error
 */
export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  const client = getOpenAIClient();
  if (!client) {
    console.warn(
      "[embeddings] OPENAI_API_KEY not set, skipping embedding generation",
    );
    return null;
  }

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    // Log and skip on any error (rate limit, API error, etc.)
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[embeddings] Failed to generate embedding: ${msg}`);
    return null;
  }
}

/**
 * Split text into chunks for better retrieval
 * Splits at sentence boundaries first, then word boundaries
 *
 * @param text - Text to split
 * @returns Array of text chunks
 */
function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining.trim());
      break;
    }

    // Try to split at sentence boundary
    let splitPoint = remaining.lastIndexOf(". ", CHUNK_SIZE);
    if (splitPoint === -1 || splitPoint < CHUNK_SIZE * 0.3) {
      // Try word boundary
      splitPoint = remaining.lastIndexOf(" ", CHUNK_SIZE);
    }
    if (splitPoint === -1 || splitPoint < CHUNK_SIZE * 0.3) {
      // Hard split
      splitPoint = CHUNK_SIZE;
    }

    const chunk = remaining.slice(0, splitPoint + 1).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitPoint + 1);
  }

  return chunks;
}

/**
 * Store embedding for text
 * Splits long text into chunks and embeds each chunk separately
 * Fire-and-forget: errors are logged but don't propagate
 *
 * @param text - Text to embed and store
 * @param source - Source identifier (e.g., 'assistant-2026-01-29')
 */
export async function storeEmbedding(
  text: string,
  source: string,
): Promise<void> {
  const client = getOpenAIClient();
  if (!client) {
    console.warn(
      "[embeddings] OPENAI_API_KEY not set, skipping embedding storage",
    );
    return;
  }

  const chunks = chunkText(text);
  const timestamp = new Date().toISOString();
  const db = getDb();

  const insertStmt = db.prepare(`
    INSERT INTO embeddings (text_id, text, timestamp, source)
    VALUES (?, ?, ?, ?)
  `);
  const vecStmt = db.prepare(`
    INSERT INTO vec_embeddings (rowid, embedding)
    VALUES (?, ?)
  `);

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    if (!embedding) {
      continue; // Skip failed embeddings
    }

    const textId = `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const info = insertStmt.run(textId, chunk, timestamp, source);
    const rowid = info.lastInsertRowid;

    // Use BigInt for rowid and Float32Array directly for sqlite-vec
    vecStmt.run(BigInt(rowid), new Float32Array(embedding));
  }
}

/**
 * Initialize embeddings storage
 * No-op for SQLite - schema created on db init
 * @deprecated Use getDb() directly for database initialization
 */
export function initializeEmbeddings(): void {
  // No-op - database handles its own initialization
  // Kept for API compatibility during migration period
}
