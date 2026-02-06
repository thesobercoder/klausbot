import { spawn } from "child_process";
import { createInterface } from "readline";
import { Bot } from "grammy";
import { createChildLogger } from "../utils/index.js";
import { KLAUSBOT_HOME, buildSystemPrompt } from "../memory/index.js";
import {
  writeMcpConfigFile,
  getHooksConfig,
  type ToolUseEntry,
} from "../daemon/index.js";

const log = createChildLogger("streaming");

/** Default timeout for streaming (90s — main agent is a fast dispatcher) */
const DEFAULT_TIMEOUT = 90000;

/** Streaming configuration matching jsonConfigSchema */
export interface StreamConfig {
  enabled: boolean;
  throttleMs: number;
}

/** NDJSON event from Claude CLI stream-json output */
interface StreamEvent {
  type: string;
  delta?: { text?: string; type?: string; partial_json?: string };
  content_block?: { type?: string; name?: string };
  /** Present in "assistant" message events — contains tool_use blocks for MCP calls */
  message?: {
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  };
  result?: string; // Present in final "result" event
  cost_usd?: number; // Present in final "result" event (older CLI versions)
  total_cost_usd?: number; // Present in final "result" event (CLI v2.1+)
  session_id?: string; // Present in final "result" event
  is_error?: boolean; // Present in final "result" event
}

/** Options for streaming Claude response */
export interface StreamOptions {
  model?: string;
  additionalInstructions?: string;
  signal?: AbortSignal;
  /** Telegram chat ID — propagated to hooks/MCP for per-chat memory isolation */
  chatId?: number;
}

/** Result from streaming Claude response */
export interface StreamResult {
  result: string;
  cost_usd: number;
  /** Session ID for --resume */
  session_id: string;
  /** Tool uses performed during the session */
  toolUse?: ToolUseEntry[];
}

/**
 * Stream Claude response with callback for each text chunk.
 * Uses callback pattern (not generator) so caller can access return value.
 *
 * @param prompt - User message
 * @param options - Model, additional instructions, abort signal
 * @param onChunk - Called with each text delta as it arrives
 * @returns Promise with final result and cost
 */
export async function streamClaudeResponse(
  prompt: string,
  options: StreamOptions,
  onChunk: (text: string) => void,
): Promise<StreamResult> {
  // Build system prompt from identity files (same as spawner.ts)
  let systemPrompt = buildSystemPrompt();

  // Append additional instructions if provided
  if (options.additionalInstructions) {
    systemPrompt += "\n\n" + options.additionalInstructions;
  }

  // Wrap prompt in XML tags for security (same as spawner.ts)
  // Reminder ensures text output even when tool-use occurs
  const wrappedPrompt = `<user_message>\n${prompt}\n</user_message>\n<reminder>You MUST include a conversational text response. If you performed any actions (file writes, memory updates, etc.), acknowledge them naturally. NEVER return empty.</reminder>`;

  // Write MCP config and hooks settings (same as batch path)
  const mcpConfigPath = writeMcpConfigFile();
  const settingsJson = JSON.stringify(getHooksConfig());

  const args = [
    "--dangerously-skip-permissions",
    "-p",
    wrappedPrompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--append-system-prompt",
    systemPrompt,
    "--mcp-config",
    mcpConfigPath,
    "--settings",
    settingsJson,
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  // Block Task tool — background work uses --resume via daemon
  args.push("--disallowedTools", "Task,TaskOutput");

  return new Promise((resolve, reject) => {
    // Build environment with chat ID
    const env = { ...process.env };
    if (options.chatId !== undefined) {
      env.KLAUSBOT_CHAT_ID = String(options.chatId);
    }

    // CRITICAL: stdin must inherit to avoid hang bug (same as spawner.ts)
    const claude = spawn("claude", args, {
      stdio: ["inherit", "pipe", "pipe"],
      cwd: KLAUSBOT_HOME,
      env,
    });

    let accumulated = "";
    let costUsd = 0;
    let sessionId = "";
    let timedOut = false;

    // Tool-use tracking
    const toolUseEntries: ToolUseEntry[] = [];
    let currentToolName = "";
    let currentToolInput = "";

    // Set up timeout (90s — fast dispatcher limit)
    const timeoutId = setTimeout(() => {
      timedOut = true;
      log.warn(
        { resultLength: accumulated.length },
        "Stream timed out, killing process",
      );
      claude.kill("SIGTERM");
      // Force kill if SIGTERM doesn't work after 5s
      setTimeout(() => {
        if (!claude.killed) {
          claude.kill("SIGKILL");
        }
      }, 5000);
    }, DEFAULT_TIMEOUT);

    // Handle abort signal
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        claude.kill("SIGTERM");
      });
    }

    const rl = createInterface({ input: claude.stdout! });

    rl.on("line", (line) => {
      try {
        const event: StreamEvent = JSON.parse(line);

        // Text delta events - call onChunk callback
        if (event.type === "content_block_delta" && event.delta?.text) {
          accumulated += event.delta.text;
          onChunk(event.delta.text);
        }

        // Tool use start — capture tool name
        if (
          event.type === "content_block_start" &&
          event.content_block?.type === "tool_use"
        ) {
          currentToolName = event.content_block.name ?? "";
          currentToolInput = "";
        }

        // Tool use input delta
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "input_json_delta"
        ) {
          currentToolInput += event.delta.partial_json ?? "";
        }

        // Tool use block end — save entry
        if (event.type === "content_block_stop" && currentToolName) {
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = JSON.parse(currentToolInput);
          } catch {
            parsedInput = { _raw: currentToolInput };
          }
          toolUseEntries.push({ name: currentToolName, input: parsedInput });
          currentToolName = "";
          currentToolInput = "";
        }

        // MCP tool calls arrive as "assistant" message events with tool_use content blocks
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "tool_use" && block.name) {
              toolUseEntries.push({
                name: block.name,
                input: block.input ?? {},
              });
            }
          }
        }

        // Final "result" event contains metadata
        if (event.type === "result") {
          if (event.result !== undefined) {
            accumulated = event.result;
          }
          // CLI v2.1+ uses total_cost_usd, older versions use cost_usd
          if (event.total_cost_usd !== undefined) {
            costUsd = event.total_cost_usd;
          } else if (event.cost_usd !== undefined) {
            costUsd = event.cost_usd;
          }
          if (event.session_id !== undefined) {
            sessionId = event.session_id;
          }
        }
      } catch {
        // Skip non-JSON lines (stderr leakage, etc.)
      }
    });

    rl.on("close", () => {
      clearTimeout(timeoutId);

      const toolUse = toolUseEntries.length > 0 ? toolUseEntries : undefined;

      if (timedOut) {
        const timeoutNotice =
          "\n\n[Response timed out — if a background task was started, you'll still be notified when it completes]";
        const result = accumulated + timeoutNotice;
        log.warn(
          { resultLength: accumulated.length },
          "Stream timed out, returning partial result with notice",
        );
        resolve({ result, cost_usd: 0, session_id: sessionId, toolUse });
      } else {
        log.info(
          {
            resultLength: accumulated.length,
            cost_usd: costUsd,
            session_id: sessionId,
            toolUseCount: toolUseEntries.length,
          },
          "Stream completed",
        );
        resolve({
          result: accumulated,
          cost_usd: costUsd,
          session_id: sessionId,
          toolUse,
        });
      }
    });

    claude.on("error", (err) => {
      clearTimeout(timeoutId);
      log.error({ err }, "Stream spawn error");
      reject(err);
    });

    claude.stderr!.on("data", (data: Buffer) => {
      log.warn({ stderr: data.toString().slice(0, 200) }, "Stream stderr");
    });
  });
}

