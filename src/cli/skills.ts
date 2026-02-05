/**
 * Skills module
 *
 * Provides skill-creator installation for Claude skill authoring.
 * Skill management delegated to external tools: npx skills
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createChildLogger } from "../utils/logger.js";
import { withRetry } from "../media/retry.js";

const log = createChildLogger("cli:skills");
export const SKILLS_DIR = join(homedir(), ".claude", "skills");

// GitHub API base for anthropics/skills repo
const GITHUB_API =
  "https://api.github.com/repos/anthropics/skills/contents/skills";

/** GitHub API content item shape */
interface GitHubContentItem {
  name: string;
  type: string;
  download_url: string | null;
  path: string;
}

/**
 * Install a subdirectory of a skill recursively
 */
async function installSubdir(
  baseDir: string,
  subpath: string,
  skillName: string,
): Promise<void> {
  const subDir = join(baseDir, subpath);
  mkdirSync(subDir, { recursive: true });

  const res = await withRetry(
    () => fetch(`${GITHUB_API}/${skillName}/${subpath}`),
    { maxRetries: 3, baseDelayMs: 1000 },
  );
  if (!res.ok) return;

  const contents = (await res.json()) as GitHubContentItem[];

  for (const item of contents) {
    if (item.type === "file" && item.download_url) {
      const fileRes = await withRetry(() => fetch(item.download_url!), {
        maxRetries: 3,
        baseDelayMs: 1000,
      });
      if (fileRes.ok) {
        writeFileSync(join(subDir, item.name), await fileRes.text());
      }
    } else if (item.type === "dir") {
      await installSubdir(baseDir, `${subpath}/${item.name}`, skillName);
    }
  }
}

/**
 * Install a skill folder from GitHub (recursive, includes all files)
 */
async function installSkillFolder(name: string): Promise<void> {
  const skillDir = join(SKILLS_DIR, name);
  mkdirSync(skillDir, { recursive: true });

  // Fetch folder contents from GitHub API
  const res = await withRetry(() => fetch(`${GITHUB_API}/${name}`), {
    maxRetries: 3,
    baseDelayMs: 1000,
  });
  if (!res.ok) throw new Error(`Failed to list ${name}: ${res.status}`);

  const contents = (await res.json()) as GitHubContentItem[];

  // Download each file/folder recursively
  for (const item of contents) {
    if (item.type === "file" && item.download_url) {
      const fileRes = await withRetry(() => fetch(item.download_url!), {
        maxRetries: 3,
        baseDelayMs: 1000,
      });
      if (!fileRes.ok) throw new Error(`Failed to fetch ${item.name}`);
      writeFileSync(join(skillDir, item.name), await fileRes.text());
    } else if (item.type === "dir") {
      // Recursively fetch subdirectory
      await installSubdir(
        skillDir,
        item.path.replace(`skills/${name}/`, ""),
        name,
      );
    }
  }

  log.info({ skill: name }, "Skill installed");
}

/**
 * Ensure skill-creator is installed
 * Called during install wizard to set up skill authoring
 */
export async function ensureSkillCreator(): Promise<void> {
  const skillPath = join(SKILLS_DIR, "skill-creator", "SKILL.md");
  if (existsSync(skillPath)) return;

  log.info("Installing skill-creator...");
  await installSkillFolder("skill-creator");
}
