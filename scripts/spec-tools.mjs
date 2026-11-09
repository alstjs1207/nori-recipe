import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const readJson = (root, name) => JSON.parse(readFileSync(path.join(root, name), "utf8"));
const roots = ["app", "src", "scripts", "tests", "tools", "data/review-batches", ".github/workflows", ".agents/skills"];
const collectionSkills = ["play-recipe", "normalize-materials", "import-plays", "validate-plays", "generate-play-images", "generate-material-images"];
const rootFiles = ["data/plays.json", "data/materials.json", "package.json", "pnpm-lock.yaml", "app.json", "vercel.json", "metro.config.js", "babel.config.js", "tsconfig.json", "index.ts", "AGENTS.md", "CLAUDE.md", "README.md", "DEVELOPMENT.md", "HOME_RECOMMENDATION_RULES.md", "ASSET-LICENSE.md", "LICENSE", "NOTICE", "SECURITY.md", ".gitignore"];
function walk(root, dir) {
  const absolute = path.join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    if (["node_modules", "dist", ".DS_Store", ".gitkeep"].includes(entry.name)) return [];
    const name = `${dir}/${entry.name}`;
    if (entry.isSymbolicLink()) throw Error(`Source symlink needs explicit review: ${name}`);
    return entry.isDirectory() ? walk(root, name) : [name];
  });
}
export function sourceFiles(root) {
  const skills = existsSync(path.join(root, ".claude/skills")) ? readdirSync(path.join(root, ".claude/skills")).filter(n => collectionSkills.includes(n) || n.startsWith("openspec-")) : [];
  return [...new Set([
    ...roots.flatMap(dir => walk(root, dir)),
    ...skills.flatMap(name => walk(root, `.claude/skills/${name}`)),
    ...walk(root, ".claude/commands/opsx"),
    ...rootFiles.filter(p => existsSync(path.join(root, p))),
    ...readdirSync(root).filter(p => /\.(?:[cm]?[jt]sx?|json|ya?ml)$/.test(p) && lstatSync(path.join(root, p)).isFile()),
  ])].sort();
}
export function classify(file) {
  if (["LICENSE", "NOTICE", "SECURITY.md", "ASSET-LICENSE.md"].includes(file)) return ["spec-governance"];
  if (/openspec-|\/opsx\/|spec-tools|policy-checks|verify-local|AGENTS\.md|CLAUDE\.md/.test(file)) return ["spec-governance"];
  if (file === "HOME_RECOMMENDATION_RULES.md") return ["recommendations"];
  if (/^src\/engine\//.test(file)) return ["recommendations"];
  if (/^src\/analytics\/|WebAnalytics|legalNotices/.test(file)) return ["privacy"];
  if (/^src\/db\/|^src\/types\/db/.test(file)) return ["local-data", "play-records"];
  if (/sessionStore/.test(file)) return ["onboarding", "local-data", "recommendations"];
  if (/playsStore|^src\/data\//.test(file)) return ["catalog"];
  if (/^src\/onboarding\/|^app\/\(onboarding\)\/|WebFirstVisit|WebWelcome|^app\/start/.test(file)) return ["onboarding"];
  if (/^app\/\(main\)\/index|HomeRedesign|IntentReadiness/.test(file)) return ["recommendations"];
  if (/^app\/\(main\)\/(feedback|favorites|history|record)|feedbackSignals|stepProgress/.test(file)) return ["play-records"];
  if (/^app\/\(main\)\/(settings|mypage)/.test(file)) return ["local-data", "privacy", "web-platform"];
  if (/^app\/\(main\)\/(search|play)|^src\/play\//.test(file)) return ["catalog"];
  if (/^tools\/local-review\//.test(file)) return /recommendation/.test(file) ? ["local-studio", "recommendations"] : ["local-studio", "content-review"];
  if (/^scripts\/review\/|^scripts\/(?:.*review|.*material-images|build-play-catalog|validate-play-content)|^tests\/(?:.*review|material-images)|^data\/|^\.claude\/skills\//.test(file)) return ["content-review"];
  if (/^scripts\/(prepare-play-images|material-audit)/.test(file)) return ["content-review", "recommendations"];
  if (/^src\/constants\/(?:playImage|materialImage|materials|materialVisuals)/.test(file)) return ["content-review", "catalog"];
  if (/^tests\/web-/.test(file)) return ["web-platform", "catalog", "privacy"];
  if (/^scripts\/(?:web\/|.*web|upload)/.test(file)) return ["web-platform"];
  if (/^src\/(?:animations|components|hooks|utils|types|constants)\//.test(file) || /^app\/(?:_layout|index)|^app\/\(main\)\/_layout/.test(file)) return ["web-platform"];
  if (rootFiles.includes(file)) return ["web-platform"];
  return [];
}
export function makeIndex(root) {
  return { version: 1, files: sourceFiles(root).map(file => ({ path: file, domains: [...new Set(classify(file))].sort() })) };
}

function safeText(root, relative) {
  if (
    typeof relative !== "string" ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes("..")
  )
    throw Error(`Invalid evidence path: ${relative}`);
  const target = path.join(root, relative);
  const resolved = realpathSync(target);
  if (!resolved.startsWith(realpathSync(root) + path.sep) || lstatSync(target).isSymbolicLink())
    throw Error(`Evidence must be a repository file: ${relative}`);
  return readFileSync(target, "utf8");
}

function specText(root, domain) {
  const current = `openspec/specs/${domain}/spec.md`;
  if (existsSync(path.join(root, current))) return safeText(root, current);
  const changes = path.join(root, "openspec/changes");
  const candidates = existsSync(changes)
    ? readdirSync(changes)
        .filter((p) => p !== "archive")
        .map((p) => `openspec/changes/${p}/specs/${domain}/spec.md`)
        .filter((p) => existsSync(path.join(root, p)))
    : [];
  if (candidates.length !== 1)
    throw Error(`Missing or ambiguous current spec: ${domain}`);
  return safeText(root, candidates[0]);
}

export function checkPolicies(root) {
  const map = readJson(root, "openspec/policy-map.json");
  if (map.version !== 1 || !Array.isArray(map.domains) || !map.domains.length)
    throw Error("Invalid policy-map schema");
  const domains = new Set(),
    ids = new Set();
  let scenarios = 0,
    automated = 0,
    sourceReviewed = 0;
  for (const domain of map.domains) {
    if (!/^[a-z][a-z0-9-]*$/.test(domain.id) || domains.has(domain.id))
      throw Error(`Invalid/duplicate domain: ${domain.id}`);
    domains.add(domain.id);
    const text = specText(root, domain.id);
    const blocks = [
      ...text.matchAll(
        /^### Requirement: ([A-Z]+-\d{3}) (.+)\n([\s\S]*?)(?=^### Requirement: |$(?![\s\S]))/gm,
      ),
    ];
    const headingCount = (text.match(/^### Requirement:/gm) ?? []).length;
    if (!blocks.length || headingCount !== blocks.length)
      throw Error(`Invalid requirement heading: ${domain.id}`);
    const requirementMap = new Map(domain.requirements.map((r) => [r.id, r]));
    if (requirementMap.size !== domain.requirements.length)
      throw Error(`Duplicate policy-map ID: ${domain.id}`);
    for (const [, id, , body] of blocks) {
      if (ids.has(id)) throw Error(`Duplicate requirement ID: ${id}`);
      ids.add(id);
      const record = requirementMap.get(id);
      if (!record) throw Error(`Unmapped requirement: ${id}`);
      requirementMap.delete(id);
      const cases = body.split(/^#### Scenario: /m).slice(1);
      if (
        !cases.length ||
        cases.some((s) => !s.includes("**WHEN**") || !s.includes("**THEN**"))
      )
        throw Error(`Missing WHEN/THEN scenario: ${id}`);
      scenarios += cases.length;
      if (!record.sources?.length)
        throw Error(`No implementation evidence: ${id}`);
      if (!["automated", "source-reviewed"].includes(record.verification))
        throw Error(`Invalid verification state: ${id}`);
      if (record.verification === "automated" && !record.tests?.length)
        throw Error(`Automated without tests: ${id}`);
      for (const file of [...record.sources, ...record.tests]) {
        try {
          safeText(root, file);
        } catch (error) {
          throw Error(`${id}: ${error.message}`);
        }
      }
      if (record.tests.some((p) => !/(?:^tests\/|^tools\/local-review\/tests\/|^src\/.+\.test\.tsx?$)/.test(p)))
        throw Error(`Invalid test evidence: ${id}`);
      if (!record.anchors?.length)
        throw Error(`No implementation anchor: ${id}`);
      for (const anchor of record.anchors) {
        if (
          !record.sources.includes(anchor.path) ||
          typeof anchor.contains !== "string" ||
          !anchor.contains.trim() ||
          !safeText(root, anchor.path).includes(anchor.contains)
        )
          throw Error(`Missing implementation anchor: ${id} ${anchor.path}`);
      }
      if (record.verification === "automated") automated++;
      else sourceReviewed++;
    }
    if (requirementMap.size)
      throw Error(
        `Stale policy-map IDs: ${[...requirementMap.keys()].join(", ")}`,
      );
  }
  const liveSpecRoot = path.join(root, "openspec/specs");
  if (existsSync(liveSpecRoot)) {
    const live = readdirSync(liveSpecRoot, { withFileTypes: true })
      .filter((p) => p.isDirectory())
      .map((p) => p.name);
    for (const d of live)
      if (!domains.has(d)) throw Error(`Unmapped spec domain: ${d}`);
  }
  const actual = makeIndex(root);
  for (const file of actual.files) {
    if (!file.domains.length || file.domains.some((d) => !domains.has(d)))
      throw Error(`Unclassified source: ${file.path}`);
  }
  const saved = readJson(root, "openspec/source-index.json");
  if (JSON.stringify(saved) !== JSON.stringify(actual))
    throw Error(
      "Source index is stale; run pnpm spec:index and review ownership",
    );
  return {
    domains: domains.size,
    requirements: ids.size,
    scenarios,
    automated,
    sourceReviewed,
    files: actual.files.length,
  };
}

export function assertChangeEvidence(changedPaths, catalog, read) {
  const behavior = changedPaths.filter((p) =>
    /^(app|src|scripts|tools|data|\.github|\.agents|\.claude)\/|^(package\.json|pnpm-lock\.yaml|app\.json|vercel\.json|metro\.config\.js|babel\.config\.js|tsconfig\.json|index\.ts|AGENTS\.md|CLAUDE\.md|HOME_RECOMMENDATION_RULES\.md|LICENSE|NOTICE|SECURITY\.md|ASSET-LICENSE\.md)$/.test(
      p,
    ),
  );
  const affected = new Set(behavior.flatMap(classify));
  for (const p of behavior)
    if (!classify(p).length) throw Error(`Unclassified changed source: ${p}`);
  const records = changedPaths
    .filter((p) => /^openspec\/changes\/.+\.md$/.test(p))
    .map((p) => read(p))
    .join("\n");
  for (const id of affected) {
    if (changedPaths.includes(`openspec/specs/${id}/spec.md`)) continue;
    const domain = catalog.domains.find((d) => d.id === id);
    if (
      !domain ||
      !domain.requirements.some((r) =>
        new RegExp(`\\b${r.id}\\b`).test(records),
      )
    ) {
      throw Error(
        `Missing policy/change evidence for ${id}; cite a requirement ID in an OpenSpec change or update its spec`,
      );
    }
  }
  return [...affected];
}

function main(root, command, value) {
  if (command === "index") {
    const index = makeIndex(root);
    const unknown = index.files.filter((f) => !f.domains.length);
    if (unknown.length)
      throw Error(
        `Unclassified sources:\n${unknown.map((f) => f.path).join("\n")}`,
      );
    writeFileSync(
      path.join(root, "openspec/source-index.json"),
      JSON.stringify(index, null, 2) + "\n",
    );
    console.log(`Indexed ${index.files.length} files`);
  } else if (command === "check") {
    console.log("Policy evidence:", JSON.stringify(checkPolicies(root)));
  } else if (command === "context") {
    const catalog = readJson(root, "openspec/policy-map.json");
    const selected = value
      ? catalog.domains.filter(
          (d) => d.id === value || classify(value).includes(d.id),
        )
      : [];
    if (!selected.length) {
      console.log(
        "Select a domain or source path:\n" +
          catalog.domains.map((d) => `${d.id}: ${d.title}`).join("\n"),
      );
      if (value) throw Error(`Unknown domain or path: ${value}`);
      return;
    }
    for (const d of selected) {
      console.log(
        `\n${d.id}: ${d.title}\nRead openspec/specs/${d.id}/spec.md\nCommands: ${d.commands.join("; ")}`,
      );
      for (const r of d.requirements)
        console.log(
          `${r.id} [${r.verification}]\n  source: ${r.sources.join(", ")}\n  find: ${r.anchors.map((a) => a.contains).join(", ")}\n  tests: ${r.tests.join(", ") || "no linked automated regression"}`,
        );
    }
    console.log(
      "\nAlso read openspec/known-gaps.md and relevant active changes (exclude archive by default).",
    );
  } else if (command === "changed") {
    if (!value || value.startsWith("-"))
      throw Error("Pass an explicit Git base SHA/ref");
    execFileSync("git", ["rev-parse", "--verify", `${value}^{commit}`], {
      cwd: root,
      stdio: "pipe",
    });
    const changed = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACDMRT", "-z", value, "--"],
      { cwd: root },
    )
      .toString()
      .split("\0")
      .filter(Boolean);
    const untracked = execFileSync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { cwd: root },
    )
      .toString()
      .split("\0")
      .filter(Boolean);
    const affected = assertChangeEvidence(
      [...new Set([...changed, ...untracked])],
      readJson(root, "openspec/policy-map.json"),
      (p) => (existsSync(path.join(root, p)) ? safeText(root, p) : ""),
    );
    console.log(
      `Change evidence: ${affected.join(", ") || "no runtime policy changes"}`,
    );
  } else
    throw Error(
      "Use index, check, context <domain-or-path>, or changed <base-ref>",
    );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(repositoryRoot, process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
