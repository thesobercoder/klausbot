import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { Logger } from 'pino';
import { createChildLogger } from '../utils/logger.js';
import type { MediaAttachment } from '../media/index.js';

/** Message status in queue lifecycle */
export type MessageStatus = 'pending' | 'processing' | 'done' | 'failed';

/** Queued message structure */
export interface QueuedMessage {
  id: string;
  chatId: number;
  text: string;
  timestamp: number;
  status: MessageStatus;
  error?: string;
  media?: MediaAttachment[];
}

/** Queue statistics */
export interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
}

/**
 * Persistent message queue with disk storage
 * Survives restarts by persisting to JSON file
 * Recovers 'processing' messages to 'pending' on restart (crash recovery)
 */
export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private readonly path: string;
  private readonly logger: Logger;

  /**
   * Create a new message queue
   * @param dataDir - Directory for queue.json file
   */
  constructor(dataDir: string) {
    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.path = `${dataDir}/queue.json`;
    this.logger = createChildLogger('queue');
    this.load();
  }

  /**
   * Load queue from disk and recover from crash state
   */
  private load(): void {
    if (!existsSync(this.path)) {
      this.logger.debug('No existing queue file, starting fresh');
      return;
    }

    try {
      const data = readFileSync(this.path, 'utf-8');
      const loaded: QueuedMessage[] = JSON.parse(data);

      // Filter out 'done' messages older than 1 hour
      const oneHourAgo = Date.now() - 3600000;
      this.queue = loaded.filter(
        (m) => m.status !== 'done' || m.timestamp > oneHourAgo
      );

      // Reset 'processing' messages to 'pending' (crash recovery)
      let recovered = 0;
      for (const msg of this.queue) {
        if (msg.status === 'processing') {
          msg.status = 'pending';
          recovered++;
        }
      }

      if (recovered > 0) {
        this.logger.info({ recovered }, 'Recovered processing messages to pending');
      }

      this.logger.info(
        { total: this.queue.length, stats: this.getStats() },
        'Loaded queue from disk'
      );

      this.persist();
    } catch (err) {
      this.logger.error({ err, path: this.path }, 'Failed to load queue, starting fresh');
      this.queue = [];
    }
  }

  /**
   * Persist queue to disk
   */
  private persist(): void {
    try {
      writeFileSync(this.path, JSON.stringify(this.queue, null, 2));
    } catch (err) {
      // Log but don't throw - persist failures shouldn't crash the app
      this.logger.error({ err, path: this.path }, 'Failed to persist queue');
    }
  }

  /**
   * Add a message to the queue
   * @param chatId - Telegram chat ID
   * @param text - Message text
   * @param media - Optional media attachments
   * @returns Message ID
   */
  add(chatId: number, text: string, media?: MediaAttachment[]): string {
    const id = randomUUID();
    const message: QueuedMessage = {
      id,
      chatId,
      text,
      timestamp: Date.now(),
      status: 'pending',
      media,
    };

    this.queue.push(message);
    this.persist();

    this.logger.debug(
      { id, chatId, textLength: text.length },
      'Added message to queue'
    );

    return id;
  }

  /**
   * Take the next pending message for processing
   * @returns Next pending message or undefined if queue empty
   */
  take(): QueuedMessage | undefined {
    const msg = this.queue.find((m) => m.status === 'pending');
    if (!msg) {
      return undefined;
    }

    msg.status = 'processing';
    this.persist();

    this.logger.debug({ id: msg.id, chatId: msg.chatId }, 'Took message for processing');

    return msg;
  }

  /**
   * Mark a message as completed
   * @param id - Message ID
   */
  complete(id: string): void {
    const msg = this.queue.find((m) => m.id === id);
    if (!msg) {
      this.logger.warn({ id }, 'Complete called for unknown message ID');
      return;
    }

    msg.status = 'done';
    this.persist();

    this.logger.debug({ id }, 'Marked message as done');
  }

  /**
   * Mark a message as failed
   * @param id - Message ID
   * @param error - Error description
   */
  fail(id: string, error: string): void {
    const msg = this.queue.find((m) => m.id === id);
    if (!msg) {
      this.logger.warn({ id }, 'Fail called for unknown message ID');
      return;
    }

    msg.status = 'failed';
    msg.error = error;
    this.persist();

    this.logger.error({ id, error }, 'Marked message as failed');
  }

  /**
   * Get all pending messages (for status display)
   * @returns Copy of pending messages
   */
  getPending(): QueuedMessage[] {
    return this.queue.filter((m) => m.status === 'pending').map((m) => ({ ...m }));
  }

  /**
   * Get queue statistics
   * @returns Counts by status
   */
  getStats(): QueueStats {
    let pending = 0;
    let processing = 0;
    let failed = 0;

    for (const msg of this.queue) {
      if (msg.status === 'pending') pending++;
      else if (msg.status === 'processing') processing++;
      else if (msg.status === 'failed') failed++;
    }

    return { pending, processing, failed };
  }
}
