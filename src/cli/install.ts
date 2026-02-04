/**
 * klausbot setup wizard
 *
 * Single unified setup that handles everything:
 * - Prompts for credentials (if not present)
 * - Creates directories
 * - Writes config
 * - Installs user service
 * - Shows summary
 */

import { input } from '@inquirer/prompts';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { theme } from './theme.js';
import { detectPlatform } from '../platform/detect.js';
import { which } from '../utils/which.js';

/** klausbot home directory */
const KLAUSBOT_HOME = join(homedir(), '.klausbot');
const ENV_PATH = join(KLAUSBOT_HOME, '.env');
const LOGS_DIR = join(KLAUSBOT_HOME, 'logs');

/** Service paths */
const SYSTEMD_DIR = join(homedir(), '.config', 'systemd', 'user');
const SYSTEMD_SERVICE = join(SYSTEMD_DIR, 'klausbot.service');
const LAUNCHD_DIR = join(homedir(), 'Library', 'LaunchAgents');
const LAUNCHD_PLIST = join(LAUNCHD_DIR, 'com.klausbot.plist');

/** Track what we did */
interface SetupActions {
  createdDirs: string[];
  wroteEnv: boolean;
  envVars: string[];
  installedService: string | null;
  startedService: boolean;
}

/**
 * Parse existing .env file
 */
function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};

  const content = readFileSync(path, 'utf-8');
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      env[key] = rest.join('=');
    }
  }

  return env;
}

/**
 * Get the path to the actual JS entry point
 * Resolves symlinks to find the real dist/index.js
 */
function getExecPath(): string {
  try {
    // Resolve symlinks (e.g., /usr/local/bin/klausbot -> /path/to/dist/index.js)
    return realpathSync(process.argv[1]);
  } catch {
    return process.argv[1];
  }
}


/**
 * Generate systemd user service
 */
function generateSystemdService(): string {
  const nodePath = process.execPath;
  const scriptPath = getExecPath();
  const claudePath = which('claude');
  // Include directory containing claude in PATH
  const claudeDir = claudePath ? dirname(claudePath) : '';
  const pathLine = claudeDir ? `Environment="PATH=${claudeDir}"\n` : '';
  return `[Unit]
Description=Klausbot
After=network.target

[Service]
Type=simple
${pathLine}ExecStart=${nodePath} ${scriptPath} daemon
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
`;
}

/**
 * Generate macOS launchd plist
 */
function generateLaunchdPlist(): string {
  const nodePath = process.execPath;
  const scriptPath = getExecPath();
  const claudePath = which('claude');
  const claudeDir = claudePath ? dirname(claudePath) : '';
  const envBlock = claudeDir ? `
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${claudeDir}</string>
    </dict>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.klausbot</string>${envBlock}
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${scriptPath}</string>
        <string>daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${join(LOGS_DIR, 'stdout.log')}</string>
    <key>StandardErrorPath</key>
    <string>${join(LOGS_DIR, 'stderr.log')}</string>
</dict>
</plist>
`;
}

/**
 * Run the unified setup wizard
 */
