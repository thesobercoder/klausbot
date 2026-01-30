/**
 * Memory MCP tools
 * Exposes search_memories to Claude for semantic memory search
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { semanticSearch } from '../../memory/search.js';

/**
 * Register memory tools with MCP server
 */
export function registerMemoryTools(server: McpServer): void {
  // search_memories: Search past conversations semantically
  server.tool(
    'search_memories',
    'Search past conversations semantically. Returns relevant memories based on meaning, not just keywords.',
    {
      query: z.string().describe('Natural language search query (e.g., "discussions about project deadlines")'),
      limit: z.number().optional().default(5).describe('Max results to return (default: 5)'),
      days_back: z.number().optional().describe('Only search memories from last N days (omit for all time)'),
    },
    async ({ query, limit, days_back }) => {
      try {
        const results = await semanticSearch(query, {
          topK: limit,
          daysBack: days_back,
        });

        if (results.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No relevant memories found for that query.',
            }],
          };
        }

        // Format results
        const formatted = results.map((r, i) => {
          const date = new Date(r.timestamp).toLocaleDateString();
          const score = (r.score * 100).toFixed(0);
          return `[${i + 1}] (${score}% match, ${date})\n${r.text}`;
        }).join('\n\n');

        return {
          content: [{
            type: 'text' as const,
            text: `Found ${results.length} relevant memories:\n\n${formatted}`,
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: 'text' as const,
            text: `Error searching memories: ${msg}`,
          }],
        };
      }
    }
  );
}