/**
 * Check if chat supports streaming.
 * Enabled for private chats and supergroups (topic groups).
 */
export async function canStreamToChat(
  bot: Bot<any>,
  chatId: number,
): Promise<boolean> {
  try {
    const chat = await bot.api.getChat(chatId);
    return chat.type === "private" || chat.type === "supergroup";
  } catch {
    return false;
  }
}

/** Draft ID counter for unique draft identification */
let draftIdCounter = 0;

/** Options for streaming to Telegram */
export interface StreamToTelegramOptions {
  model?: string;
  additionalInstructions?: string;
  messageThreadId?: number;
  /** Telegram chat ID — propagated for per-chat memory isolation */
  chatId?: number;
}

/**
 * Stream Claude response to Telegram via draft updates.
 * Shows user real-time response generation in a draft bubble.
 *
 * @param bot - grammY Bot instance
 * @param chatId - Telegram chat ID
 * @param prompt - User message to send to Claude
 * @param config - Streaming configuration (throttleMs)
 * @param options - Optional model, instructions, thread ID
 * @returns Final result text and cost
 */
export async function streamToTelegram(
  bot: Bot<any>,
  chatId: number,
  prompt: string,
  config: StreamConfig,
  options?: StreamToTelegramOptions,
): Promise<StreamResult> {
  const draftId = ++draftIdCounter;
  const controller = new AbortController();

  let accumulated = "";
  let lastUpdateTime = 0;

  // Callback for each text chunk - sends throttled draft updates
  const onChunk = async (text: string): Promise<void> => {
    accumulated += text;

    const now = Date.now();
    if (now - lastUpdateTime >= config.throttleMs) {
      try {
        await bot.api.sendMessageDraft(chatId, draftId, accumulated, {
          message_thread_id: options?.messageThreadId,
        });
        lastUpdateTime = now;
      } catch (err) {
        log.warn({ err, chatId }, "Draft update failed, continuing");
      }
    }
  };

  try {
    // Call streamClaudeResponse with callback
    const result = await streamClaudeResponse(
      prompt,
      {
        model: options?.model,
        additionalInstructions: options?.additionalInstructions,
        signal: controller.signal,
        chatId: options?.chatId,
      },
      onChunk,
    );

    // Send final draft update (ensures latest content shown)
    await bot.api
      .sendMessageDraft(chatId, draftId, result.result, {
        message_thread_id: options?.messageThreadId,
      })
      .catch(() => {});

    return result;
  } catch (err) {
    controller.abort();

    // On error, still try to return accumulated partial result
    if (accumulated.length > 0) {
      log.error({ err, chatId }, "Stream error, returning partial result");
      return { result: accumulated, cost_usd: 0, session_id: "" };
    }

    throw err;
  }
}
