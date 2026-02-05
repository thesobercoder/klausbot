#!/usr/bin/env node
/**
 * klausbot - Telegram gateway for Claude Code
 *
 * Entry point and CLI dispatcher using Commander.js
 *
 * Note: Uses dynamic imports to avoid loading config/bot for help command
 */

import { Command } from "commander";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { theme } from "./cli/theme.js";

// Load .env from both locations (later loads don't override existing)
// 1. Current directory (for development)
// 2. ~/.klausbot/.env (for production)
dotenv.config();
dotenv.config({ path: join(homedir(), ".klausbot", ".env") });

/**
 * Get package version from package.json
 */
function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Navigate up from dist/index.js to project root
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Silence logging for CLI commands
 * Must be called before importing config/logger
 */
function silenceLogs(): void {
  process.env.LOG_LEVEL = "silent";
}

/**
 * Format relative time for display
 */
function formatAge(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Create CLI program
const program = new Command();

// Customize help output colors (like kubectl, gh CLI)
program.configureHelp({
  // Color command names magenta (purple theme)
  subcommandTerm: (cmd) => {
    const name = cmd.name();
    const alias = cmd.alias();
    // Get arguments only (skip [options] clutter)
    const args = cmd.registeredArguments
      .map((arg) => (arg.required ? `<${arg.name()}>` : `[${arg.name()}]`))
      .join(" ");
    // Subcommands indicator
    const subCmds = cmd.commands.length > 0 ? "[command]" : "";

    let term = alias ? `${name}|${alias}` : name;
    if (args) term += ` ${args}`;
    if (subCmds) term += ` ${subCmds}`;

    return theme.colors.magenta(term);
  },
  // Color option flags magenta (purple theme)
  optionTerm: (option) => {
    return theme.colors.magenta(option.flags);
  },
});

program
  .name("klausbot")
  .description("Telegram gateway for Claude Code")
  .version(getVersion(), "-v, --version", "Show version")
  .addHelpText("beforeAll", () => {
    theme.asciiArt();
    return "";
  })
  .addHelpText(
    "after",
    `
Skills: npx skills or manually add to ~/.claude/skills/

Environment Variables:
  TELEGRAM_BOT_TOKEN    Telegram bot token (required)
  LOG_LEVEL             Log level (default: info)
`,
  );

// daemon command - starts the gateway (auto-creates ~/.klausbot on startup)
program
  .command("daemon")
  .alias("gateway")
  .description("Start the gateway daemon")
  .action(async () => {
    const { startGateway } = await import("./daemon/index.js");
    await startGateway();
  });

// init command (commented out - daemon auto-creates ~/.klausbot)
// program
//   .command('init')
//   .description('Initialize or reset ~/.klausbot/ directory')
//   .option('-f, --force', 'Skip confirmation prompt')
//   .action(async (options: { force?: boolean }) => {
//     const { existsSync, rmSync } = await import('fs');
//     const { join } = await import('path');
//     const { confirm } = await import('@inquirer/prompts');
//     const { createChildLogger } = await import('./utils/logger.js');
//     const { initializeHome, initializeIdentity, KLAUSBOT_HOME } = await import('./memory/index.js');
//     const alreadyExists = existsSync(KLAUSBOT_HOME);
//     if (!options.force) {
//       if (alreadyExists) {
//         theme.blank();
//         theme.warn(`${KLAUSBOT_HOME} already exists.`);
//         theme.info('This will reset identity and conversations.');
//         theme.info('Config will be preserved.');
//         theme.blank();
//       }
//       const confirmed = await confirm({
//         message: alreadyExists ? 'Continue with reset?' : `Initialize klausbot at ${KLAUSBOT_HOME}?`,
//         default: !alreadyExists,
//       });
//       if (!confirmed) {
//         theme.info('Aborted.');
//         process.exit(0);
//       }
//     }
//     const log = createChildLogger('init');
//     theme.blank();
//     theme.info(`Initializing klausbot data home at ${KLAUSBOT_HOME}...`);
//     const dbPath = join(KLAUSBOT_HOME, 'klausbot.db');
//     const dbWalPath = join(KLAUSBOT_HOME, 'klausbot.db-wal');
//     const dbShmPath = join(KLAUSBOT_HOME, 'klausbot.db-shm');
//     if (existsSync(dbPath)) {
//       rmSync(dbPath, { force: true });
//       if (existsSync(dbWalPath)) rmSync(dbWalPath, { force: true });
//       if (existsSync(dbShmPath)) rmSync(dbShmPath, { force: true });
//       log.info({ path: dbPath }, 'Cleared database');
//     }
//     initializeHome(log);
//     initializeIdentity(log);
//     theme.success('Done!');
//     theme.list([
//       '~/.klausbot/config/ (preserved)',
//       '~/.klausbot/klausbot.db (cleared)',
//       '~/.klausbot/identity/ (reset)',
//     ], { indent: 2 });
//   });

// cron command
program
  .command("cron")
  .description("Manage scheduled jobs")
  .argument("[action]", "Action: list, enable, disable, delete")
  .argument("[id]", "Job ID")
  .action(async (action?: string, id?: string) => {
    silenceLogs();
    const { runCronCLI } = await import("./cli/index.js");
    const args = [action, id].filter(Boolean) as string[];
    await runCronCLI(args);
  });

// mcp command (internal, for Claude CLI integration)
program
  .command("mcp")
  .description("MCP server for Claude CLI (internal)")
  .action(async () => {
    const { runMcpServer } = await import("./mcp-server/index.js");
    await runMcpServer();
  });

// hook command (for Claude Code hooks)
const hook = program
  .command("hook")
  .description("Claude Code session hooks (internal)");

hook
  .command("start")
  .description("SessionStart hook - outputs context to stdout")
  .action(async () => {
    silenceLogs();
    const { handleHookStart } = await import("./cli/hook.js");
    await handleHookStart();
  });

hook
  .command("compact")
  .description("PreCompact hook - saves state before compaction")
  .action(async () => {
    silenceLogs();
    const { handleHookCompact } = await import("./cli/hook.js");
    await handleHookCompact();
  });

hook
  .command("end")
  .description("SessionEnd hook - stores transcript and summary")
  .action(async () => {
    silenceLogs();
    const { handleHookEnd } = await import("./cli/hook.js");
    await handleHookEnd();
  });

// pairing command with subcommands
const pairing = program.command("pairing").description("Manage user pairing");

pairing
  .command("approve <code>")
  .description("Approve pairing request")
  .action(async (code: string) => {
    silenceLogs();
    const { KLAUSBOT_HOME } = await import("./memory/home.js");
    const { initPairingStore } = await import("./pairing/index.js");
    const store = initPairingStore(KLAUSBOT_HOME);

    const result = store.approvePairing(code.toUpperCase());
    if (result) {
      theme.success(
        `Approved: chatId=${result.chatId}, username=${result.username ?? "N/A"}`,
      );
    } else {
      theme.error(`Code "${code}" not found`);
      process.exit(1);
    }
  });

pairing
  .command("reject <code>")
  .description("Reject pairing request")
  .action(async (code: string) => {
    silenceLogs();
    const { KLAUSBOT_HOME } = await import("./memory/home.js");
    const { initPairingStore } = await import("./pairing/index.js");
    const store = initPairingStore(KLAUSBOT_HOME);

    const rejected = store.rejectPairing(code.toUpperCase());
    if (rejected) {
      theme.success(`Rejected: code=${code}`);
    } else {
      theme.error(`Code "${code}" not found`);
      process.exit(1);
    }
  });

pairing
  .command("list")
  .description("List pending and approved users")
  .action(async () => {
    silenceLogs();
    const { KLAUSBOT_HOME } = await import("./memory/home.js");
    const { initPairingStore } = await import("./pairing/index.js");
    const store = initPairingStore(KLAUSBOT_HOME);

    const pending = store.listPending();
    const approved = store.listApproved();

    theme.header("Pending Requests");
    if (pending.length === 0) {
      theme.muted("  (none)");
    } else {
      for (const req of pending) {
        theme.keyValue("Code", req.code, { keyWidth: 6 });
        theme.keyValue("Chat", String(req.chatId), { keyWidth: 6 });
        theme.keyValue("User", req.username ?? "N/A", { keyWidth: 6 });
        theme.keyValue("Age", formatAge(req.requestedAt), { keyWidth: 6 });
        theme.blank();
      }
    }

    theme.blank();
    theme.header("Approved Users");
    if (approved.length === 0) {
      theme.muted("  (none)");
    } else {
      for (const user of approved) {
        theme.keyValue("Chat", String(user.chatId), { keyWidth: 6 });
        theme.keyValue("User", user.username ?? "N/A", { keyWidth: 6 });
        theme.keyValue("Since", formatAge(user.approvedAt), { keyWidth: 6 });
        theme.blank();
      }
    }
  });

pairing
  .command("revoke <chatId>")
  .description("Revoke access for chat ID")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (chatIdStr: string, options: { force?: boolean }) => {
    silenceLogs();
    const { KLAUSBOT_HOME } = await import("./memory/home.js");
    const { initPairingStore } = await import("./pairing/index.js");
    const store = initPairingStore(KLAUSBOT_HOME);

    const chatId = parseInt(chatIdStr, 10);
    if (isNaN(chatId)) {
      theme.error(`Invalid chat ID "${chatIdStr}"`);
      process.exit(1);
    }

    // Add confirmation before revoking (unless --force)
    if (!options.force) {
      const { confirm } = await import("@inquirer/prompts");
      const confirmed = await confirm({
        message: `Revoke access for chat ID ${chatId}?`,
        default: false,
      });
      if (!confirmed) {
        theme.info("Aborted.");
        process.exit(0);
      }
    }

    const revoked = store.revoke(chatId);
    if (revoked) {
      theme.success(`Revoked: chatId=${chatId}`);
    } else {
      theme.error(`Chat ID ${chatId} not found in approved users`);
      process.exit(1);
    }
  });

// config command (commented out - not essential)
// const configCmd = program
//   .command('config')
//   .description('Configuration management');
// configCmd
//   .command('validate')
//   .description('Validate environment and config file')
//   .action(async () => {
//     silenceLogs();
//     const { runConfigValidate } = await import('./cli/config.js');
//     runConfigValidate();
//   });

// Parse and execute
// If no command provided, show help
if (process.argv.length <= 2) {
  program.help();
} else {
  program.parseAsync(process.argv).catch((err) => {
    theme.error(`Fatal error: ${err.message}`);
    // Use setTimeout to allow pino logger to flush before exit
    setTimeout(() => process.exit(1), 100);
  });
}
