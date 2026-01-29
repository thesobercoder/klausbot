/**
 * klausbot install wizard
 *
 * Interactive installation and configuration for klausbot deployment
 */

import { input, confirm, select } from '@inquirer/prompts';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

/**
 * Check if a command exists
 */
function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate .env file content
 */
function generateEnvContent(token: string, dataDir: string): string {
  return `# klausbot configuration
TELEGRAM_BOT_TOKEN=${token}
DATA_DIR=${dataDir}
LOG_LEVEL=info
NODE_ENV=production
`;
}

/**
 * Generate systemd service file content
 */
function generateServiceFile(installDir: string): string {
  return `[Unit]
Description=Klausbot Telegram Gateway
Documentation=https://github.com/yourrepo/klausbot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=klausbot
Group=klausbot
WorkingDirectory=${installDir}
ExecStart=/usr/bin/node ${installDir}/dist/index.js daemon
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
EnvironmentFile=${installDir}/.env

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${installDir}/data

[Install]
WantedBy=multi-user.target
`;
}

/**
 * Run the installation wizard
 */
export async function runInstallWizard(): Promise<void> {
  console.log(`
=====================================
    Klausbot Installation Wizard
=====================================

This wizard will help you configure klausbot for your environment.
`);

  // Check prerequisites
  console.log('Checking prerequisites...\n');

  const hasClaudeCli = commandExists('claude');
  if (hasClaudeCli) {
    console.log('  [OK] Claude CLI found');
  } else {
    console.log('  [WARN] Claude CLI not found');
    const continueAnyway = await confirm({
      message: 'Claude CLI not detected. Continue anyway?',
      default: false,
    });
    if (!continueAnyway) {
      console.log('\nInstall Claude CLI first: https://claude.ai/code');
      process.exit(1);
    }
  }

  console.log('');

  // Prompt for bot token
  const botToken = await input({
    message: 'Telegram Bot Token:',
    validate: (value) => {
      if (!value.includes(':')) {
        return 'Invalid token format. Get your token from @BotFather on Telegram.';
      }
      return true;
    },
  });

  // Select deployment mode
  const deployMode = await select({
    message: 'Deployment mode:',
    choices: [
      {
        name: 'systemd (recommended for Linux servers)',
        value: 'systemd',
      },
      {
        name: 'docker (containerized deployment)',
        value: 'docker',
      },
      {
        name: 'dev (development, run foreground)',
        value: 'dev',
      },
    ],
  });

  if (deployMode === 'systemd') {
    await handleSystemdInstall(botToken);
  } else if (deployMode === 'docker') {
    await handleDockerInstall(botToken);
  } else {
    await handleDevInstall(botToken);
  }
}

/**
 * Handle systemd deployment mode
 */
