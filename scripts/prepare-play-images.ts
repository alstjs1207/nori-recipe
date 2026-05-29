import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const EXPECTED_PLAY_IMAGE_COUNT = 191;
const DESTINATION_DIR = path.resolve("images/plays");
const IMAGE_EXTENSION = ".jpeg";

function usage(): string {
  return [
    "Usage:",
    "  pnpm prepare:play-images /path/to/private/images/plays",
    "  PLAY_IMAGES_SOURCE_DIR=/path/to/private/images/plays pnpm prepare:play-images",
    "  pnpm check:play-images",
  ].join("\n");
}

function expectedFileNames(): string[] {
  return Array.from({ length: EXPECTED_PLAY_IMAGE_COUNT }, (_, index) => {
    return `play_${String(index + 1).padStart(3, "0")}${IMAGE_EXTENSION}`;
  });
}

function ensureDirectory(dir: string, label: string): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`${label} does not exist or is not a directory: ${dir}`);
  }
}

function missingExpectedFiles(dir: string): string[] {
  return expectedFileNames().filter((fileName) => !existsSync(path.join(dir, fileName)));
}

function verifyPlayImages(dir: string): void {
  ensureDirectory(dir, "Play images directory");

  const missing = missingExpectedFiles(dir);
  if (missing.length > 0) {
    throw new Error(
      [
        `Missing ${missing.length} play image(s) in ${dir}.`,
        `First missing files: ${missing.slice(0, 10).join(", ")}`,
      ].join("\n"),
    );
  }

  const imageFiles = readdirSync(dir).filter((fileName) => {
    return /^play_\d{3}\.jpeg$/.test(fileName);
  });

  if (imageFiles.length !== EXPECTED_PLAY_IMAGE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PLAY_IMAGE_COUNT} play image files in ${dir}, found ${imageFiles.length}.`,
    );
  }
}

function copyPlayImages(sourceDir: string): void {
  ensureDirectory(sourceDir, "Source directory");

  const missingInSource = missingExpectedFiles(sourceDir);
  if (missingInSource.length > 0) {
    throw new Error(
      [
        `Source directory is missing ${missingInSource.length} play image(s): ${sourceDir}`,
        `First missing files: ${missingInSource.slice(0, 10).join(", ")}`,
      ].join("\n"),
    );
  }

  mkdirSync(DESTINATION_DIR, { recursive: true });

  for (const fileName of expectedFileNames()) {
    copyFileSync(path.join(sourceDir, fileName), path.join(DESTINATION_DIR, fileName));
  }

  verifyPlayImages(DESTINATION_DIR);
  console.log(`Copied ${EXPECTED_PLAY_IMAGE_COUNT} play images to ${DESTINATION_DIR}`);
}

const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify-only");

if (verifyOnly) {
  verifyPlayImages(DESTINATION_DIR);
  console.log(`Found ${EXPECTED_PLAY_IMAGE_COUNT} play images in ${DESTINATION_DIR}`);
} else {
  const sourceDir = args.find((arg) => !arg.startsWith("-")) ?? process.env.PLAY_IMAGES_SOURCE_DIR;

  if (!sourceDir) {
    throw new Error(`Missing private play image source directory.\n${usage()}`);
  }

  copyPlayImages(path.resolve(sourceDir));
}
