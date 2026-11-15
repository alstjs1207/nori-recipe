import path from "node:path";
import { fileURLToPath } from "node:url";
import { errorCode, fail, writeJson } from "./play-image-storage/files.mjs";
import { planMigration, readJson, validatePlan } from "./play-image-storage/manifest.mjs";
import { DEFAULT_PUBLIC, DEFAULT_STATE, migrate, outputPath, restore } from "./play-image-storage/migration.mjs";
import { directoryStore, supabaseStore } from "./play-image-storage/stores.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_PLAN = "generated/play-image-storage/admin-plan.json";

export async function main(args, { root = project, env = process.env } = {}) {
  const [command, ...flags] = args;
  const options = {};
  const values = new Set(["--ids", "--baseline-ref", "--original-bucket", "--public-bucket", "--plan", "--state", "--public-manifest", "--store-dir"]);
  const switches = new Set(["--write", "--remote"]);
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    if (Object.hasOwn(options, flag)) fail("INVALID_INPUT");
    if (switches.has(flag)) options[flag] = true;
    else if (values.has(flag) && flags[i + 1] && !flags[i + 1].startsWith("--")) options[flag] = flags[++i];
    else fail("INVALID_INPUT");
  }
  if (!["plan", "migrate", "restore"].includes(command)) fail("INVALID_INPUT");
  const allowed = command === "plan" ? ["--ids", "--baseline-ref", "--original-bucket", "--public-bucket", "--plan", "--write"] :
    ["--plan", "--state", "--write", "--remote", "--store-dir", ...(command === "migrate" ? ["--public-manifest"] : ["--ids"])];
  if (Object.keys(options).some((key) => !allowed.includes(key))) fail("INVALID_INPUT");
  const planPath = outputPath(options["--plan"] ?? DEFAULT_PLAN);
  const statePath = outputPath(options["--state"] ?? DEFAULT_STATE);
  const publicPath = outputPath(options["--public-manifest"] ?? DEFAULT_PUBLIC);
  if (new Set([planPath, statePath, publicPath]).size !== 3) fail("INVALID_INPUT");
  const ids = options["--ids"]?.split(",");
  const write = options["--write"] === true;
  if (command === "plan") {
    const plan = await planMigration(root, { ids, baselineRef: options["--baseline-ref"] ?? "HEAD",
      originalBucket: options["--original-bucket"], publicBucket: options["--public-bucket"] });
    validatePlan(plan);
    if (write) writeJson(root, planPath, plan);
    return { mode: write ? "write" : "dry-run", plan };
  }
  const plan = validatePlan(readJson(root, planPath));
  // Env vars alone can never enable network access. Directory mode ignores secrets.
  if (Boolean(options["--store-dir"]) === Boolean(options["--remote"])) fail("INVALID_INPUT");
  const store = options["--remote"] ? supabaseStore({ url: env.PLAY_IMAGE_STORAGE_URL, serviceRoleKey: env.PLAY_IMAGE_STORAGE_SERVICE_ROLE_KEY }) :
    directoryStore(path.resolve(root, options["--store-dir"]));
  return command === "migrate" ? migrate(root, plan, store, { write, statePath, publicPath }) : restore(root, plan, store, { ids, write, statePath });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((report) => {
    console.info(JSON.stringify(report, null, 2));
    if (report.results?.some((entry) => entry.status === "failed")) process.exitCode = 1;
  }).catch((error) => { console.error(errorCode(error)); process.exitCode = 1; });
}