export async function runSetupWizard(): Promise<void> {
  const actions: SetupActions = {
    createdDirs: [],
    wroteEnv: false,
    envVars: [],
    installedService: null,
    startedService: false,
  };

  theme.asciiArt();
  theme.blank();
  theme.header('Setup');
  theme.blank();

  // Load existing config (from file and environment)
  const fileEnv = parseEnvFile(ENV_PATH);
  const existingEnv = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || fileEnv.TELEGRAM_BOT_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || fileEnv.OPENAI_API_KEY,
  };
  const newEnv: Record<string, string> = { ...fileEnv };

  // 1. Telegram Bot Token
  if (existingEnv.TELEGRAM_BOT_TOKEN) {
    theme.success('Telegram Bot Token: already configured');
    newEnv.TELEGRAM_BOT_TOKEN = existingEnv.TELEGRAM_BOT_TOKEN;
  } else {
    theme.info('Get your bot token from @BotFather on Telegram');
    theme.blank();

    const token = await input({
      message: 'Telegram Bot Token:',
      validate: (value) => {
        if (!value.includes(':')) {
          return 'Invalid format (should contain ":")';
        }
        return true;
      },
    });

    newEnv.TELEGRAM_BOT_TOKEN = token;
    actions.envVars.push('TELEGRAM_BOT_TOKEN');
  }

  // 2. OpenAI API Key (optional)
  theme.blank();
  if (existingEnv.OPENAI_API_KEY) {
    theme.success('OpenAI API Key: already configured');
    newEnv.OPENAI_API_KEY = existingEnv.OPENAI_API_KEY;
  } else {
    const apiKey = await input({
      message: 'OpenAI API Key (optional, enter to skip):',
      validate: (value) => {
        if (value && !value.startsWith('sk-')) {
          return 'Invalid format (should start with "sk-")';
        }
        return true;
      },
    });

    if (apiKey) {
      newEnv.OPENAI_API_KEY = apiKey;
      actions.envVars.push('OPENAI_API_KEY');
    }
  }

  // 3. Create directories (only if needed)
  const dirs = [KLAUSBOT_HOME, LOGS_DIR, join(KLAUSBOT_HOME, 'identity')];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      actions.createdDirs.push(dir);
    }
  }

  // 4. Write .env file (only if we have new values)
  if (actions.envVars.length > 0) {
    const envContent = Object.entries(newEnv)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n';
    writeFileSync(ENV_PATH, envContent, { mode: 0o600 });
    actions.wroteEnv = true;
  }

  // 5. Install/start service
  const platform = detectPlatform();

  if (platform.platform === 'linux' || platform.isWSL) {
    // Always regenerate service file (paths may change)
    if (!existsSync(SYSTEMD_DIR)) {
      mkdirSync(SYSTEMD_DIR, { recursive: true });
      actions.createdDirs.push(SYSTEMD_DIR);
    }
    writeFileSync(SYSTEMD_SERVICE, generateSystemdService());
    actions.installedService = SYSTEMD_SERVICE;

    try {
      execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
      execSync('systemctl --user enable klausbot', { stdio: 'pipe' });
      // Restart if already running, start if not
      try {
        execSync('systemctl --user restart klausbot', { stdio: 'pipe' });
      } catch {
        execSync('systemctl --user start klausbot', { stdio: 'pipe' });
      }
      actions.startedService = true;
    } catch {
      // Will show manual instructions
    }
  } else if (platform.platform === 'macos') {
    // Always regenerate plist (paths may change)
    if (!existsSync(LAUNCHD_DIR)) {
      mkdirSync(LAUNCHD_DIR, { recursive: true });
      actions.createdDirs.push(LAUNCHD_DIR);
    }
    writeFileSync(LAUNCHD_PLIST, generateLaunchdPlist());
    actions.installedService = LAUNCHD_PLIST;

    try {
      // Unload first in case it's running
      try { execSync(`launchctl unload ${LAUNCHD_PLIST}`, { stdio: 'pipe' }); } catch {}
      execSync(`launchctl load ${LAUNCHD_PLIST}`, { stdio: 'pipe' });
      actions.startedService = true;
    } catch {
      // Will show manual instructions
    }
  }

  // 6. Show summary
  theme.blank();
  theme.header('Summary');
  theme.blank();

  const didSomething = actions.createdDirs.length > 0 || actions.wroteEnv || actions.installedService;

  if (actions.createdDirs.length > 0) {
    theme.info('Created:');
    theme.list(actions.createdDirs);
    theme.blank();
  }

  if (actions.wroteEnv) {
    theme.info('Configured:');
    theme.list([ENV_PATH, ...actions.envVars.map(v => `  ${v}`)]);
    theme.blank();
  }

  if (actions.installedService) {
    theme.info('Installed:');
    theme.list([actions.installedService]);
    theme.blank();
  }

  if (actions.startedService) {
    theme.success('klausbot is running!');
  } else if (platform.platform === 'linux' || platform.isWSL || platform.platform === 'macos') {
    theme.warn('Could not start service automatically');
    theme.info('Run: klausbot restart');
  } else {
    theme.info('Run: klausbot daemon');
  }

  if (!didSomething && actions.startedService) {
    theme.blank();
    theme.info('Everything was already configured, service restarted.');
  }

  theme.blank();
  theme.info('klausbot status   - check status');
  theme.info('klausbot restart  - restart service');
}

/**
 * Show klausbot status
 */
