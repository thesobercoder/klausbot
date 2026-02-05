/**
 * Conversation MCP tools
 * Exposes get_conversation to retrieve full transcripts
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getConversationBySessionId,
  parseTranscript,
  extractConversationText,
} from "../../memory/conversations.js";
import { createMcpLogger } from "../../utils/index.js";

const log = createMcpLogger("mcp:conversations");

/**
 * Register conversation tools with MCP server
 */
export function registerConversationTools(server: McpServer): void {
  // get_conversation: Retrieve full transcript by session ID
  server.tool(
    "get_conversation",
    `Retrieve the COMPLETE transcript of a past conversation - every message, full detail.

USE THIS WHEN:
- search_memories found a relevant conversation but you need the full context
- User wants exact details of what was said (not just a summary)
- You need to quote or reference specific parts of a past discussion

First use search_memories to find relevant session IDs, then use this to get full transcript.`,
    {
      session_id: z
        .string()
        .describe("Session ID from search_memories results"),
    },
    async ({ session_id }) => {
      try {
        log.info({ session_id }, "get_conversation called");

        const conversation = getConversationBySessionId(session_id);

        if (!conversation) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Conversation not found: ${session_id}`,
              },
            ],
          };
        }

        // Parse and format transcript for readability
        const entries = parseTranscript(conversation.transcript);
        const formatted = extractConversationText(entries);

        const header = [
          `=== Conversation: ${session_id} ===`,
          `Started: ${new Date(conversation.startedAt).toLocaleString()}`,
          `Ended: ${new Date(conversation.endedAt).toLocaleString()}`,
          `Messages: ${conversation.messageCount}`,
          `Summary: ${conversation.summary}`,
          "",
          "=== Transcript ===",
          "",
        ].join("\n");

        log.info(
          { session_id, messageCount: conversation.messageCount },
          "get_conversation completed",
        );

        return {
          content: [
            {
              type: "text" as const,
              text: header + formatted,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error({ error: msg, session_id }, "get_conversation failed");
        return {
          content: [
            {
              type: "text" as const,
              text: `Error retrieving conversation: ${msg}`,
            },
          ],
        };
      }
    },
  );
}