async function handleSystemdInstall(botToken: string): Promise<void> {
  // Check systemd availability
  if (!commandExists('systemctl')) {
    console.log('\nsystemd not available on this system.');
    const fallback = await select({
      message: 'Choose alternative:',
      choices: [
        { name: 'Docker', value: 'docker' },
        { name: 'Dev mode', value: 'dev' },
        { name: 'Exit', value: 'exit' },
      ],
    });

    if (fallback === 'docker') {
      return handleDockerInstall(botToken);
    } else if (fallback === 'dev') {
      return handleDevInstall(botToken);
    } else {
      process.exit(0);
    }
  }

  // Prompt for paths
  const installDir = await input({
    message: 'Install directory:',
    default: '/opt/klausbot',
  });

  const dataDir = await input({
    message: 'Data directory:',
    default: `${installDir}/data`,
  });

  // Generate .env file
  const envContent = generateEnvContent(botToken, dataDir);
  const envPath = './.env';

  console.log('\nGenerating configuration...');
  writeFileSync(envPath, envContent);
  console.log(`  Created: ${envPath}`);

  // Generate service file
  const serviceContent = generateServiceFile(installDir);
  const servicePath = './klausbot.service';
  writeFileSync(servicePath, serviceContent);
  console.log(`  Created: ${servicePath}`);

  // Ask to install now
  console.log('');
  const installNow = await confirm({
    message: 'Install and start systemd service now? (requires sudo)',
    default: false,
  });

  if (installNow) {
    try {
      console.log('\nInstalling systemd service...');

      // Create user if needed
      try {
        execSync('id klausbot', { stdio: 'pipe' });
      } catch {
        console.log('  Creating klausbot user...');
        execSync('sudo useradd -r -s /bin/false klausbot', { stdio: 'inherit' });
      }

      // Create directories
      console.log('  Creating directories...');
      execSync(`sudo mkdir -p ${installDir}`, { stdio: 'inherit' });
      execSync(`sudo mkdir -p ${dataDir}`, { stdio: 'inherit' });
      execSync(`sudo chown -R klausbot:klausbot ${installDir}`, { stdio: 'inherit' });

      // Copy service file
      console.log('  Installing service file...');
      execSync(`sudo cp ${servicePath} /etc/systemd/system/klausbot.service`, { stdio: 'inherit' });

      // Reload and enable
      console.log('  Enabling service...');
      execSync('sudo systemctl daemon-reload', { stdio: 'inherit' });
      execSync('sudo systemctl enable klausbot', { stdio: 'inherit' });
      execSync('sudo systemctl start klausbot', { stdio: 'inherit' });

      console.log('\n[SUCCESS] klausbot service installed and started!');
      console.log('\nUseful commands:');
      console.log('  sudo systemctl status klausbot   # Check status');
      console.log('  sudo journalctl -u klausbot -f   # View logs');
      console.log('  sudo systemctl restart klausbot  # Restart');
    } catch (err) {
      console.error('\nInstallation failed. You can install manually:');
      console.log(`  1. Copy files to ${installDir}`);
      console.log(`  2. sudo cp ${servicePath} /etc/systemd/system/`);
      console.log('  3. sudo systemctl daemon-reload');
      console.log('  4. sudo systemctl enable --now klausbot');
    }
  } else {
    console.log('\nManual installation steps:');
    console.log(`  1. Copy project files to ${installDir}`);
    console.log(`  2. Copy .env to ${installDir}/.env`);
    console.log(`  3. sudo cp ${servicePath} /etc/systemd/system/`);
    console.log('  4. sudo useradd -r -s /bin/false klausbot');
    console.log(`  5. sudo mkdir -p ${dataDir}`);
    console.log(`  6. sudo chown -R klausbot:klausbot ${installDir}`);
    console.log('  7. sudo systemctl daemon-reload');
    console.log('  8. sudo systemctl enable --now klausbot');
  }
}

/**
 * Handle Docker deployment mode
 */
async function handleDockerInstall(botToken: string): Promise<void> {
  // Check docker availability
  if (!commandExists('docker')) {
    console.log('\n[ERROR] Docker not found. Please install Docker first.');
    process.exit(1);
  }

  const dataDir = await input({
    message: 'Data directory (host path):',
    default: './data',
  });

  // Generate .env file
  const envContent = generateEnvContent(botToken, '/app/data');
  const envPath = './.env';

  console.log('\nGenerating configuration...');
  writeFileSync(envPath, envContent);
  console.log(`  Created: ${envPath}`);

  // Ensure data dir exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log(`  Created: ${dataDir}/`);
  }

  console.log('\nDocker deployment ready!');
  console.log('\nBuild and run:');
  console.log('  docker build -t klausbot .');
  console.log(`  docker run -d --name klausbot \\`);
  console.log('    --env-file .env \\');
  console.log(`    -v ${dataDir}:/app/data \\`);
  console.log('    klausbot');
  console.log('\nManagement:');
  console.log('  docker logs -f klausbot   # View logs');
  console.log('  docker restart klausbot   # Restart');
  console.log('  docker stop klausbot      # Stop');
}

/**
 * Handle dev deployment mode
 */
async function handleDevInstall(botToken: string): Promise<void> {
  const dataDir = await input({
    message: 'Data directory:',
    default: './data',
  });

  // Generate .env file
  const envContent = generateEnvContent(botToken, dataDir);
  const envPath = './.env';

  console.log('\nGenerating configuration...');
  writeFileSync(envPath, envContent);
  console.log(`  Created: ${envPath}`);

  // Ensure data dir exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log(`  Created: ${dataDir}/`);
  }

  console.log('\nDevelopment mode ready!');
  console.log('\nRun klausbot:');
  console.log('  npm run dev');
  console.log('\nOr for production build:');
  console.log('  npm run build');
  console.log('  npm start');
}
