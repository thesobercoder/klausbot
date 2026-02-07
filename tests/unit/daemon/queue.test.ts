import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import os from "os";

// Mock logger before importing MessageQueue
vi.mock("../../../src/utils/logger.js", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { MessageQueue } from "../../../src/daemon/queue.js";

describe("MessageQueue", () => {
  let tmpDir: string;
  let queue: MessageQueue;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "klausbot-queue-test-"));
    queue = new MessageQueue(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("add and take", () => {
    it("add returns a UUID string", () => {
      const id = queue.add(12345, "hello");
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("take returns added message with status processing", () => {
      queue.add(12345, "hello");
      const msg = queue.take();
      expect(msg).toBeDefined();
      expect(msg!.chatId).toBe(12345);
      expect(msg!.text).toBe("hello");
      expect(msg!.status).toBe("processing");
    });

    it("take on empty queue returns undefined", () => {
      expect(queue.take()).toBeUndefined();
    });

    it("multiple adds, take returns FIFO order", () => {
      queue.add(1, "first");
      queue.add(2, "second");
      queue.add(3, "third");

      expect(queue.take()!.text).toBe("first");
      expect(queue.take()!.text).toBe("second");
      expect(queue.take()!.text).toBe("third");
      expect(queue.take()).toBeUndefined();
    });
  });

  describe("complete and fail", () => {
    it("complete sets status to done", () => {
      const id = queue.add(12345, "msg");
      queue.take(); // move to processing
      queue.complete(id);

      const stats = queue.getStats();
      expect(stats.processing).toBe(0);
      // done messages are not counted in pending/processing/failed
    });

    it("fail sets status to failed and records error", () => {
      const id = queue.add(12345, "msg");
      queue.take();
      queue.fail(id, "something went wrong");

      const stats = queue.getStats();
      expect(stats.failed).toBe(1);
    });

    it("complete with unknown id does not throw", () => {
      expect(() => queue.complete("nonexistent-id")).not.toThrow();
    });

    it("fail with unknown id does not throw", () => {
      expect(() => queue.fail("nonexistent-id", "err")).not.toThrow();
    });
  });

  describe("getStats", () => {
    it("empty queue: all zeros", () => {
      const stats = queue.getStats();
      expect(stats).toEqual({ pending: 0, processing: 0, failed: 0 });
    });

    it("after add: pending 1", () => {
      queue.add(1, "msg");
      expect(queue.getStats().pending).toBe(1);
    });

    it("after add + take: processing 1", () => {
      queue.add(1, "msg");
      queue.take();
      expect(queue.getStats().processing).toBe(1);
    });

    it("after add + take + complete: all 0", () => {
      const id = queue.add(1, "msg");
      queue.take();
      queue.complete(id);
      expect(queue.getStats()).toEqual({
        pending: 0,
        processing: 0,
        failed: 0,
      });
    });

    it("after add + take + fail: failed 1", () => {
      const id = queue.add(1, "msg");
      queue.take();
      queue.fail(id, "err");
      expect(queue.getStats().failed).toBe(1);
    });
  });

  describe("getPending", () => {
    it("returns copies of pending messages", () => {
      queue.add(1, "first");
      queue.add(2, "second");

      const pending = queue.getPending();
      expect(pending).toHaveLength(2);
      expect(pending[0].text).toBe("first");
      expect(pending[1].text).toBe("second");

      // Verify they are copies (modifying returned object doesn't affect queue)
      pending[0].text = "modified";
      const pendingAgain = queue.getPending();
      expect(pendingAgain[0].text).toBe("first");
    });

    it("excludes processing/done/failed messages", () => {
      const id1 = queue.add(1, "pending-msg");
      const id2 = queue.add(2, "will-process");
      queue.add(3, "also-pending");

      queue.take(); // takes id1 -> processing
      // id2 is still pending, id3 is still pending

      const pending = queue.getPending();
      // id1 is processing so excluded; id2 and id3 are pending
      expect(pending).toHaveLength(2);
      expect(pending.every((m) => m.status === "pending")).toBe(true);
    });
  });

  describe("persistence and crash recovery", () => {
    it("new queue from same directory loads persisted messages", () => {
      queue.add(12345, "persisted message");

      // Create new queue from same directory
      const queue2 = new MessageQueue(tmpDir);
      const stats = queue2.getStats();
      expect(stats.pending).toBe(1);
    });

    it("processing messages recovered to pending on new queue", () => {
      queue.add(12345, "will be processing");
      queue.take(); // status -> processing

      // Simulate crash: create new queue from same dir
      const queue2 = new MessageQueue(tmpDir);
      const stats = queue2.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.processing).toBe(0);
    });

    it("old done messages filtered out on load", () => {
      // Add message and complete it
      const id = queue.add(12345, "old done");
      queue.take();
      queue.complete(id);

      // Manually backdate the timestamp to > 1hr ago
      const filePath = join(tmpDir, "queue.json");
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      data[0].timestamp = Date.now() - 2 * 3600000; // 2 hours ago
      writeFileSync(filePath, JSON.stringify(data));

      // New queue should filter out old done message
      const queue2 = new MessageQueue(tmpDir);
      const stats = queue2.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it("persists queue.json file to disk", () => {
      queue.add(12345, "check file");
      const filePath = join(tmpDir, "queue.json");
      expect(existsSync(filePath)).toBe(true);

      const content = JSON.parse(readFileSync(filePath, "utf-8"));
      expect(content).toHaveLength(1);
      expect(content[0].text).toBe("check file");
    });
  });

  describe("threading context", () => {
    it("preserves messageThreadId and replyToMessageId", () => {
      queue.add(12345, "threaded", undefined, {
        messageThreadId: 42,
        replyToMessageId: 99,
      });

      const msg = queue.take();
      expect(msg!.threading).toBeDefined();
      expect(msg!.threading!.messageThreadId).toBe(42);
      expect(msg!.threading!.replyToMessageId).toBe(99);
    });

    it("threading is undefined when not provided", () => {
      queue.add(12345, "no threading");
      const msg = queue.take();
      expect(msg!.threading).toBeUndefined();
    });
  });

  describe("media attachments", () => {
    it("preserves media array", () => {
      const media = [
        {
          type: "voice" as const,
          fileId: "voice-123",
          localPath: "/tmp/v.ogg",
        },
        {
          type: "photo" as const,
          fileId: "photo-456",
          localPath: "/tmp/p.jpg",
        },
      ];

      queue.add(12345, "with media", media);
      const msg = queue.take();
      expect(msg!.media).toHaveLength(2);
      expect(msg!.media![0].type).toBe("voice");
      expect(msg!.media![1].type).toBe("photo");
    });

    it("media is undefined when not provided", () => {
      queue.add(12345, "no media");
      const msg = queue.take();
      expect(msg!.media).toBeUndefined();
    });
  });
});
