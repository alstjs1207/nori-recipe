import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkPolicies, classify, makeIndex, assertChangeEvidence } from "../scripts/spec-tools.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "nori-spec-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, text) => { mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); writeFileSync(path.join(root, name), text); };
  put("src/engine/recommend.ts", "export function recommend() {}\n");
  put("src/engine/recommend.test.ts", "test('recommend regression', () => {});\n");
  put("openspec/specs/recommendations/spec.md", "# Recommendation\n\n## Purpose\n\nFixture contract.\n\n## Requirements\n\n### Requirement: REC-001 Candidate eligibility\n\nThe system MUST filter candidates.\n\n#### Scenario: Unsafe candidate\n\n- **WHEN** a candidate is unsafe\n- **THEN** exclude it.\n");
  const map = { version: 1, domains: [{ id: "recommendations", title: "Recommendation", commands: [], requirements: [{ id: "REC-001", verification: "automated", sources: ["src/engine/recommend.ts"], tests: ["src/engine/recommend.test.ts"], anchors: [{ path: "src/engine/recommend.ts", contains: "function recommend" }] }] }] };
  const save = () => { put("openspec/policy-map.json", JSON.stringify(map)); put("openspec/source-index.json", JSON.stringify(makeIndex(root))); };
  save();
  return { root, put, map, save, record: map.domains[0].requirements[0] };
}

test("repository baseline maps all current requirements and managed sources", () => {
  const actual = checkPolicies(path.resolve(import.meta.dirname, ".."));
  assert.ok(actual.domains >= 10);
  assert.ok(actual.requirements >= 33);
  assert.ok(actual.scenarios > actual.requirements);
  assert.ok(actual.sourceReviewed > 0);
});

test("reject removed source anchors and automated claims without tests", t => {
  const f = fixture(t);
  assert.equal(checkPolicies(f.root).requirements, 1);
  f.record.anchors[0].contains = "missing function"; f.save();
  assert.throws(() => checkPolicies(f.root), /Missing implementation anchor/);
  f.record.anchors[0].contains = "function recommend"; f.record.tests = []; f.save();
  assert.throws(() => checkPolicies(f.root), /Automated without tests/);
});

test("reject orphan, duplicate and non-scenario requirement contracts", t => {
  const f = fixture(t);
  const name = "openspec/specs/recommendations/spec.md";
  const text = readFileSync(path.join(f.root, name), "utf8");
  f.put(name, text.replace("**THEN**", "result"));
  assert.throws(() => checkPolicies(f.root), /Missing WHEN\/THEN/);
  f.put(name, text + "\n### Requirement: REC-002 New contract\n");
  assert.throws(() => checkPolicies(f.root), /Unmapped requirement/);
  f.put(name, text); f.map.domains[0].requirements.push(f.record); f.save();
  assert.throws(() => checkPolicies(f.root), /Duplicate policy-map/);
});

test("reject unsafe evidence paths, symlinks, fake test paths and missing evidence", t => {
  const f = fixture(t);
  for (const source of ["../outside.ts", "/tmp/outside.ts"]) {
    f.record.sources = [source]; f.save();
    assert.throws(() => checkPolicies(f.root), /Invalid evidence path/);
  }
  f.record.sources = ["src/engine/recommend.ts"];
  f.record.tests = ["src/engine/recommend.ts"]; f.save();
  assert.throws(() => checkPolicies(f.root), /Invalid test evidence/);
  f.record.tests = ["tests/missing.test.mjs"]; f.save();
  assert.throws(() => checkPolicies(f.root), /ENOENT/);
  f.record.tests = ["src/engine/recommend.test.ts"];
  f.put("outside.txt", "outside");
  symlinkSync(path.join(f.root, "outside.txt"), path.join(f.root, "link.txt"));
  f.record.sources = ["link.txt"]; f.save();
  assert.throws(() => checkPolicies(f.root), /Evidence must be a repository file/);
});

test("detect stale indexes and unknown feature roots without mutating them", t => {
  const f = fixture(t);
  f.put("src/engine/added.ts", "export const candidate = 1;");
  assert.throws(() => checkPolicies(f.root), /Source index is stale/);
  f.save(); assert.equal(checkPolicies(f.root).requirements, 1);
  f.put("src/new-feature/unknown.ts", "export const value = 1;");
  f.save(); assert.throws(() => checkPolicies(f.root), /Unclassified source/);
  assert.deepEqual(classify("app/(main)/unknown.tsx"), []);
});

test("require domain-specific change evidence for runtime, data, deletion and tooling changes", () => {
  const catalog = { domains: [
    { id: "recommendations", requirements: [{ id: "REC-001" }] },
    { id: "content-review", requirements: [{ id: "CON-001" }] },
    { id: "spec-governance", requirements: [{ id: "GOV-001" }] },
  ] };
  assert.throws(() => assertChangeEvidence(["src/engine/recommend.ts"], catalog, () => ""), /Missing policy\/change evidence/);
  assert.throws(() => assertChangeEvidence(["data/plays.json", "openspec/changes/a/proposal.md"], catalog, () => "REC-001"), /content-review/);
  for (const [source, id] of [["src/engine/deleted.ts", "REC-001"], ["data/plays.json", "CON-001"], ["scripts/spec-tools.mjs", "GOV-001"]]) {
    assert.equal(assertChangeEvidence([source, "openspec/changes/a/proposal.md"], catalog, () => id).length, 1);
  }
  assert.deepEqual(assertChangeEvidence(["src/engine/recommend.ts", "openspec/specs/recommendations/spec.md"], catalog, () => ""), ["recommendations"]);
  assert.throws(() => assertChangeEvidence(["src/future/feature.ts"], catalog, () => ""), /Unclassified changed/);
  for (const file of ["LICENSE", "NOTICE", "SECURITY.md", "ASSET-LICENSE.md"]) {
    assert.deepEqual(classify(file), ["spec-governance"]);
    assert.throws(() => assertChangeEvidence([file], catalog, () => ""), /Missing policy\/change evidence/);
    assert.deepEqual(assertChangeEvidence([file, "openspec/changes/a/proposal.md"], catalog, () => "GOV-001"), ["spec-governance"]);
  }
});

test("local verification isolates build origins from server fixtures and disables analytics", async () => {
  const { verificationEnvironment, commands } = await import("../scripts/verify-local.mjs");
  const inherited = { PATH: "/fixture/bin", PUBLIC_ORIGIN: "https://production.example", VERCEL: "1", VERCEL_ENV: "production", EXPO_PUBLIC_GA_ENABLED: "true", EXPO_PUBLIC_GA_MEASUREMENT_ID: "G-PRODUCTION" };
  for (const command of commands) {
    const env = verificationEnvironment(command, inherited);
    assert.equal(env.PATH, inherited.PATH);
    assert.equal(env.EXPO_NO_DOTENV, "1");
    assert.equal(env.EXPO_PUBLIC_GA_ENABLED, "false");
    assert.equal(env.EXPO_PUBLIC_GA_MEASUREMENT_ID, "");
    assert.equal(env.VERCEL, "");
    if (command === "build:web") assert.equal(env.PUBLIC_ORIGIN, "https://nori.example.test");
    else assert.equal(Object.hasOwn(env, "PUBLIC_ORIGIN"), false);
  }
  assert.equal(inherited.PUBLIC_ORIGIN, "https://production.example");
});
