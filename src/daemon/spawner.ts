import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { Logger } from 'pino';
import { createChildLogger } from '../utils/logger.js';
import { KLAUSBOT_HOME, buildSystemPrompt } from '../memory/index.js';
import { handleTimeout } from './transcript.js';

/**
 * Get MCP server configuration for klausbot cron tools
 * Uses same invocation method as current process (works in dev and production)
 *
 * - Dev: `node dist/index.js daemon` → MCP uses `node dist/index.js mcp-server`
 * - Prod: `klausbot daemon` → MCP uses `node /path/to/klausbot mcp-server`
 *
 * @returns MCP config object for --mcp-config flag
 */
function getMcpConfig(): object {
  return {
    mcpServers: {
      klausbot: {
        command: process.argv[0],  // node executable
        args: [process.argv[1], 'mcp'],  // [script path, subcommand]
        env: {}
      }
    }
  };
}

/**
 * Get Claude Code hooks configuration
 * Uses exact path to current process for reliable hook invocation
 *
 * Hook lifecycle:
 * - SessionStart: Injects datetime + recent summaries into context
 * - PreCompact: Saves state before context compaction (future use)
 * - SessionEnd: Stores transcript with summary
 *
 * @returns Settings object with hooks configuration
 */
function getHooksConfig(): object {
  // Build command using same invocation as current process
  // Dev: node dist/index.js → node dist/index.js hook start
  // Prod: node /usr/local/bin/klausbot → node /usr/local/bin/klausbot hook start
  const nodeExecutable = process.argv[0];
  const scriptPath = process.argv[1];
  const baseCommand = `"${nodeExecutable}" "${scriptPath}"`;

  return {
    hooks: {
      SessionStart: [{
        // Match startup and resume events (not clear/compact which are fresh starts)
        matcher: 'startup|resume',
        hooks: [{
          type: 'command',
          command: `${baseCommand} hook start`,
          timeout: 10,  // 10 seconds max
        }],
      }],
      PreCompact: [{
        hooks: [{
          type: 'command',
          command: `${baseCommand} hook compact`,
          timeout: 30,  // 30 seconds for state save
        }],
      }],
      SessionEnd: [{
        hooks: [{
          type: 'command',
          command: `${baseCommand} hook end`,
          timeout: 60,  // 60 seconds for summary generation
        }],
      }],
    },
  };
}

/**
 * Write MCP config to a temp file for Claude CLI
 * Claude CLI requires a file path for --mcp-config flag
 *
 * @returns Path to temporary config file
 */
