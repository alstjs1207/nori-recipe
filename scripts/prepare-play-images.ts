import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import playsBundle from "../data/plays.json";

const plays: Array<{ id: string; imageStatus?: string }> = playsBundle.plays;
const DESTINATION_DIR = path.resolve("images/plays");
const IMAGE_EXTENSION = ".jpeg";

function usage(): string {
  return [
    "Usage:",
    "  pnpm prepare:play-images /path/to/source/images/plays",
    "  PLAY_IMAGES_SOURCE_DIR=/path/to/source/images/plays pnpm prepare:play-images",
    "  pnpm check:play-images",
  ].join("\n");
}

function expectedFileNames(): string[] {
  return plays
    .filter((play) => play.imageStatus !== "review")
    .map((play) => `${play.id}${IMAGE_EXTENSION}`);
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
    return /^play_\d{3,}\.jpeg$/.test(fileName);
  });

  const knownFiles = new Set(plays.map((play) => `${play.id}${IMAGE_EXTENSION}`));
  const unknown = imageFiles.filter((fileName) => !knownFiles.has(fileName));
  if (unknown.length > 0) {
    throw new Error(
      `Found images without a play in data/plays.json: ${unknown.slice(0, 10).join(", ")}`,
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
  console.info(`Copied ${expectedFileNames().length} reviewed play images to ${DESTINATION_DIR}`);
}

const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify-only");

if (verifyOnly) {
  verifyPlayImages(DESTINATION_DIR);
  console.info(`Verified ${expectedFileNames().length} required play images; ${plays.filter((play) => play.imageStatus === "review").length} plays use image review fallbacks.`);
} else {
  const sourceDir = args.find((arg) => !arg.startsWith("-")) ?? process.env.PLAY_IMAGES_SOURCE_DIR;

  if (!sourceDir) {
    throw new Error(`Missing play image source directory.\n${usage()}`);
  }

  copyPlayImages(path.resolve(sourceDir));
}
