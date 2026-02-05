/**
 * MCP Server module
 * Exposes cron tools to Claude CLI via stdio transport
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCronTools } from "./tools/cron.js";
import { registerMemoryTools } from "./tools/memory.js";
import { registerConversationTools } from "./tools/conversations.js";
import { createMcpLogger } from "../utils/index.js";

const log = createMcpLogger("mcp-server");

/**
 * Run the MCP server
 * Called by `klausbot mcp-server` subcommand
 */
export async function runMcpServer(): Promise<void> {
  // Create MCP server instance
  const server = new McpServer({
    name: "klausbot",
    version: "1.0.0",
  });

  // Register all tools
  registerCronTools(server);
  registerMemoryTools(server);
  registerConversationTools(server);

  // Connect to stdio transport (spawned by Claude CLI)
  log.info("MCP server starting");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("MCP server connected to stdio transport");
}
