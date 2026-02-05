/**
 * CLI for cron job management
 * Used by Claude to create/list/delete cron jobs via bash commands
 */

import {
  createCronJob,
  listCronJobs,
  getCronJob,
  updateCronJob,
  deleteCronJob,
  parseSchedule,
} from "../cron/index.js";
import { initializeHome } from "../memory/home.js";
import { createChildLogger } from "../utils/logger.js";
import { theme } from "./theme.js";

const log = createChildLogger("cron-cli");

/**
 * Run the cron CLI
 * @param args - Command line arguments (after 'cron')
 */
export async function runCronCLI(args: string[]): Promise<void> {
  const command = args[0];

  // Initialize home directory (ensures cron dir exists)
  initializeHome(log);

  switch (command) {
    case "add":
      await handleAdd(args.slice(1));
      break;
    case "list":
      handleList(args.slice(1));
      break;
    case "get":
      handleGet(args.slice(1));
      break;
    case "delete":
      await handleDelete(args.slice(1));
      break;
    case "update":
      handleUpdate(args.slice(1));
      break;
    case "enable":
      handleEnable(args[1]);
      break;
    case "disable":
      handleDisable(args[1]);
      break;
    default:
      console.log(`Usage: klausbot cron <command>

Commands:
  list            List cron jobs
  enable <id>     Enable a cron job
  disable <id>    Disable a cron job
  delete <id>     Delete a cron job

Examples:
  klausbot cron list
  klausbot cron enable abc-123
  klausbot cron disable abc-123
  klausbot cron delete --id abc-123
`);
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

async function handleAdd(args: string[]): Promise<void> {
  const opts = parseArgs(args);

  if (!opts.name || !opts.schedule || !opts.instruction || !opts.chatId) {
    theme.error("Missing required arguments");
    theme.info(
      "Usage: klausbot cron add --name <name> --schedule <schedule> --instruction <instruction> --chatId <chatId>",
    );
    process.exit(1);
  }

  const parsed = parseSchedule(opts.schedule);
  if (!parsed) {
    theme.error(`Could not parse schedule: "${opts.schedule}"`);
    process.exit(1);
  }

  const job = createCronJob({
    name: opts.name,
    schedule: parsed.schedule,
    instruction: opts.instruction,
    chatId: parseInt(opts.chatId, 10),
    humanSchedule: parsed.humanReadable,
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        job: {
          id: job.id,
          name: job.name,
          humanSchedule: job.humanSchedule,
          nextRunAt: job.nextRunAtMs
            ? new Date(job.nextRunAtMs).toISOString()
            : null,
        },
      },
      null,
      2,
    ),
  );
}

function handleList(args: string[]): void {
  const opts = parseArgs(args);
  const chatId = opts.chatId ? parseInt(opts.chatId, 10) : undefined;

  const jobs = listCronJobs(chatId);

  theme.header("Cron Jobs");
  if (jobs.length === 0) {
    theme.muted("  (none)");
  } else {
    for (const job of jobs) {
      const status = job.enabled
        ? theme.colors.green("\u2713")
        : theme.colors.dim("\u25CB");
      const nextRun = job.nextRunAtMs
        ? new Date(job.nextRunAtMs).toLocaleString()
        : "N/A";
      const lastStatus = job.lastStatus ?? "never run";

      theme.blank();
      theme.text(`${status} ${job.name}`);
      theme.keyValue("ID", job.id, { keyWidth: 10 });
      theme.keyValue("Schedule", job.humanSchedule, { keyWidth: 10 });
      theme.keyValue("Next run", nextRun, { keyWidth: 10 });
      theme.keyValue("Last", lastStatus, { keyWidth: 10 });
    }
  }
  theme.blank();
}

function handleGet(args: string[]): void {
  const opts = parseArgs(args);

  if (!opts.id) {
    theme.error("Missing --id argument");
    process.exit(1);
  }

  const job = getCronJob(opts.id);
  if (!job) {
    console.log(JSON.stringify({ success: false, error: "Job not found" }));
    process.exit(1);
  }

  console.log(JSON.stringify({ success: true, job }, null, 2));
}

function handleEnable(id: string | undefined): void {
  if (!id) {
    theme.error("Missing job ID");
    theme.info("Usage: klausbot cron enable <id>");
    process.exit(1);
  }

  const job = updateCronJob(id, { enabled: true });
  if (!job) {
    theme.error(`Job "${id}" not found`);
    process.exit(1);
  }

  theme.success(`Enabled: ${job.name}`);
}

function handleDisable(id: string | undefined): void {
  if (!id) {
    theme.error("Missing job ID");
    theme.info("Usage: klausbot cron disable <id>");
    process.exit(1);
  }

  const job = updateCronJob(id, { enabled: false });
  if (!job) {
    theme.error(`Job "${id}" not found`);
    process.exit(1);
  }

  theme.success(`Disabled: ${job.name}`);
}

async function handleDelete(args: string[]): Promise<void> {
  const opts = parseArgs(args);

  if (!opts.id) {
    theme.error("Missing --id argument");
    process.exit(1);
  }

  // Add confirmation before deleting (unless --force)
  if (opts.force !== "true") {
    const { confirm } = await import("@inquirer/prompts");
    const confirmed = await confirm({
      message: `Delete cron job "${opts.id}"?`,
      default: false,
    });
    if (!confirmed) {
      theme.info("Aborted.");
      return;
    }
  }

  const deleted = deleteCronJob(opts.id);
  console.log(JSON.stringify({ success: deleted }));
}

function handleUpdate(args: string[]): void {
  const opts = parseArgs(args);

  if (!opts.id) {
    theme.error("Missing --id argument");
    process.exit(1);
  }

  const updates: Parameters<typeof updateCronJob>[1] = {};

  if (opts.name) updates.name = opts.name;
  if (opts.instruction) updates.instruction = opts.instruction;
  if (opts.enabled) updates.enabled = opts.enabled === "true";

  if (opts.schedule) {
    const parsed = parseSchedule(opts.schedule);
    if (!parsed) {
      theme.error(`Could not parse schedule: "${opts.schedule}"`);
      process.exit(1);
    }
    updates.schedule = parsed.schedule;
    updates.humanSchedule = parsed.humanReadable;
  }

  const job = updateCronJob(opts.id, updates);
  if (!job) {
    console.log(JSON.stringify({ success: false, error: "Job not found" }));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        job: {
          id: job.id,
          name: job.name,
          humanSchedule: job.humanSchedule,
          nextRunAt: job.nextRunAtMs
            ? new Date(job.nextRunAtMs).toISOString()
            : null,
        },
      },
      null,
      2,
    ),
  );
}
