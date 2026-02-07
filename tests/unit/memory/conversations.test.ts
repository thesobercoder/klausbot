import { describe, expect, it } from "vitest";
import {
  parseTranscript,
  extractConversationText,
} from "../../../src/memory/conversations.js";

describe("parseTranscript", () => {
  it("valid JSONL (2 lines) returns 2 entries with correct types", () => {
    const input = [
      JSON.stringify({ type: "user", message: { role: "user", content: [] } }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [] },
      }),
    ].join("\n");

    const entries = parseTranscript(input);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("user");
    expect(entries[1].type).toBe("assistant");
  });

  it("malformed line mixed with valid -> skips malformed, returns valid", () => {
    const input = [
      JSON.stringify({ type: "user", message: { role: "user", content: [] } }),
      "NOT VALID JSON {{{",
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [] },
      }),
    ].join("\n");

    const entries = parseTranscript(input);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("user");
    expect(entries[1].type).toBe("assistant");
  });

  it("empty string returns []", () => {
    expect(parseTranscript("")).toEqual([]);
  });

  it("single line returns 1 entry", () => {
    const input = JSON.stringify({
      type: "summary",
      message: { content: [] },
    });
    const entries = parseTranscript(input);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("summary");
  });
});

describe("extractConversationText", () => {
  it("user and assistant entries with array content -> formatted text", () => {
    const entries = [
      {
        type: "user" as const,
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello there" }],
        },
      },
      {
        type: "assistant" as const,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hi! How are you?" }],
        },
      },
    ];

    const text = extractConversationText(entries);
    expect(text).toBe("User: Hello there\n\nAssistant: Hi! How are you?");
  });

  it("entry with string content handles correctly", () => {
    const entries = [
      {
        type: "user" as const,
        message: { role: "user", content: "Just a string" as unknown },
      },
    ];

    // content is string type — the function handles this case
    const text = extractConversationText(
      entries as Parameters<typeof extractConversationText>[0],
    );
    expect(text).toBe("User: Just a string");
  });

  it("entry with no text content is skipped", () => {
    const entries = [
      {
        type: "user" as const,
        message: {
          role: "user",
          content: [{ type: "image", text: undefined }],
        },
      },
      {
        type: "assistant" as const,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Response" }],
        },
      },
    ];

    const text = extractConversationText(entries);
    expect(text).toBe("Assistant: Response");
  });

  it("mixed entry types: only user/assistant included", () => {
    const entries = [
      {
        type: "summary" as const,
        message: {
          content: [{ type: "text", text: "Summary content" }],
        },
      },
      {
        type: "system" as const,
        message: {
          content: [{ type: "text", text: "System message" }],
        },
      },
      {
        type: "user" as const,
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      },
    ];

    const text = extractConversationText(entries);
    expect(text).toBe("User: Hello");
  });

  it("empty entries array returns empty string", () => {
    expect(extractConversationText([])).toBe("");
  });
});