function writeMcpConfigFile(): string {
  const config = getMcpConfig();
  const configPath = path.join(os.tmpdir(), `klausbot-mcp-${process.pid}.json`);
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/** Claude Code response structure */
export interface ClaudeResponse {
  /** Response text from Claude */
  result: string;
  /** Cost in USD for this query */
  cost_usd: number;
  /** Session ID for this interaction */
  session_id: string;
  /** Duration of the query in milliseconds */
  duration_ms: number;
  /** Whether the response is an error */
  is_error: boolean;
}

/** Options for spawning Claude Code */
export interface SpawnerOptions {
  /** Timeout in milliseconds (default: 300000 = 5 min) */
  timeout?: number;
  /** Model to use (for future /model command) */
  model?: string;
  /** Additional instructions appended to system prompt (for bootstrap mode) */
  additionalInstructions?: string;
}

const DEFAULT_TIMEOUT = 300000; // 5 minutes

const logger: Logger = createChildLogger('spawner');

/**
 * Query Claude Code CLI with a prompt
 *
 * CRITICAL: Uses stdio: ['inherit', 'pipe', 'pipe'] to avoid hang bug
 * See: https://github.com/anthropics/claude-code/issues/771
 *
 * @param prompt - The prompt to send to Claude
 * @param options - Spawn options (timeout, model)
 * @returns Claude's response
 * @throws Error with descriptive message on failure
 */
export async function queryClaudeCode(
  prompt: string,
  options: SpawnerOptions = {}
): Promise<ClaudeResponse> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const startTime = Date.now();

  // Log prompt (truncated for readability)
  const truncatedPrompt = prompt.length > 100
    ? `${prompt.slice(0, 100)}...`
    : prompt;
  logger.info(
    { prompt: truncatedPrompt, timeout, model: options.model, cwd: KLAUSBOT_HOME },
    'Spawning Claude Code'
  );

  return new Promise((resolve, reject) => {
    // Build system prompt from identity files + retrieval instructions
    let systemPrompt = buildSystemPrompt();

    // Append additional instructions if provided (for bootstrap mode)
    if (options.additionalInstructions) {
      systemPrompt += '\n\n' + options.additionalInstructions;
    }

    // Write MCP config to temp file for Claude CLI
    const mcpConfigPath = writeMcpConfigFile();

    // Build hooks settings JSON
    const hooksSettings = getHooksConfig();
    const settingsJson = JSON.stringify(hooksSettings);

    // Wrap user prompt in XML tags for security
    // Prevents shell injection and prompt injection from Telegram input
    const wrappedPrompt = `<user_message>\n${prompt}\n</user_message>`;

    // Build command arguments
    const args = [
      '--dangerously-skip-permissions',
      '-p', wrappedPrompt,
      '--output-format', 'json',
      '--append-system-prompt', systemPrompt,
      '--mcp-config', mcpConfigPath,
      '--settings', settingsJson,
    ];
    if (options.model) {
      args.push('--model', options.model);
    }

    logger.debug({ hooksConfig: hooksSettings }, 'Hook configuration');

    // CRITICAL: stdin must inherit to avoid hang bug (issue #771)
    const claude = spawn('claude', args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: KLAUSBOT_HOME,  // Working directory for agentic file access
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      claude.kill('SIGTERM');

      // Force kill after 5 seconds if SIGTERM doesn't work
      setTimeout(() => {
        if (!claude.killed) {
          claude.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    // Collect stdout
    claude.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Collect stderr
    claude.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process completion
    claude.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration_ms = Date.now() - startTime;

      // Handle timeout
      if (timedOut) {
        // Attempt to recover response from Claude CLI transcript
        const recovered = handleTimeout(KLAUSBOT_HOME);
        if (recovered) {
          logger.info({ duration_ms }, 'Recovered response from timeout');
          resolve({
            result: recovered,
            cost_usd: 0,  // Unknown cost for recovered response
            session_id: 'recovered',
            duration_ms,
            is_error: false,
          });
          return;
        }

        // Original timeout error if recovery fails
        const timeoutSec = Math.round(timeout / 1000);
        const error = `Claude timed out after ${timeoutSec} seconds`;
        logger.error({ timeout, duration_ms }, error);
        reject(new Error(error));
        return;
      }

      // Handle non-zero exit code
      if (code !== 0) {
        const stderrTruncated = stderr.length > 200
          ? `${stderr.slice(0, 200)}...`
          : stderr;
        const error = `Claude exited with code ${code}: ${stderrTruncated}`;
        logger.error({ code, stderr: stderrTruncated, duration_ms }, error);
        reject(new Error(error));
        return;
      }

      // Parse JSON response
      try {
        const parsed = JSON.parse(stdout);

        const response: ClaudeResponse = {
          result: parsed.result ?? '',
          cost_usd: parsed.cost_usd ?? 0,
          session_id: parsed.session_id ?? '',
          duration_ms,
          is_error: parsed.is_error ?? false,
        };

        const truncatedResult = response.result.length > 200
          ? `${response.result.slice(0, 200)}...`
          : response.result;
        logger.info(
          {
            duration_ms,
            cost_usd: response.cost_usd,
            session_id: response.session_id,
            is_error: response.is_error,
            resultLength: response.result.length,
            result: truncatedResult,
          },
          'Claude Code responded'
        );

        resolve(response);
      } catch (parseErr) {
        const stdoutTruncated = stdout.length > 100
          ? `${stdout.slice(0, 100)}...`
          : stdout;
        const error = `Failed to parse Claude response: ${stdoutTruncated}`;
        logger.error({ stdout: stdoutTruncated, duration_ms }, error);
        reject(new Error(error));
      }
    });

    // Handle spawn errors (e.g., claude not found)
    claude.on('error', (err) => {
      clearTimeout(timeoutId);
      const error = `Failed to start Claude: ${err.message}`;
      logger.error({ err }, error);
      reject(new Error(error));
    });
  });
}
