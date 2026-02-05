/**
 * Memory MCP tools
 * Exposes search_memories to Claude for semantic memory search
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  semanticSearch,
  searchConversations,
  type ConversationSearchResult,
} from "../../memory/search.js";
import { createMcpLogger } from "../../utils/index.js";

const log = createMcpLogger("mcp:memory");

/**
 * Register memory tools with MCP server
 */
export function registerMemoryTools(server: McpServer): void {
  // search_memories: Search past conversations semantically
  server.tool(
    "search_memories",
    `Search ALL past conversations and memories - no time limit, full history available.

USE THIS WHEN:
- User says "we talked about", "remember when", "what did I say about", "last time"
- User asks about something you should know but don't see in current context
- You want to check if something was discussed before (don't guess - search)
- Injected context summaries seem incomplete - there's always more history

Returns matching memories and conversation summaries with session IDs for drill-down.`,
    {
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
      days_back: z
        .number()
        .optional()
        .describe("Only search memories from last N days (omit for all time)"),
      include_conversations: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include conversation history in search (default: true)"),
    },
    async ({ query, limit, days_back, include_conversations }) => {
      try {
        log.info(
          { query, limit, days_back, include_conversations },
          "search_memories called",
        );

        // Search embeddings
        const embeddingResults = await semanticSearch(query, {
          topK: limit,
          daysBack: days_back,
        });

        // Search conversations if enabled
        let conversationResults: ConversationSearchResult[] = [];
        if (include_conversations) {
          conversationResults = searchConversations(query, {
            topK: limit,
            daysBack: days_back,
          });
        }

        // Format embedding results
        const embeddingFormatted = embeddingResults.map((r, i) => {
          const date = new Date(r.timestamp).toLocaleDateString();
          const score = (r.score * 100).toFixed(0);
          return `[Memory ${i + 1}] (${score}% match, ${date})\n${r.text}`;
        });

        // Format conversation results
        const conversationFormatted = conversationResults.map((r, i) => {
          const date = new Date(r.endedAt).toLocaleDateString();
          const score = (r.score * 100).toFixed(0);
          return `[Conversation ${i + 1}] (${score}% match, ${date}, ${r.messageCount} msgs)\nSession: ${r.sessionId}\n${r.summary}`;
        });

        // Combine results
        const totalResults =
          embeddingResults.length + conversationResults.length;

        if (totalResults === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No relevant memories or conversations found for that query.",
              },
            ],
          };
        }

        let output = "";
        if (embeddingFormatted.length > 0) {
          output += `=== Memory Embeddings (${embeddingFormatted.length}) ===\n\n${embeddingFormatted.join("\n\n")}\n\n`;
        }
        if (conversationFormatted.length > 0) {
          output += `=== Conversation History (${conversationFormatted.length}) ===\n\n${conversationFormatted.join("\n\n")}`;
          output +=
            "\n\nTip: Use get_conversation with a session_id to retrieve full transcript.";
        }

        log.info(
          {
            embeddingCount: embeddingResults.length,
            conversationCount: conversationResults.length,
          },
          "search_memories completed",
        );

        return {
          content: [
            {
              type: "text" as const,
              text: output.trim(),
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error({ error: msg }, "search_memories failed");
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching memories: ${msg}`,
            },
          ],
        };
      }
    },
  );
}
