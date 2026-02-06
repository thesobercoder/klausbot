/**
 * Background task MCP tools
 * Exposes start_background_task to Claude as a signal for the daemon
 *
 * The tool itself is a pure signal — the daemon detects the tool call
 * from stream events and spawns `claude --resume` as a background process.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpLogger } from "../../utils/index.js";

const log = createMcpLogger("mcp:background");

/**
 * Register background task tools with MCP server
 */
export function registerBackgroundTools(server: McpServer): void {
  server.tool(
    "start_background_task",
    "Signal that you want to continue working on a task in the background after responding to the user. The daemon will resume your session automatically.",
    {
      description: z
        .string()
        .describe(
          "Brief description of the background work to be done (shown to user in notification)",
        ),
    },
    async ({ description }) => {
      log.info({ description }, "Background task signal received");

      return {
        content: [
          {
            type: "text" as const,
            text: `Background task queued: "${description}". The daemon will resume this session to complete the work. Now give the user a brief acknowledgment and finish your response.`,
          },
        ],
      };
    },
  );
}
