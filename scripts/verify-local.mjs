import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No publication, content approval, real Codex requests or analytics transmission.
export const commands = [
  "spec:check", "test:spec-tools", "check:play-content", "check:play-images",
  "test", "test:play-review", "test:local-review", "test:web", "typecheck", "build:web",
];
export function verificationEnvironment(command, inherited = process.env) {
  const env = {
    ...inherited,
    OPENSPEC_TELEMETRY: "0", EXPO_NO_TELEMETRY: "1", EXPO_NO_DOTENV: "1", CI: "1",
    EXPO_PUBLIC_GA_ENABLED: "false", EXPO_PUBLIC_GA_MEASUREMENT_ID: "",
    EXPO_PUBLIC_ANALYTICS_ORIGIN: "", EXPO_PUBLIC_ANALYTICS_PREVIEW: "false",
    VERCEL: "", VERCEL_ENV: "", VERCEL_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "",
  };
  // The local server distinguishes an absent origin from an empty origin.
  delete env.PUBLIC_ORIGIN;
  if (command === "build:web") env.PUBLIC_ORIGIN = "https://nori.example.test";
  return env;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const command of commands) {
    console.info(`\nChecking ${command}`);
    const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", command], {
      stdio: "inherit", env: verificationEnvironment(command),
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
