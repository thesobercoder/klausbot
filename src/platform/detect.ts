/**
 * Platform detection module for klausbot.
 *
 * Detects macOS, Linux, and WSL2 environments using Node.js built-in modules.
 * No external dependencies.
 */

import os from 'os';
import { existsSync, readFileSync } from 'fs';

/**
 * Supported platform types.
 * - macos: macOS (Darwin)
 * - linux: Native Linux (not WSL2)
 * - wsl2: Windows Subsystem for Linux 2
 * - unsupported: Windows native or unknown platforms
 */
export type Platform = 'macos' | 'linux' | 'wsl2' | 'unsupported';

/**
 * Detailed platform information for diagnostics and platform-specific behavior.
 */
export interface PlatformInfo {
  /** Detected platform type */
  platform: Platform;
  /** Human-readable platform name (e.g., "macOS (Apple Silicon)") */
  displayName: string;
  /** True if running in WSL2 environment */
  isWSL: boolean;
  /** CPU architecture (from os.arch(), e.g., "arm64", "x64") */
  arch: string;
  /** Node.js version (from process.version, e.g., "v22.0.0") */
  nodeVersion: string;
  /** Path to the running script (from process.argv[1]) */
  execPath: string;
}

/**
 * Detects WSL2 environment on Linux systems.
 *
 * Detection strategy:
 * 1. Check for /.dockerenv - if exists, NOT WSL2 (container on WSL2 host)
 * 2. Check os.release() for 'microsoft' string
 * 3. Fallback: read /proc/version for 'microsoft' string
 *
 * @returns true if running in WSL2, false otherwise
 */
function isWSL2(): boolean {
  // Docker on WSL2 shows "microsoft" in kernel but isn't actually WSL2
  if (existsSync('/.dockerenv')) {
    return false;
  }

  // Primary check: kernel release string
  const release = os.release().toLowerCase();
  if (release.includes('microsoft')) {
    return true;
  }

  // Fallback: /proc/version (some WSL2 versions)
  try {
    const procVersion = readFileSync('/proc/version', 'utf8').toLowerCase();
    return procVersion.includes('microsoft');
  } catch {
    // Not WSL2 or can't determine
    return false;
  }
}

/**
 * Detects the current platform and returns detailed information.
 *
 * @returns PlatformInfo with platform type and diagnostic details
 */
export function detectPlatform(): PlatformInfo {
  const osPlat = os.platform();
  const arch = os.arch();
  const nodeVersion = process.version;
  const execPath = process.argv[1] ?? '';

  let platform: Platform;
  let displayName: string;
  let isWSL = false;

  switch (osPlat) {
    case 'darwin':
      platform = 'macos';
      displayName = `macOS (${arch === 'arm64' ? 'Apple Silicon' : 'Intel'})`;
      break;

    case 'linux':
      isWSL = isWSL2();
      platform = isWSL ? 'wsl2' : 'linux';
      displayName = isWSL ? 'Linux (WSL2)' : 'Linux';
      break;

    case 'win32':
      // Native Windows is unsupported; WSL2 is the supported path
      platform = 'unsupported';
      displayName = 'Windows (unsupported - use WSL2)';
      break;

    default:
      platform = 'unsupported';
      displayName = `Unsupported (${osPlat})`;
  }

  return {
    platform,
    displayName,
    isWSL,
    arch,
    nodeVersion,
    execPath,
  };
}
