import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No publication, content approval, real Codex requests or analytics transmission.
export const commands = [
  "spec:check", "test:spec-tools", "check:play-content", "check:play-images", "test:toss",
  "test", "test:play-review", "test:play-image-storage", "test:material-image-storage", "test:local-review", "test:web", "typecheck", "build:web",
];
export function verificationCommands({ publicImages = false } = {}) {
  return publicImages ? commands.filter((command) => command !== "check:play-images") : [...commands];
}
export function verificationEnvironment(command, inherited = process.env, { publicImages = false } = {}) {
  const env = {
    ...inherited,
    OPENSPEC_TELEMETRY: "0", EXPO_NO_TELEMETRY: "1", EXPO_NO_DOTENV: "1", CI: "1",
    EXPO_PUBLIC_GA_ENABLED: "false", EXPO_PUBLIC_GA_MEASUREMENT_ID: "",
    EXPO_PUBLIC_ANALYTICS_ORIGIN: "", EXPO_PUBLIC_ANALYTICS_PREVIEW: "false",
    EXPO_PUBLIC_APP_TARGET: "web", EXPO_PUBLIC_TOSS_APP_NAME: "", TOSS_DEVTOOLS: "",
    VERCEL: "", VERCEL_ENV: "", VERCEL_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "",
    PLAY_IMAGE_PUBLIC_MANIFEST: "", PLAY_IMAGE_PUBLIC_ORIGIN: "", PLAY_IMAGE_PUBLIC_BUCKET: "",
    PLAY_IMAGE_PUBLIC_ASSET_DIR: "",
    MATERIAL_IMAGE_PUBLIC_MANIFEST: "", MATERIAL_IMAGE_PUBLIC_ORIGIN: "", MATERIAL_IMAGE_PUBLIC_BUCKET: "", MATERIAL_IMAGE_PUBLIC_ASSET_DIR: "",
  };
  for (const key of Object.keys(env)) {
    if ((key.startsWith("PLAY_IMAGE_STORAGE_") || key.startsWith("MATERIAL_IMAGE_STORAGE_")) || key.includes("SUPABASE") || key.includes("SERVICE_ROLE")) delete env[key];
  }
  if (publicImages && command === "build:web") {
    for (const key of ["PLAY_IMAGE_PUBLIC_MANIFEST", "PLAY_IMAGE_PUBLIC_ORIGIN", "PLAY_IMAGE_PUBLIC_BUCKET"]) {
      if (!inherited[key]) throw new Error(`Public-image verification requires ${key}`);
      env[key] = inherited[key];
    }
    env.PLAY_IMAGE_PUBLIC_ASSET_DIR = inherited.PLAY_IMAGE_PUBLIC_ASSET_DIR || "";
    for (const key of ["MATERIAL_IMAGE_PUBLIC_MANIFEST", "MATERIAL_IMAGE_PUBLIC_ORIGIN", "MATERIAL_IMAGE_PUBLIC_BUCKET"]) {
      if (!inherited[key]) throw new Error(`Public-image verification requires ${key}`);
      env[key] = inherited[key];
    }
    env.MATERIAL_IMAGE_PUBLIC_ASSET_DIR = inherited.MATERIAL_IMAGE_PUBLIC_ASSET_DIR || "";
  }
  // The local server distinguishes an absent origin from an empty origin.
  delete env.PUBLIC_ORIGIN;
  if (command === "build:web") env.PUBLIC_ORIGIN = "https://nori.example.test";
  return env;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--public-images")) throw new Error("Usage: pnpm verify:local [--public-images]");
  const options = { publicImages: args.includes("--public-images") };
  // Fail before checks if the explicitly selected public build is incomplete.
  verificationEnvironment("build:web", process.env, options);
  if (options.publicImages) console.info("Public images: no private-original check; build:web verifies every required public asset (hash, size and WebP).");
  for (const command of verificationCommands(options)) {
    console.info(`\nChecking ${command}`);
    const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", command], {
      stdio: "inherit", env: verificationEnvironment(command, process.env, options),
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
