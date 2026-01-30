#!/usr/bin/env node
/**
 * klausbot - Telegram gateway for Claude Code
 *
 * Entry point and CLI dispatcher using Commander.js
 *
 * Note: Uses dynamic imports to avoid loading config/bot for help command
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file FIRST before any config access
dotenv.config();

/**
 * Get package version from package.json
 */
function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Navigate up from dist/index.js to project root
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
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

program
  .name('klausbot')
  .description('Telegram gateway for Claude Code')
  .version(getVersion(), '-v, --version', 'Show version')
  .addHelpText('after', `
Skills: npx skills or manually add to ~/.claude/skills/

Environment Variables:
  TELEGRAM_BOT_TOKEN    Telegram bot token (required)
  DATA_DIR              Data directory (default: ./data)
  LOG_LEVEL             Log level (default: info)
`);

// daemon command (also default when called explicitly)
program
  .command('daemon')
  .alias('gateway')
  .description('Start the gateway daemon')
  .action(async () => {
    const { startGateway } = await import('./daemon/index.js');
    await startGateway();
  });

// init command
program
  .command('init')
  .description('Initialize or reset ~/.klausbot/ directory')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (options: { force?: boolean }) => {
    const { existsSync } = await import('fs');
    const { createChildLogger } = await import('./utils/logger.js');
    const { initializeHome, initializeIdentity, KLAUSBOT_HOME } = await import('./memory/index.js');

    // Check if already exists
    if (existsSync(KLAUSBOT_HOME) && !options.force) {
      const { confirm } = await import('@inquirer/prompts');
      console.log(`\n⚠️  ${KLAUSBOT_HOME} already exists.`);
      console.log('This will reset identity files (SOUL.md, IDENTITY.md, USER.md).');
      console.log('Conversations and config will be preserved.\n');

      const confirmed = await confirm({
        message: 'Continue with reset?',
        default: false,
      });

      if (!confirmed) {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    const log = createChildLogger('init');
    console.log(`Initializing klausbot data home at ${KLAUSBOT_HOME}...`);

    initializeHome(log);
    initializeIdentity(log);

    console.log('Done! Created:');
    console.log('  ~/.klausbot/config/');
    console.log('  ~/.klausbot/conversations/');
    console.log('  ~/.klausbot/identity/SOUL.md');
    console.log('  ~/.klausbot/identity/IDENTITY.md');
    console.log('  ~/.klausbot/identity/USER.md');
  });

// install command
program
  .command('install')
  .description('Interactive installation wizard')
  .action(async () => {
    const { runInstallWizard } = await import('./cli/index.js');
    await runInstallWizard();
  });

// cron command
program
  .command('cron')
  .description('Manage scheduled jobs')
  .argument('[action]', 'Action: list, enable, disable, delete')
  .argument('[id]', 'Job ID')
  .action(async (action?: string, id?: string) => {
    const { runCronCLI } = await import('./cli/index.js');
    const args = [action, id].filter(Boolean) as string[];
    await runCronCLI(args);
  });

// mcp command (internal, for Claude CLI integration)
program
  .command('mcp')
  .description('MCP server for Claude CLI (internal)')
  .action(async () => {
    const { runMcpServer } = await import('./mcp-server/index.js');
    await runMcpServer();
  });

// pairing command with subcommands
const pairing = program
  .command('pairing')
  .description('Manage user pairing');

pairing
  .command('approve <code>')
  .description('Approve pairing request')
  .action(async (code: string) => {
    const { config } = await import('./config/index.js');
    const { initPairingStore } = await import('./pairing/index.js');
    const store = initPairingStore(config.DATA_DIR);

    const result = store.approvePairing(code.toUpperCase());
    if (result) {
      console.log(`Approved: chatId=${result.chatId}, username=${result.username ?? 'N/A'}`);
    } else {
      console.error(`Error: Code "${code}" not found`);
      process.exit(1);
    }
  });

pairing
  .command('reject <code>')
  .description('Reject pairing request')
  .action(async (code: string) => {
    const { config } = await import('./config/index.js');
    const { initPairingStore } = await import('./pairing/index.js');
    const store = initPairingStore(config.DATA_DIR);

    const rejected = store.rejectPairing(code.toUpperCase());
    if (rejected) {
      console.log(`Rejected: code=${code}`);
    } else {
      console.error(`Error: Code "${code}" not found`);
      process.exit(1);
    }
  });

pairing
  .command('list')
  .description('List pending and approved users')
  .action(async () => {
    const { config } = await import('./config/index.js');
    const { initPairingStore } = await import('./pairing/index.js');
    const store = initPairingStore(config.DATA_DIR);

    const pending = store.listPending();
    const approved = store.listApproved();

    console.log('=== Pending Requests ===');
    if (pending.length === 0) {
      console.log('  (none)');
    } else {
      for (const req of pending) {
        console.log(`  Code: ${req.code}  Chat: ${req.chatId}  User: ${req.username ?? 'N/A'}  Age: ${formatAge(req.requestedAt)}`);
      }
    }

    console.log('\n=== Approved Users ===');
    if (approved.length === 0) {
      console.log('  (none)');
    } else {
      for (const user of approved) {
        console.log(`  Chat: ${user.chatId}  User: ${user.username ?? 'N/A'}  Since: ${formatAge(user.approvedAt)}`);
      }
    }
  });

pairing
  .command('revoke <chatId>')
  .description('Revoke access for chat ID')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (chatIdStr: string, options: { force?: boolean }) => {
    const { config } = await import('./config/index.js');
    const { initPairingStore } = await import('./pairing/index.js');
    const store = initPairingStore(config.DATA_DIR);

    const chatId = parseInt(chatIdStr, 10);
    if (isNaN(chatId)) {
      console.error(`Error: Invalid chat ID "${chatIdStr}"`);
      process.exit(1);
    }

    // Add confirmation before revoking (unless --force)
    if (!options.force) {
      const { confirm } = await import('@inquirer/prompts');
      const confirmed = await confirm({
        message: `Revoke access for chat ID ${chatId}?`,
        default: false,
      });
      if (!confirmed) {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    const revoked = store.revoke(chatId);
    if (revoked) {
      console.log(`Revoked: chatId=${chatId}`);
    } else {
      console.error(`Error: Chat ID ${chatId} not found in approved users`);
      process.exit(1);
    }
  });

// Parse and execute
// If no command provided, show help
if (process.argv.length <= 2) {
  program.help();
} else {
  program.parseAsync(process.argv).catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}
