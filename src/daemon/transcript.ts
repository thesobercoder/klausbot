import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import os from "os";
import path from "path";

/**
 * Structure of a transcript entry in Claude CLI JSONL files
 */
interface TranscriptEntry {
  type: "user" | "assistant" | "summary" | "system";
  message?: {
    content?: Array<{ type: string; text: string }>;
  };
  timestamp?: string;
}

/**
 * Convert working directory to Claude CLI transcript directory path
 *
 * Claude CLI stores transcripts at ~/.claude/projects/{sanitized-cwd}/
 * Path sanitization: /home/user/project -> -home-user-project
 *
 * @param cwd - Working directory path
 * @returns Path to transcript directory
 */
export function getTranscriptDir(cwd: string): string {
  // Strip leading slash and replace all / with -
  const sanitized = cwd.replace(/^\//, "").replace(/\//g, "-");
  return path.join(os.homedir(), ".claude", "projects", `-${sanitized}`);
}

/**
 * Find the most recent transcript file in a project directory
 *
 * @param projectDir - Path to Claude CLI project directory
 * @returns Path to most recent chat_*.jsonl file, or null if none found
 */
export function findLatestTranscript(projectDir: string): string | null {
  if (!existsSync(projectDir)) {
    return null;
  }

  // List all chat_*.jsonl files
  const files = readdirSync(projectDir).filter(
    (f) => f.startsWith("chat_") && f.endsWith(".jsonl"),
  );

  if (files.length === 0) {
    return null;
  }

  // Sort by modification time descending
  const sorted = files
    .map((f) => ({
      name: f,
      path: path.join(projectDir, f),
      mtime: statSync(path.join(projectDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return sorted[0].path;
}

/**
 * Extract the last assistant response from a transcript file
 *
 * @param transcriptPath - Path to JSONL transcript file
 * @returns Last assistant response text, or null if none found
 */
export function extractLastAssistantResponse(
  transcriptPath: string,
): string | null {
  if (!existsSync(transcriptPath)) {
    return null;
  }

  const content = readFileSync(transcriptPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  let lastAssistantText: string | null = null;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as TranscriptEntry;

      if (entry.type === "assistant" && entry.message?.content) {
        // Find text content in the message
        const textContent = entry.message.content.find(
          (c) => c.type === "text",
        );
        if (textContent?.text) {
          lastAssistantText = textContent.text;
        }
      }
    } catch {
      // Skip malformed JSON lines
      continue;
    }
  }

  return lastAssistantText;
}

/**
 * Attempt to recover Claude's response after a timeout
 *
 * Chains transcript discovery: getTranscriptDir -> findLatestTranscript -> extractLastAssistantResponse
 *
 * @param cwd - Working directory where Claude was invoked
 * @returns Recovered response with prefix, or null if recovery failed
 */
export function handleTimeout(cwd: string): string | null {
  const transcriptDir = getTranscriptDir(cwd);
  const transcriptPath = findLatestTranscript(transcriptDir);

  if (!transcriptPath) {
    return null;
  }

  const response = extractLastAssistantResponse(transcriptPath);

  if (!response) {
    return null;
  }

  return `[Recovered from timeout]\n\n${response}`;
}
