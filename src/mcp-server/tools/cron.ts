/**
 * Cron MCP tools
 * Exposes create_cron, list_crons, delete_cron to Claude
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCronJob, listCronJobs, deleteCronJob } from '../../cron/service.js';
import { parseSchedule } from '../../cron/parse.js';

/**
 * Register cron tools with MCP server
 */
export function registerCronTools(server: McpServer): void {
  // create_cron: Create a new scheduled task
  server.tool(
    'create_cron',
    'Create a scheduled task that runs at specified times',
    {
      name: z.string().describe('Job name (human-readable identifier)'),
      schedule: z.string().describe("Schedule: cron expression or natural language like 'every day at 9am', 'every 5 minutes', 'tomorrow at 3pm'"),
      instruction: z.string().describe('What Claude should do when the job runs'),
      chatId: z.number().describe('Telegram chat ID for notifications'),
    },
    async ({ name, schedule, instruction, chatId }) => {
      // Parse schedule string to CronSchedule
      const parsed = parseSchedule(schedule);

      if (!parsed) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: Could not parse schedule "${schedule}". Try formats like:\n- "every 5 minutes"\n- "every day at 9am"\n- "tomorrow at 3pm"\n- "0 9 * * *" (cron expression)`,
          }],
        };
      }

      if (!parsed.nextRun) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: Schedule "${schedule}" is in the past. Please specify a future time.`,
          }],
        };
      }

      // Create job via service
      const job = createCronJob({
        name,
        schedule: parsed.schedule,
        instruction,
        chatId,
        humanSchedule: parsed.humanReadable,
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Created scheduled task "${name}" (${job.id})\nSchedule: ${parsed.humanReadable}\nNext run: ${parsed.nextRun.toLocaleString()}`,
        }],
      };
    }
  );

  // list_crons: List scheduled tasks for a chat
  server.tool(
    'list_crons',
    'List all scheduled tasks for a Telegram chat',
    {
      chatId: z.number().describe('Telegram chat ID to filter jobs'),
    },
    async ({ chatId }) => {
      const jobs = listCronJobs(chatId);

      if (jobs.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No scheduled tasks found for this chat.',
          }],
        };
      }

      // Format jobs as readable list
      const lines = jobs.map((job) => {
        const status = job.lastStatus ? ` (last: ${job.lastStatus})` : '';
        const nextRun = job.nextRunAtMs
          ? new Date(job.nextRunAtMs).toLocaleString()
          : 'N/A';
        const enabled = job.enabled ? '' : ' [DISABLED]';
        return `- ${job.name}${enabled}\n  ID: ${job.id}\n  Schedule: ${job.humanSchedule}\n  Next: ${nextRun}${status}`;
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Scheduled tasks (${jobs.length}):\n\n${lines.join('\n\n')}`,
        }],
      };
    }
  );

  // delete_cron: Delete a scheduled task
  server.tool(
    'delete_cron',
    'Delete a scheduled task by ID',
    {
      id: z.string().describe('Job ID to delete (UUID)'),
    },
    async ({ id }) => {
      const deleted = deleteCronJob(id);

      if (!deleted) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: Job "${id}" not found. Use list_crons to see available jobs.`,
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Deleted scheduled task ${id}`,
        }],
      };
    }
  );
}
