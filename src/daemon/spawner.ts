import { spawn } from 'child_process';
import { Logger } from 'pino';
import { createChildLogger } from '../utils/logger.js';

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
    { prompt: truncatedPrompt, timeout, model: options.model },
    'Spawning Claude Code'
  );

  return new Promise((resolve, reject) => {
    // Build command arguments
    const args = ['--dangerously-skip-permissions', '-p', prompt, '--output-format', 'json'];
    if (options.model) {
      args.push('--model', options.model);
    }

    // CRITICAL: stdin must inherit to avoid hang bug (issue #771)
    const claude = spawn('claude', args, {
      stdio: ['inherit', 'pipe', 'pipe'],
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

        logger.info(
          {
            duration_ms,
            cost_usd: response.cost_usd,
            session_id: response.session_id,
            is_error: response.is_error,
            resultLength: response.result.length
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
