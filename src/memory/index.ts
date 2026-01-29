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

// Embedding generation and storage
export {
  generateEmbedding,
  storeEmbedding,
  initializeEmbeddings,
} from './embeddings.js';

// Semantic search
export { semanticSearch, cosineSimilarity } from './search.js';
