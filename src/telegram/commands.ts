import { bot, type MyContext } from "./bot.js";
import { handleStartCommand, getPairingStore } from "../pairing/index.js";
import type { MessageQueue } from "../daemon/queue.js";
import { createChildLogger } from "../utils/index.js";
import { listCronJobs } from "../cron/index.js";

const log = createChildLogger("commands");

/**
 * Set up Telegram command handlers
 * Commands are registered with BotFather and handled here
 *
 * @param queue - Optional queue for status command (provided when used standalone)
 */
export function setupCommands(queue?: MessageQueue): void {
  // /start - pairing flow
  bot.command("start", handleStartCommand);

  // /model - model switching (placeholder)
  bot.command("model", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    log.info({ chatId }, "/model command invoked");
    await ctx.reply(
      "Current model: default\nModel switching coming in Phase 2",
    );
  });

  // /status - queue and approval status
  bot.command("status", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    log.info({ chatId }, "/status command invoked");

    const store = getPairingStore();
    const isApproved = store.isApproved(chatId);

    let statusLines = ["*Status*", `Approved: ${isApproved ? "Yes" : "No"}`];

    if (queue) {
      const stats = queue.getStats();
      statusLines = [
        "*Queue Status*",
        `Pending: ${stats.pending}`,
        `Processing: ${stats.processing}`,
        `Failed: ${stats.failed}`,
        "",
        "*Your Status*",
        `Approved: ${isApproved ? "Yes" : "No"}`,
      ];
    }

    await ctx.reply(statusLines.join("\n"), { parse_mode: "Markdown" });
  });

  // /help - list commands
  bot.command("help", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    log.info({ chatId }, "/help command invoked");

    const helpMsg = [
      "*Available Commands*",
      "/start - Request pairing or check status",
      "/status - Show queue and approval status",
      "/model - Show current model info",
      "/crons - List scheduled tasks",
      "/help - Show this help message",
      "",
      "Send any message to chat with Claude.",
    ].join("\n");

    await ctx.reply(helpMsg, { parse_mode: "Markdown" });
  });

  // /crons - list scheduled tasks
  bot.command("crons", async (ctx: MyContext) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    log.info({ chatId }, "/crons command invoked");

    const jobs = listCronJobs(chatId);
    const enabledJobs = jobs.filter((j) => j.enabled);

    if (enabledJobs.length === 0) {
      await ctx.reply(
        'No scheduled tasks.\n\nCreate one with natural language, e.g.:\n"Remind me every morning at 9am to check emails"',
      );
      return;
    }

    const lines = enabledJobs.map((job) => {
      const nextRun = job.nextRunAtMs
        ? new Date(job.nextRunAtMs).toLocaleString()
        : "never";
      const status = job.lastStatus ? ` (last: ${job.lastStatus})` : "";
      return `- *${job.name}*: ${job.humanSchedule}\n  Next: ${nextRun}${status}`;
    });

    await ctx.reply(
      `*Scheduled Tasks*\n\n${lines.join("\n\n")}\n\n_Modify or delete via conversation_`,
      { parse_mode: "Markdown" },
    );
  });

  log.info("Commands registered: /start, /model, /status, /help, /crons");
}
