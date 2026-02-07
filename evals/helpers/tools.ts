/**
 * Mock MCP tools for eval suites.
 *
 * AI SDK `tool()` definitions that simulate production tool behavior
 * against in-memory fixture data. Tool descriptions are copied verbatim
 * from production src/mcp-server/tools/.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ConversationFixture } from "./fixtures.js";

/**
 * Create all mock tools wired to the given fixtures.
 *
 * @param fixtures - Conversation fixtures to search/retrieve against
 * @returns AI SDK tool definitions keyed by tool name
 */
export function createMockTools(fixtures: ConversationFixture[]) {
  return {
    search_memories: createSearchMemoriesTool(fixtures),
    get_conversation: createGetConversationTool(fixtures),
    create_cron: createCronTool(),
    start_background_task: createBackgroundTaskTool(),
  };
}

/**
 * search_memories — keyword match against fixture summaries.
 * Description copied from src/mcp-server/tools/memory.ts.
 */
function createSearchMemoriesTool(fixtures: ConversationFixture[]) {
  return tool({
    description: `Search ALL past conversations and memories - no time limit, full history available.

USE THIS WHEN:
- User says "we talked about", "remember when", "what did I say about", "last time"
- User asks about something you should know but don't see in current context
- You want to check if something was discussed before (don't guess - search)
- Injected context summaries seem incomplete - there's always more history

Returns matching memories and conversation summaries with session IDs for drill-down.`,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Natural language search query (e.g., "discussions about project deadlines")',
        ),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Max results to return (default: 5)"),
    }),
    execute: async ({ query }) => {
      const queryLower = query.toLowerCase();
      const matches = fixtures.filter((f) => {
        // Match against summary text
        if (f.summary.toLowerCase().includes(queryLower)) return true;
        // Match against fact keywords
        return f.facts.some((fact) =>
          fact.keywords.some((kw) => queryLower.includes(kw)),
        );
      });

      if (matches.length === 0) {
        return "No relevant memories or conversations found for that query.";
      }

      const results = matches.map((m, i) => {
        const date = new Date(m.endedAt).toLocaleDateString();
        return `[Conversation ${i + 1}] (85% match, ${date}, ${m.transcript.length} msgs)\nSession: ${m.sessionId}\n${m.summary}`;
      });

      return `=== Conversation History (${results.length}) ===\n\n${results.join("\n\n")}\n\nTip: Use get_conversation with a session_id to retrieve full transcript.`;
    },
  });
}

/**
 * get_conversation — look up fixture by sessionId, return transcript.
 * Description copied from src/mcp-server/tools/conversations.ts.
 */
function createGetConversationTool(fixtures: ConversationFixture[]) {
  return tool({
    description: `Retrieve the COMPLETE transcript of a past conversation - every message, full detail.

USE THIS WHEN:
- search_memories found a relevant conversation but you need the full context
- User wants exact details of what was said (not just a summary)
- You need to quote or reference specific parts of a past discussion

First use search_memories to find relevant session IDs, then use this to get full transcript.`,
    inputSchema: z.object({
      session_id: z
        .string()
        .describe("Session ID from search_memories results"),
    }),
    execute: async ({ session_id }) => {
      const fixture = fixtures.find((f) => f.sessionId === session_id);
      if (!fixture) {
        return `Conversation not found: ${session_id}`;
      }

      const formatted = fixture.transcript
        .map((msg) => `[${msg.role}] ${msg.text}`)
        .join("\n");

      return [
        `=== Conversation: ${session_id} ===`,
        `Started: ${new Date(fixture.startedAt).toLocaleString()}`,
        `Ended: ${new Date(fixture.endedAt).toLocaleString()}`,
        `Messages: ${fixture.transcript.length}`,
        `Summary: ${fixture.summary}`,
        "",
        "=== Transcript ===",
        "",
        formatted,
      ].join("\n");
    },
  });
}

/**
 * create_cron — simple confirmation stub.
 * Description copied from src/mcp-server/tools/cron.ts.
 */
function createCronTool() {
  return tool({
    description: "Create a scheduled task that runs at specified times",
    inputSchema: z.object({
      name: z.string().describe("Job name (human-readable identifier)"),
      schedule: z
        .string()
        .describe(
          "Schedule: cron expression or natural language like 'every day at 9am'",
        ),
      instruction: z
        .string()
        .describe("What Claude should do when the job runs"),
    }),
    execute: async ({ name, schedule }) => {
      return `Created scheduled task "${name}" (eval-cron-001)\nSchedule: ${schedule}\nNext run: tomorrow`;
    },
  });
}

/**
 * start_background_task — simple confirmation stub.
 * Description copied from src/mcp-server/tools/background.ts.
 */
function createBackgroundTaskTool() {
  return tool({
    description:
      "Signal that you want to continue working on a task in the background after responding to the user. The daemon will resume your session automatically.",
    inputSchema: z.object({
      description: z
        .string()
        .describe(
          "Brief description of the background work to be done (shown to user in notification)",
        ),
      kind: z
        .enum(["coding", "general"])
        .default("general")
        .describe(
          "Task kind: 'coding' for programming/file-editing, 'general' for research/conversation",
        ),
    }),
    execute: async ({ description }) => {
      return `Background task queued: "${description}". The daemon will resume this session to complete the work. Now give the user a brief acknowledgment and finish your response.`;
    },
  });
}
