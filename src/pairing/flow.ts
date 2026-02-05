import type { MyContext } from "../telegram/bot.js";
import { PairingStore, ALREADY_APPROVED } from "./store.js";
import { createChildLogger } from "../utils/index.js";

const log = createChildLogger("pairing");

/** Module-level store instance (initialized lazily) */
let store: PairingStore | null = null;

/**
 * Initialize the pairing store
 * Must be called before using pairing middleware or handlers
 * @returns The initialized store instance
 */
export function initPairingStore(dataDir: string): PairingStore {
  if (!store) {
    store = new PairingStore(dataDir);
    log.info({ dataDir }, "Pairing store initialized");
  }
  return store;
}

/**
 * Get the pairing store instance
 * @throws Error if store not initialized
 */
export function getPairingStore(): PairingStore {
  if (!store) {
    throw new Error(
      "Pairing store not initialized. Call initPairingStore() first.",
    );
  }
  return store;
}

/**
 * Handle /start command - request pairing or acknowledge already paired
 */
export async function handleStartCommand(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    log.warn("handleStartCommand called without chat context");
    return;
  }

  const pairingStore = getPairingStore();
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;

  const result = pairingStore.requestPairing(chatId, username, firstName);

  if (result === ALREADY_APPROVED) {
    await ctx.reply("You're already paired! Send me a message.");
    return;
  }

  // New pairing code generated
  const message = [
    "Welcome! To complete pairing, run this command on the server:",
    "",
    `\`klausbot pairing approve ${result}\``,
    "",
    `Your chat ID: \`${chatId}\``,
  ].join("\n");

  await ctx.reply(message, { parse_mode: "Markdown" });
  log.info({ chatId, username, code: result }, "Pairing code shown to user");
}

/**
 * Create middleware that blocks unapproved users
 * Allow /start through so users can request pairing
 */
export function createPairingMiddleware() {
  return async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
    const chatId = ctx.chat?.id;

    // Skip if no chat context (shouldn't happen for user messages)
    if (!chatId) {
      return next();
    }

    const pairingStore = getPairingStore();

    // Approved users pass through
    if (pairingStore.isApproved(chatId)) {
      return next();
    }

    // Check if this is /start command - allow through for pairing flow
    // The command is handled separately, so we just pass it
    const text = ctx.message?.text;
    if (text?.startsWith("/start")) {
      return next();
    }

    // Block unapproved users with instructions
    log.info(
      { chatId, username: ctx.from?.username },
      "Blocked unapproved user",
    );
    await ctx.reply("Waiting for approval. Use /start to get a pairing code.");
    // Do NOT call next() - block the message
  };
}
