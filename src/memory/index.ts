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
