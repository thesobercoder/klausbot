import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';
import { Logger } from 'pino';
import { createChildLogger } from '../utils/index.js';

/** Approved user record */
export interface ApprovedUser {
  approvedAt: number;
  username?: string;
  firstName?: string;
}

/** Pending pairing request */
export interface PendingRequest {
  chatId: number;
  requestedAt: number;
  username?: string;
  firstName?: string;
}

/** Persistent pairing state structure */
export interface PairingState {
  /** Approved users keyed by chatId.toString() for JSON serialization */
  approved: Record<string, ApprovedUser>;
  /** Pending requests keyed by pairing code */
  pending: Record<string, PendingRequest>;
}

/** Special return value indicating user is already approved */
export const ALREADY_APPROVED = 'ALREADY_APPROVED';

/**
 * Pairing store with JSON file persistence
 * Manages approved users and pending pairing requests
 */
export class PairingStore {
  private state: PairingState;
  private path: string;
  private logger: Logger;

  constructor(dataDir: string) {
    this.path = `${dataDir}/pairing.json`;
    this.logger = createChildLogger('pairing');
    this.state = { approved: {}, pending: {} };
    this.load();
  }

  /** Load state from disk or initialize empty */
  private load(): void {
    if (existsSync(this.path)) {
      try {
        const data = readFileSync(this.path, 'utf-8');
        this.state = JSON.parse(data);
        this.logger.info({ path: this.path }, 'Loaded pairing state from disk');
      } catch (err) {
        this.logger.error({ err, path: this.path }, 'Failed to load pairing state, starting fresh');
        this.state = { approved: {}, pending: {} };
      }
    } else {
      this.logger.info({ path: this.path }, 'No existing pairing state, starting fresh');
    }
  }

  /** Persist state to disk */
  private persist(): void {
    try {
      // Ensure directory exists
      const dir = dirname(this.path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.path, JSON.stringify(this.state, null, 2));
    } catch (err) {
      this.logger.error({ err, path: this.path }, 'Failed to persist pairing state');
      throw err;
    }
  }

  /**
   * Generate a unique 6-character alphanumeric pairing code
   * Checks for collision with existing pending codes
   */
  generateCode(): string {
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = randomBytes(3).toString('hex').toUpperCase();
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('Failed to generate unique pairing code after max attempts');
      }
    } while (code in this.state.pending);

    return code;
  }

  /**
   * Request pairing for a chat
   * @returns pairing code or ALREADY_APPROVED if already paired
   */
  requestPairing(chatId: number, username?: string, firstName?: string): string {
    const chatIdKey = chatId.toString();

    // Already approved
    if (chatIdKey in this.state.approved) {
      this.logger.info({ chatId, username }, 'User already approved');
      return ALREADY_APPROVED;
    }

    // Check if already pending - return existing code
    for (const [code, request] of Object.entries(this.state.pending)) {
      if (request.chatId === chatId) {
        this.logger.info({ code, chatId, username }, 'Returning existing pairing code');
        return code;
      }
    }

    // Generate new code and add to pending
    const code = this.generateCode();
    this.state.pending[code] = {
      chatId,
      requestedAt: Date.now(),
      username,
      firstName,
    };
    this.persist();
    this.logger.info({ code, chatId, username }, 'Pairing requested');
    return code;
  }

  /**
   * Approve a pending pairing request
   * @returns approved user info or null if code not found
   */
  approvePairing(code: string): { chatId: number; username?: string } | null {
    const pending = this.state.pending[code];
    if (!pending) {
      this.logger.warn({ code }, 'Pairing approval failed: code not found');
      return null;
    }

    // Move to approved
    const chatIdKey = pending.chatId.toString();
    this.state.approved[chatIdKey] = {
      approvedAt: Date.now(),
      username: pending.username,
      firstName: pending.firstName,
    };

    // Remove from pending
    delete this.state.pending[code];
    this.persist();

    this.logger.info({ code, chatId: pending.chatId, username: pending.username }, 'Pairing approved');
    return { chatId: pending.chatId, username: pending.username };
  }

  /**
   * Reject a pending pairing request
   * @returns true if code was pending and removed
   */
  rejectPairing(code: string): boolean {
    if (!(code in this.state.pending)) {
      this.logger.warn({ code }, 'Pairing rejection failed: code not found');
      return false;
    }

    const pending = this.state.pending[code];
    delete this.state.pending[code];
    this.persist();

    this.logger.info({ code, chatId: pending.chatId }, 'Pairing rejected');
    return true;
  }

  /**
   * Check if a chat ID is approved
   */
  isApproved(chatId: number): boolean {
    return chatId.toString() in this.state.approved;
  }

  /**
   * List all pending pairing requests
   */
  listPending(): Array<{ code: string; chatId: number; username?: string; requestedAt: number }> {
    return Object.entries(this.state.pending).map(([code, request]) => ({
      code,
      chatId: request.chatId,
      username: request.username,
      requestedAt: request.requestedAt,
    }));
  }

  /**
   * List all approved users
   */
  listApproved(): Array<{ chatId: number; username?: string; approvedAt: number }> {
    return Object.entries(this.state.approved).map(([chatIdKey, user]) => ({
      chatId: parseInt(chatIdKey, 10),
      username: user.username,
      approvedAt: user.approvedAt,
    }));
  }

  /**
   * Revoke approval for a chat ID
   * @returns true if user was approved and removed
   */
  revoke(chatId: number): boolean {
    const chatIdKey = chatId.toString();
    if (!(chatIdKey in this.state.approved)) {
      this.logger.warn({ chatId }, 'Revocation failed: user not approved');
      return false;
    }

    delete this.state.approved[chatIdKey];
    this.persist();

    this.logger.info({ chatId }, 'Pairing revoked');
    return true;
  }
}
