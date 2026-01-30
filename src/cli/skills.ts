/**
 * Skills CLI module
 *
 * Provides commands for installing and managing Claude skills.
 * Auto-installs skill-creator on gateway startup.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { select, search, confirm } from '@inquirer/prompts';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('cli:skills');
const SKILLS_DIR = join(homedir(), '.claude', 'skills');

// GitHub API base for anthropics/skills repo
const GITHUB_API = 'https://api.github.com/repos/anthropics/skills/contents/skills';

/** Skill metadata in the registry */
interface RegistrySkill {
  name: string;
  description: string;
  commands: string[]; // Slash commands it provides
  contentHash: string; // Hash of SKILL.md for version detection
}

/** Registry of available skills (hardcoded per CONTEXT.md decision) */
const REGISTRY: RegistrySkill[] = [
  {
    name: 'skill-creator',
    description: 'Create new skills interactively (Anthropic official)',
    commands: ['/skill-creator'],
    contentHash: '', // Empty = no version check (always considered up-to-date)
  },
];

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
  skillName: string
): Promise<void> {
  const subDir = join(baseDir, subpath);
  mkdirSync(subDir, { recursive: true });

  const res = await fetch(`${GITHUB_API}/${skillName}/${subpath}`);
  if (!res.ok) return;

  const contents = (await res.json()) as GitHubContentItem[];

  for (const item of contents) {
    if (item.type === 'file' && item.download_url) {
      const fileRes = await fetch(item.download_url);
      if (fileRes.ok) {
        writeFileSync(join(subDir, item.name), await fileRes.text());
      }
    } else if (item.type === 'dir') {
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
  const res = await fetch(`${GITHUB_API}/${name}`);
  if (!res.ok) throw new Error(`Failed to list ${name}: ${res.status}`);

  const contents = (await res.json()) as GitHubContentItem[];

  // Download each file/folder recursively
  for (const item of contents) {
    if (item.type === 'file' && item.download_url) {
      const fileRes = await fetch(item.download_url);
      if (!fileRes.ok) throw new Error(`Failed to fetch ${item.name}`);
      writeFileSync(join(skillDir, item.name), await fileRes.text());
    } else if (item.type === 'dir') {
      // Recursively fetch subdirectory
      await installSubdir(skillDir, item.path.replace(`skills/${name}/`, ''), name);
    }
  }

  log.info({ skill: name }, 'Skill installed');
}

/**
 * Ensure skill-creator is installed
 * Called on gateway startup to auto-install mandatory skill
 */
export async function ensureSkillCreator(): Promise<void> {
  const skillPath = join(SKILLS_DIR, 'skill-creator', 'SKILL.md');
  if (existsSync(skillPath)) return;

  log.info('Installing skill-creator...');
  await installSkillFolder('skill-creator');
}

/**
 * Get list of installed skills
 * A skill is installed if its folder contains SKILL.md
 */
function getInstalledSkills(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(SKILLS_DIR, d.name, 'SKILL.md')))
    .map((d) => d.name);
}

/**
 * Get content hash of installed skill's SKILL.md
 * Returns null if skill not installed
 */
function getInstalledHash(skillName: string): string | null {
  const path = join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf-8');
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

/**
 * Check if an installed skill has an update available
 * Returns false if not installed or registry has no hash set
 */
function checkForUpdate(skillName: string): boolean {
  const installed = getInstalledHash(skillName);
  const registry = REGISTRY.find((s) => s.name === skillName);
  if (!installed || !registry || !registry.contentHash) return false;
  return installed !== registry.contentHash;
}

/**
 * Format skill choice for display in search list
 * Adds checkmark for installed, up-arrow for updates
 */
function formatChoice(skill: RegistrySkill, installed: string[]): string {
  const isInstalled = installed.includes(skill.name);
  const hasUpdate = isInstalled && checkForUpdate(skill.name);

  let badge = '';
  if (isInstalled && hasUpdate) badge = ' [update]';
  else if (isInstalled) badge = ' [installed]';

  return `${skill.name} - ${skill.description}${badge}`;
}

/**
 * Browse skills interactively with type-to-filter
 * Uses @inquirer/search for real-time filtering
 */
export async function browseSkills(): Promise<void> {
  const installed = getInstalledSkills();

  const selected = await search({
    message: 'Browse skills (type to filter):',
    source: (term) => {
      const filtered = REGISTRY.filter(
        (s) =>
          !term ||
          s.name.toLowerCase().includes(term.toLowerCase()) ||
          s.description.toLowerCase().includes(term.toLowerCase())
      );
      return filtered.map((s) => ({
        name: formatChoice(s, installed),
        value: s.name,
        description: s.description,
      }));
    },
  });

  if (!selected) return;

  const skill = REGISTRY.find((s) => s.name === selected);
  if (!skill) return;

  const isInstalled = installed.includes(selected);

  // Show confirmation with details (per CONTEXT.md)
  console.log(`\n${skill.name}`);
  console.log(`  ${skill.description}`);
  console.log(`  Commands: ${skill.commands.join(', ')}`);

  if (isInstalled) {
    const hasUpdate = checkForUpdate(selected);
    if (hasUpdate) {
      const doUpdate = await confirm({ message: 'Update available. Install update?' });
      if (doUpdate) {
        console.log(`Updating ${skill.name}...`);
        await installSkillFolder(selected);
        console.log(`Updated: ${skill.name}`);
      }
    } else {
      console.log('  (already installed, up to date)');
    }
  } else {
    const doInstall = await confirm({ message: 'Install?' });
    if (doInstall) {
      console.log(`Installing ${skill.name}...`);
      await installSkillFolder(selected);
      console.log(`Installed: ${skill.name}`);
    }
  }
}

/**
 * Run the skills CLI
 * Shows installed skills and provides option to install registry skills
 */
export async function runSkillsCLI(): Promise<void> {
  const installed = getInstalledSkills();

  console.log('\n=== Installed Skills ===');
  if (installed.length === 0) {
    console.log('(none)');
  } else {
    installed.forEach((s) => console.log(`  - ${s}`));
  }
  console.log();

  const notInstalled = REGISTRY.filter((s) => !installed.includes(s.name));

  if (notInstalled.length === 0) {
    console.log('All registry skills installed.');
    return;
  }

  const choice = await select({
    message: 'Install a skill?',
    choices: [
      ...notInstalled.map((s) => ({ name: `${s.name} - ${s.description}`, value: s.name })),
      { name: 'Exit', value: 'exit' },
    ],
  });

  if (choice === 'exit') return;

  const skill = REGISTRY.find((s) => s.name === choice);
  if (skill) {
    console.log(`Installing ${skill.name}...`);
    await installSkillFolder(skill.name);
    console.log(`Installed: ${skill.name}`);
  }
}
