import { readdirSync, existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Bot } from "grammy";

/** Telegram bot command shape (for setMyCommands) */
interface BotCommand {
  command: string;
  description: string;
}
import type { MyContext } from "./bot.js";
import { createChildLogger } from "../utils/index.js";

const log = createChildLogger("telegram:skills");

/** Default location for Claude Code skills */
const SKILLS_DIR = join(homedir(), ".claude", "skills");

/** Map of sanitized command names to original skill names */
const skillCommandMap = new Map<string, string>();

/**
 * Sanitize skill name for Telegram command
 * - Hyphens → underscores (Telegram requirement)
 * - Lowercase, max 32 chars
 */
function sanitizeCommandName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

/**
 * Get list of installed skill names from ~/.claude/skills/
 * A valid skill is a directory containing SKILL.md
 */
export function getInstalledSkillNames(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];

  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => existsSync(join(SKILLS_DIR, d.name, "SKILL.md")))
    .map((d) => d.name);
}

/**
 * Get skill description from SKILL.md frontmatter
 * Falls back to skill name if description not found
 */
export function getSkillDescription(name: string): string {
  const skillPath = join(SKILLS_DIR, name, "SKILL.md");
  if (!existsSync(skillPath)) return name;

  try {
    const content = readFileSync(skillPath, "utf-8");
    // Extract description from YAML frontmatter
    const match = content.match(/^---\n[\s\S]*?description:\s*(.+)/m);
    if (match) {
      // Telegram limits command descriptions to 256 chars
      return match[1].trim().slice(0, 250);
    }
  } catch {
    // Ignore read errors, fall back to name
  }

  return name;
}

/**
 * Translate skill command in message text
 * Converts /skill_creator [args] → /skill-creator [args]
 * Returns original text if not a skill command
 */
export function translateSkillCommand(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return text;

  // Extract command and args: /command args
  const match = trimmed.match(/^\/([^\s]+)(?:\s+(.*))?$/);
  if (!match) return text;

  const command = match[1].toLowerCase();
  const args = match[2] || "";

  // Check if this is a registered skill command
  const skillName = skillCommandMap.get(command);
  if (skillName) {
    // Translate to /<original-name> [args] - Claude Code recognizes /skill-name format
    const translated = args ? `/${skillName} ${args}` : `/${skillName}`;
    log.debug({ from: trimmed, to: translated }, "Translated skill command");
    return translated;
  }

  return text;
}

/**
 * Register bot commands with Telegram menu
 * Skills registered with sanitized names, original names stored for reverse lookup
 */
export async function registerSkillCommands(
  bot: Bot<MyContext>,
): Promise<void> {
  log.info(
    { skillsDir: SKILLS_DIR, exists: existsSync(SKILLS_DIR) },
    "Checking skills directory",
  );

  const skillNames = getInstalledSkillNames();
  log.info({ skillNames }, "Found installed skills");

  // Clear and rebuild command map
  skillCommandMap.clear();

  // Built-in commands
  const builtins: BotCommand[] = [
    { command: "start", description: "Start or check pairing" },
    { command: "help", description: "Show available commands" },
    { command: "status", description: "Show queue status" },
  ];

  // Skill commands with sanitized names
  const skillCommands: BotCommand[] = [];
  for (const name of skillNames) {
    const sanitized = sanitizeCommandName(name);
    const description = getSkillDescription(name);
    log.info(
      { original: name, command: sanitized, descLen: description.length },
      "Adding skill command",
    );
    skillCommandMap.set(sanitized, name);
    skillCommands.push({
      command: sanitized,
      description,
    });
  }

  // Telegram limits to 100 commands
  const allCommands = [...builtins, ...skillCommands].slice(0, 100);

  log.info(
    { commands: allCommands.map((c) => c.command) },
    "Registering commands with Telegram",
  );

  try {
    await bot.api.setMyCommands(allCommands);
    log.info(
      {
        builtins: builtins.length,
        skills: skillNames,
        total: allCommands.length,
      },
      "Registered Telegram commands successfully",
    );
  } catch (err) {
    log.error({ err }, "Failed to register Telegram commands");
    throw err;
  }
}
