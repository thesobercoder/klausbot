/**
 * Cron MCP tools
 * Exposes create_cron, list_crons, delete_cron to Claude
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createCronJob,
  listCronJobs,
  deleteCronJob,
  updateCronJob,
  getCronJob,
} from "../../cron/service.js";
import { parseSchedule } from "../../cron/parse.js";
import { createMcpLogger } from "../../utils/index.js";

const log = createMcpLogger("mcp:cron");

/**
 * Register cron tools with MCP server
 */
export function registerCronTools(server: McpServer): void {
  // create_cron: Create a new scheduled task
  server.tool(
    "create_cron",
    "Create a scheduled task that runs at specified times",
    {
      name: z.string().describe("Job name (human-readable identifier)"),
      schedule: z
        .string()
        .describe(
          "Schedule: cron expression or natural language like 'every day at 9am', 'every 5 minutes', 'tomorrow at 3pm'",
        ),
      instruction: z
        .string()
        .describe("What Claude should do when the job runs"),
      chatId: z.number().describe("Telegram chat ID for notifications"),
    },
    async ({ name, schedule, instruction, chatId }) => {
      log.info({ name, schedule, chatId }, "create_cron called");
      // Parse schedule string to CronSchedule
      const parsed = parseSchedule(schedule);

      if (!parsed) {
        log.warn({ schedule }, "create_cron invalid schedule");
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Could not parse schedule "${schedule}". Try formats like:\n- "every 5 minutes"\n- "every day at 9am"\n- "tomorrow at 3pm"\n- "0 9 * * *" (cron expression)`,
            },
          ],
        };
      }

      if (!parsed.nextRun) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Schedule "${schedule}" is in the past. Please specify a future time.`,
            },
          ],
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

      log.info({ jobId: job.id, name }, "create_cron completed");
      return {
        content: [
          {
            type: "text" as const,
            text: `Created scheduled task "${name}" (${job.id})\nSchedule: ${parsed.humanReadable}\nNext run: ${parsed.nextRun.toLocaleString()}`,
          },
        ],
      };
    },
  );

  // list_crons: List scheduled tasks for a chat
  server.tool(
    "list_crons",
    "List all scheduled tasks for a Telegram chat",
    {
      chatId: z.number().describe("Telegram chat ID to filter jobs"),
    },
    async ({ chatId }) => {
      log.info({ chatId }, "list_crons called");
      const jobs = listCronJobs(chatId);

      if (jobs.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No scheduled tasks found for this chat.",
            },
          ],
        };
      }

      // Format jobs as readable list
      const lines = jobs.map((job) => {
        const status = job.lastStatus ? ` (last: ${job.lastStatus})` : "";
        const nextRun = job.nextRunAtMs
          ? new Date(job.nextRunAtMs).toLocaleString()
          : "N/A";
        const enabled = job.enabled ? "" : " [DISABLED]";
        return `- ${job.name}${enabled}\n  ID: ${job.id}\n  Schedule: ${job.humanSchedule}\n  Next: ${nextRun}${status}`;
      });

      log.info({ count: jobs.length }, "list_crons completed");
      return {
        content: [
          {
            type: "text" as const,
            text: `Scheduled tasks (${jobs.length}):\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    },
  );

  // delete_cron: Delete a scheduled task
  server.tool(
    "delete_cron",
    "Delete a scheduled task by ID",
    {
      id: z.string().describe("Job ID to delete (UUID)"),
    },
    async ({ id }) => {
      log.info({ id }, "delete_cron called");
      const deleted = deleteCronJob(id);

      if (!deleted) {
        log.warn({ id }, "delete_cron job not found");
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Job "${id}" not found. Use list_crons to see available jobs.`,
            },
          ],
        };
      }

      log.info({ id }, "delete_cron completed");
      return {
        content: [
          {
            type: "text" as const,
            text: `Deleted scheduled task ${id}`,
          },
        ],
      };
    },
  );

  // update_cron: Modify an existing scheduled task
  server.tool(
    "update_cron",
    `Modify an existing scheduled task - change its name, schedule, instruction, or enable/disable it.

USE THIS WHEN:
- User wants to change the time of a reminder ("change my morning reminder to 10am")
- User wants to update what a scheduled task does
- User wants to pause/resume a task (enable/disable)
- User says "update", "change", "modify" about a scheduled task`,
    {
      id: z.string().describe("Job ID to update (UUID from list_crons)"),
      name: z.string().optional().describe("New name for the job"),
      schedule: z
        .string()
        .optional()
        .describe(
          "New schedule: cron expression or natural language like 'every day at 10am'",
        ),
      instruction: z
        .string()
        .optional()
        .describe("New instruction for what Claude should do"),
      enabled: z
        .boolean()
        .optional()
        .describe("Enable (true) or disable (false) the job"),
    },
    async ({ id, name, schedule, instruction, enabled }) => {
      log.info({ id, name, schedule, enabled }, "update_cron called");

      // Check job exists
      const existing = getCronJob(id);
      if (!existing) {
        log.warn({ id }, "update_cron job not found");
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Job "${id}" not found. Use list_crons to see available jobs.`,
            },
          ],
        };
      }

      // Build updates object
      const updates: Parameters<typeof updateCronJob>[1] = {};
      if (name !== undefined) updates.name = name;
      if (instruction !== undefined) updates.instruction = instruction;
      if (enabled !== undefined) updates.enabled = enabled;

      // Parse new schedule if provided
      let humanSchedule: string | undefined;
      if (schedule !== undefined) {
        const parsed = parseSchedule(schedule);
        if (!parsed) {
          log.warn({ schedule }, "update_cron invalid schedule");
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Could not parse schedule "${schedule}". Try formats like:\n- "every 5 minutes"\n- "every day at 9am"\n- "0 9 * * *" (cron expression)`,
              },
            ],
          };
        }
        updates.schedule = parsed.schedule;
        updates.humanSchedule = parsed.humanReadable;
        humanSchedule = parsed.humanReadable;
      }

      // Apply updates
      const updated = updateCronJob(id, updates);
      if (!updated) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Failed to update job "${id}".`,
            },
          ],
        };
      }

      // Build response
      const changes: string[] = [];
      if (name !== undefined) changes.push(`name: "${name}"`);
      if (humanSchedule) changes.push(`schedule: ${humanSchedule}`);
      if (instruction !== undefined) changes.push("instruction updated");
      if (enabled !== undefined) changes.push(enabled ? "enabled" : "disabled");

      const nextRun = updated.nextRunAtMs
        ? new Date(updated.nextRunAtMs).toLocaleString()
        : "N/A";

      log.info({ id, changes }, "update_cron completed");
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated scheduled task "${updated.name}"\nChanges: ${changes.join(", ")}\nNext run: ${nextRun}`,
          },
        ],
      };
    },
  );
}
