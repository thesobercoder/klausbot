/**
 * MCP Server module
 * Exposes cron tools to Claude CLI via stdio transport
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCronTools } from './tools/cron.js';

/**
 * Run the MCP server
 * Called by `klausbot mcp-server` subcommand
 */
export async function runMcpServer(): Promise<void> {
  // Create MCP server instance
  const server = new McpServer({
    name: 'klausbot',
    version: '1.0.0',
  });

  // Register all tools
  registerCronTools(server);

  // Connect to stdio transport (spawned by Claude CLI)
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
