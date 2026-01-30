#!/usr/bin/env node
/**
 * klausbot - Telegram gateway for Claude Code
 *
 * Entry point and CLI dispatcher
 *
 * Note: Uses dynamic imports to avoid loading config/bot for help command
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file FIRST before any config access
dotenv.config();

// Parse CLI arguments
const args = process.argv.slice(2);
const command = args[0] ?? 'daemon';

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
 * Print CLI usage help
 */
function printHelp(): void {
  console.log(`
klausbot - Telegram gateway for Claude Code

Usage:
  klausbot [daemon]                   Start the gateway daemon (default)
  klausbot gateway                    Start the gateway daemon (alias)
  klausbot init                       Initialize ~/.klausbot/ directory
  klausbot install                    Interactive installation wizard
  klausbot pairing approve <code>     Approve pairing request
  klausbot pairing reject <code>      Reject pairing request
  klausbot pairing list               List pending/approved
  klausbot pairing revoke <chatId>    Revoke access
  klausbot version                    Show version
  klausbot help                       Show this help

Skills: npx skills or manually add to ~/.claude/skills/

Environment Variables:
  TELEGRAM_BOT_TOKEN    Telegram bot token (required)
  DATA_DIR              Data directory (default: ./data)
  LOG_LEVEL             Log level (default: info)
`.trim());
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

/**
 * Handle pairing subcommands
 */
async function handlePairing(): Promise<void> {
  const action = args[1];
  const arg = args[2];

  // Dynamic imports to load config only when needed
  const { config } = await import('./config/index.js');
  const { initPairingStore } = await import('./pairing/index.js');

  // Initialize store without starting bot
  const store = initPairingStore(config.DATA_DIR);

  switch (action) {
    case 'approve': {
      if (!arg) {
        console.error('Error: Missing pairing code');
        console.log('Usage: klausbot pairing approve <code>');
        process.exit(1);
      }
      const result = store.approvePairing(arg.toUpperCase());
      if (result) {
        console.log(`Approved: chatId=${result.chatId}, username=${result.username ?? 'N/A'}`);
      } else {
        console.error(`Error: Code "${arg}" not found`);
        process.exit(1);
      }
      break;
    }

    case 'reject': {
      if (!arg) {
        console.error('Error: Missing pairing code');
        console.log('Usage: klausbot pairing reject <code>');
        process.exit(1);
      }
      const rejected = store.rejectPairing(arg.toUpperCase());
      if (rejected) {
        console.log(`Rejected: code=${arg}`);
      } else {
        console.error(`Error: Code "${arg}" not found`);
        process.exit(1);
      }
      break;
    }

    case 'list': {
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
      break;
    }

    case 'revoke': {
      if (!arg) {
        console.error('Error: Missing chat ID');
        console.log('Usage: klausbot pairing revoke <chatId>');
        process.exit(1);
      }
      const chatId = parseInt(arg, 10);
      if (isNaN(chatId)) {
        console.error(`Error: Invalid chat ID "${arg}"`);
        process.exit(1);
      }
      const revoked = store.revoke(chatId);
      if (revoked) {
        console.log(`Revoked: chatId=${chatId}`);
      } else {
        console.error(`Error: Chat ID ${chatId} not found in approved users`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Error: Unknown pairing action "${action}"`);
      console.log('Valid actions: approve, reject, list, revoke');
      process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  switch (command) {
    case 'daemon':
    case 'gateway':  // Explicit alias per CONTEXT.md
    case undefined:
    case '': {
      // Dynamic import to avoid loading bot when running CLI commands
      const { startGateway } = await import('./daemon/index.js');
      await startGateway();
      break;
    }

    case 'init': {
      // Initialize ~/.klausbot/ without starting gateway
      const { createChildLogger } = await import('./utils/logger.js');
      const { initializeHome, initializeIdentity, KLAUSBOT_HOME } = await import('./memory/index.js');

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
      break;
    }

    case 'install': {
      const { runInstallWizard } = await import('./cli/index.js');
      await runInstallWizard();
      break;
    }

    case 'cron': {
      const { runCronCLI } = await import('./cli/index.js');
      await runCronCLI(args.slice(1));
      break;
    }

    case 'mcp': {
      // MCP server for Claude CLI integration (stdio transport)
      // Invoked via --mcp-config flag, not meant for direct use
      const { runMcpServer } = await import('./mcp-server/index.js');
      await runMcpServer();
      break;
    }

    case 'pairing':
      await handlePairing();
      break;

    case 'version':
    case '--version':
    case '-v':
      console.log(`klausbot v${getVersion()}`);
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.error(`Error: Unknown command "${command}"`);
      printHelp();
      process.exit(1);
  }
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
