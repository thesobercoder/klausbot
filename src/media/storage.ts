/**
 * Image file storage with dated directories
 */

import { existsSync, mkdirSync, copyFileSync, statSync } from "fs";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { KLAUSBOT_HOME } from "../memory/home.js";
import { createChildLogger } from "../utils/index.js";

const log = createChildLogger("media:storage");

/**
 * Get today's image directory path
 * @returns Path to ~/.klausbot/images/{YYYY-MM-DD}/
 */
export function getImageDir(): string {
  const dateStr = new Date().toISOString().split("T")[0];
  return join(KLAUSBOT_HOME, "images", dateStr);
}

/**
 * Save image to dated directory with unique filename
 * @param sourcePath - Path to source image file
 * @param originalFilename - Optional original filename for extension detection
 * @returns Absolute path to saved image
 * @throws Error if copy fails
 */
export function saveImage(
  sourcePath: string,
  originalFilename?: string,
): string {
  const imageDir = getImageDir();

  // Create directory if not exists
  if (!existsSync(imageDir)) {
    mkdirSync(imageDir, { recursive: true });
    log.debug({ imageDir }, "created image directory");
  }

  // Extract extension from original filename or source path
  const ext = extname(originalFilename || sourcePath) || ".jpg";
  const filename = `${randomUUID()}${ext}`;
  const destination = join(imageDir, filename);

  try {
    copyFileSync(sourcePath, destination);
    const size = statSync(destination).size;
    log.info({ source: sourcePath, destination, size }, "image saved");
    return destination;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save image: ${message}`);
  }
}
