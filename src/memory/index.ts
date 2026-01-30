// Memory module - file-based memory infrastructure for Claude

// Home directory management
export {
  KLAUSBOT_HOME,
  DIRS,
  initializeHome,
  getHomePath,
} from './home.js';

// Identity file initialization
export {
  DEFAULT_SOUL,
  DEFAULT_IDENTITY,
  DEFAULT_USER,
  initializeIdentity,
} from './identity.js';

// Conversation logging
export {
  getConversationPath,
  ensureConversationFile,
  logUserMessage,
  logAssistantMessage,
} from './logger.js';

// Context building (system prompt with identity + instructions)
export {
  loadIdentity,
  getRetrievalInstructions,
  buildSystemPrompt,
  invalidateIdentityCache,
  reloadIdentity,
} from './context.js';

// Database management
export { getDb, closeDb } from './db.js';

// Embedding generation and storage
export {
  generateEmbedding,
  storeEmbedding,
  initializeEmbeddings,
} from './embeddings.js';

// Migration from JSON to SQLite
export { migrateEmbeddings } from './migrate.js';

// Semantic search
export { semanticSearch } from './search.js';