export async function runStatus(): Promise<void> {
  theme.header('Status');
  theme.blank();

  const platform = detectPlatform();

  // 1. Config status
  const fileEnv = parseEnvFile(ENV_PATH);
  const hasToken = Boolean(process.env.TELEGRAM_BOT_TOKEN || fileEnv.TELEGRAM_BOT_TOKEN);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY || fileEnv.OPENAI_API_KEY);

  if (hasToken) {
    theme.success('Telegram Bot Token: configured');
  } else {
    theme.error('Telegram Bot Token: missing');
  }

  if (hasOpenAI) {
    theme.success('OpenAI API Key: configured');
  } else {
    theme.info('OpenAI API Key: not configured (optional)');
  }

  // 2. Claude CLI
  theme.blank();
  const claudePath = which('claude');
  if (claudePath) {
    theme.success(`Claude CLI: ${claudePath}`);
  } else {
    theme.error('Claude CLI: not found in PATH');
  }

  // 3. Service status
  theme.blank();
  if (platform.platform === 'linux' || platform.isWSL) {
    if (!existsSync(SYSTEMD_SERVICE)) {
      theme.info('Service: not installed');
      theme.info('Run: klausbot setup');
    } else {
      try {
        const output = execSync('systemctl --user is-active klausbot', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (output === 'active') {
          theme.success('Service: running');
        } else {
          theme.warn(`Service: ${output}`);
        }
      } catch {
        theme.warn('Service: not running');
      }
    }
  } else if (platform.platform === 'macos') {
    if (!existsSync(LAUNCHD_PLIST)) {
      theme.info('Service: not installed');
      theme.info('Run: klausbot setup');
    } else {
      try {
        const output = execSync('launchctl list | grep com.klausbot', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (output) {
          theme.success('Service: running');
        } else {
          theme.warn('Service: not running');
        }
      } catch {
        theme.warn('Service: not running');
      }
    }
  } else {
    theme.info('Service: not supported on this platform');
  }
}

/**
 * Restart klausbot service
 */
export async function runRestart(): Promise<void> {
  const platform = detectPlatform();

  if (platform.platform === 'linux' || platform.isWSL) {
    if (!existsSync(SYSTEMD_SERVICE)) {
      theme.error('Service not installed. Run: klausbot setup');
      return;
    }
    try {
      execSync('systemctl --user restart klausbot', { stdio: 'pipe' });
      theme.success('Service restarted');
    } catch {
      theme.error('Failed to restart service');
    }
  } else if (platform.platform === 'macos') {
    if (!existsSync(LAUNCHD_PLIST)) {
      theme.error('Service not installed. Run: klausbot setup');
      return;
    }
    try {
      execSync(`launchctl unload ${LAUNCHD_PLIST}`, { stdio: 'pipe' });
      execSync(`launchctl load ${LAUNCHD_PLIST}`, { stdio: 'pipe' });
      theme.success('Service restarted');
    } catch {
      theme.error('Failed to restart service');
    }
  } else {
    theme.error('Service not supported on this platform');
  }
}

/**
 * Uninstall klausbot service
 */
export async function runUninstall(): Promise<void> {
  theme.header('Uninstall');
  theme.blank();

  const platform = detectPlatform();
  let removed = false;

  if (platform.platform === 'linux' || platform.isWSL) {
    if (existsSync(SYSTEMD_SERVICE)) {
      try {
        execSync('systemctl --user stop klausbot', { stdio: 'pipe' });
        theme.info('Stopped service');
      } catch { /* not running */ }

      try {
        execSync('systemctl --user disable klausbot', { stdio: 'pipe' });
        theme.info('Disabled service');
      } catch { /* not enabled */ }

      const { unlinkSync } = await import('fs');
      unlinkSync(SYSTEMD_SERVICE);
      theme.info(`Removed: ${SYSTEMD_SERVICE}`);

      execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
      removed = true;
    } else {
      theme.info('Service not installed');
    }
  } else if (platform.platform === 'macos') {
    if (existsSync(LAUNCHD_PLIST)) {
      try {
        execSync(`launchctl unload ${LAUNCHD_PLIST}`, { stdio: 'pipe' });
        theme.info('Unloaded service');
      } catch { /* not loaded */ }

      const { unlinkSync } = await import('fs');
      unlinkSync(LAUNCHD_PLIST);
      theme.info(`Removed: ${LAUNCHD_PLIST}`);
      removed = true;
    } else {
      theme.info('Service not installed');
    }
  } else {
    theme.info('No service to uninstall on this platform');
  }

  if (removed) {
    theme.blank();
    theme.success('Service uninstalled');
    theme.blank();
    theme.info(`Config preserved: ${ENV_PATH}`);
    theme.info(`Data preserved: ${KLAUSBOT_HOME}`);
  }
}
