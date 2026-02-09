import { describe, expect, it, vi } from "vitest";

// Mock executor to provide getHeartbeatPath
vi.mock("../../../src/heartbeat/executor.js", () => ({
  getHeartbeatPath: () => "/mock/.klausbot/identity/HEARTBEAT.md",
}));

import {
  shouldCollectNote,
  getNoteCollectionInstructions,
} from "../../../src/heartbeat/notes.js";

describe("shouldCollectNote", () => {
  it.each([
    ["remind me to check the server", "remind me"],
    ["don't forget about the meeting", "don't forget"],
    ["dont forget the deadline", "dont forget (no apostrophe)"],
    ["check on the deployment status", "check on"],
    ["remember to call John", "remember to"],
    ["heartbeat: water the plants", "heartbeat:"],
    ["can you add a reminder for Friday", "add...reminder"],
    ["keep track of my weight", "keep track of"],
  ])("returns true for %j (%s)", (text) => {
    expect(shouldCollectNote(text)).toBe(true);
  });

  it.each([
    "hello there",
    "what's the weather",
    "tell me a joke",
    "I remember when I was young",
  ])("returns false for %j", (text) => {
    expect(shouldCollectNote(text)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(shouldCollectNote("REMIND ME to eat")).toBe(true);
    expect(shouldCollectNote("Check On the status")).toBe(true);
  });
});

describe("getNoteCollectionInstructions", () => {
  it("wraps output in heartbeat-note-request tags", () => {
    const result = getNoteCollectionInstructions("remind me to eat");
    expect(result).toContain("<heartbeat-note-request>");
    expect(result).toContain("</heartbeat-note-request>");
  });

  it("includes the user message", () => {
    const msg = "remind me to check the server at 5pm";
    const result = getNoteCollectionInstructions(msg);
    expect(result).toContain(msg);
  });

  it("includes the heartbeat file path", () => {
    const result = getNoteCollectionInstructions("test");
    expect(result).toContain("HEARTBEAT.md");
  });

  it("includes formatting instructions", () => {
    const result = getNoteCollectionInstructions("test");
    expect(result).toContain("## Active Items");
    expect(result).toContain("- [ ]");
    expect(result).toContain("[expires:");
  });
});
