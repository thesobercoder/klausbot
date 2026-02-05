/**
 * Hook CLI handlers for Claude Code integration
 * Receives JSON from stdin, processes session events
 */

import { stdin } from "process";
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/** Log file path */
const HOOK_LOG_PATH = join(homedir(), ".klausbot", "logs", "hook.log");

/**
 * Append a log line to hook.log file
 */
function hookLog(message: string): void {
  try {
    // Ensure logs dir exists
    mkdirSync(join(homedir(), ".klausbot", "logs"), { recursive: true });
    const timestamp = new Date().toISOString();
    appendFileSync(HOOK_LOG_PATH, `${timestamp} ${message}\n`);
  } catch {
    // Silently ignore log failures - don't break the hook
  }
}

/** Claude Code hook input structure */
interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  source?: string;
  reason?: string;
}

/**
 * Read JSON from stdin (non-blocking with timeout)
 */
async function readStdin(timeoutMs = 5000): Promise<HookInput> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("stdin timeout"));
    }, timeoutMs);

    stdin.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stdin.on("end", () => {
      clearTimeout(timeout);
      try {
        const json = Buffer.concat(chunks).toString("utf-8");
        resolve(JSON.parse(json) as HookInput);
      } catch (err) {
        reject(new Error(`Invalid JSON: ${err}`));
      }
    });

    stdin.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Handle SessionStart hook
 * Outputs context to stdout (injected into Claude session)
 */
export async function handleHookStart(): Promise<void> {
  const input = await readStdin();
  hookLog(`[start] session=${input.session_id}`);

  // Dynamic import to avoid loading DB on every CLI call
  const { getRecentConversations } = await import("../memory/conversations.js");

  // Get current datetime
  const datetime = new Date().toISOString();

  // Get recent conversation summaries (last 3)
  let summariesText = "";
  try {
    const recent = getRecentConversations(3);
    if (recent.length > 0) {
      summariesText = recent
        .map((c) => {
          const date = new Date(c.endedAt).toLocaleDateString();
          return `- ${date}: ${c.summary}`;
        })
        .join("\n");
    }
  } catch {
    // Ignore errors - may be first run before tables exist
  }

  // Build context block
  const context = `<session-context>
Current datetime: ${datetime}
Session ID: ${input.session_id}
${summariesText ? `\nRecent conversations:\n${summariesText}` : ""}
</session-context>`;

  // Write to stdout - Claude adds this to context
  console.log(context);
}

/**
 * Handle PreCompact hook
 * Saves conversation state before context window compaction
 */
export async function handleHookCompact(): Promise<void> {
  const input = await readStdin();

  // Pre-compact: could save partial transcript here
  // For now, just acknowledge - full save happens in SessionEnd
  hookLog(`[compact] session=${input.session_id}`);
}

/**
 * Handle SessionEnd hook
 * Copies transcript to storage, generates summary
 */
export async function handleHookEnd(): Promise<void> {
  let sessionId = "unknown";
  try {
    const input = await readStdin();
    sessionId = input.session_id;

    hookLog(`[end] session=${input.session_id} path=${input.transcript_path}`);

    // Read transcript file
    if (!existsSync(input.transcript_path)) {
      hookLog(`[end] ERROR: Transcript not found: ${input.transcript_path}`);
      return;
    }

    const transcriptContent = readFileSync(input.transcript_path, "utf-8");
    hookLog(`[end] Read transcript: ${transcriptContent.length} bytes`);

    // Dynamic imports
    const {
      parseTranscript,
      extractConversationText,
      generateSummary,
      storeConversation,
    } = await import("../memory/conversations.js");

    // Parse transcript
    const entries = parseTranscript(transcriptContent);
    const messageCount = entries.filter(
      (e) => e.type === "user" || e.type === "assistant",
    ).length;
    hookLog(
      `[end] Parsed: ${entries.length} entries, ${messageCount} messages`,
    );

    if (messageCount === 0) {
      hookLog("[end] No messages in transcript, skipping");
      return;
    }

    // Extract timestamps
    const timestamps = entries
      .filter((e) => e.timestamp)
      .map((e) => e.timestamp!)
      .sort();

    const startedAt = timestamps[0] ?? new Date().toISOString();
    const endedAt =
      timestamps[timestamps.length - 1] ?? new Date().toISOString();

    // Generate summary
    hookLog("[end] Generating summary...");
    const conversationText = extractConversationText(entries);
    const summary = await generateSummary(conversationText);
    hookLog(`[end] Summary generated: ${summary.length} chars`);

    // Store conversation
    hookLog("[end] Storing conversation...");
    storeConversation({
      sessionId: input.session_id,
      startedAt,
      endedAt,
      transcript: transcriptContent,
      summary,
      messageCount,
      // chatId: extracted from session metadata if available
    });

    hookLog(
      `[end] Stored conversation: ${messageCount} messages, summary: ${summary.slice(0, 50)}...`,
    );
  } catch (err) {
    hookLog(
      `[end] ERROR session=${sessionId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
