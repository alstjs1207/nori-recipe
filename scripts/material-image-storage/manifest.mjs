import fs from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { materialDefinitionHash } from "../review/material-images.mjs";
import { canonical, fail, safePath, sha256 } from "../play-image-storage/files.mjs";
import { decodeOriginal, validBucket } from "../play-image-storage/manifest.mjs";

export const TRANSFORM = "material-webp-192-inside-q65-v1";
export const SOURCES = "src/constants/materialImageSources.ts";
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const validSlug = (slug) => typeof slug === "string" && /^[a-z][a-z0-9_]*$/.test(slug);
const sourcePath = (value) => typeof value === "string" && /^images\/material\/[^/\\]+\.jpeg$/.test(value) && !value.includes("..");
const read = (root, file) => fs.readFileSync(safePath(root, file));
const json = (root, file) => JSON.parse(read(root, file));
export const versionOf = (sourceHash, iconHash) => sha256(JSON.stringify([TRANSFORM, sourceHash, iconHash]));
const descriptor = (bytes, path) => ({ path, sha256: sha256(bytes), bytes: bytes.length });
export function mappings(source) {
  const pairs = [...source.matchAll(/^\s+(\w+): require\("([^"]+)"\),?$/gm)].map(([,slug,relative]) => {
    if (!validSlug(slug) || (!relative.startsWith("../../images/material/") && relative !== "../../assets/icon.png")) fail("INVALID_INPUT");
    const file = relative.slice(6);
    if (relative !== "../../assets/icon.png" && !sourcePath(file)) fail("INVALID_INPUT");
    return [slug, file];
  });
  if (!pairs.length || new Set(pairs.map(([slug]) => slug)).size !== pairs.length) fail("INVALID_INPUT");
  return Object.fromEntries(pairs);
}
export function materialInputs(root) {
  const registry = json(root,"data/materials.json"), map = mappings(read(root,SOURCES).toString());
  const slugs = Object.values(registry.categories).flat();
  if (slugs.length !== new Set(slugs).size || slugs.some(slug => !validSlug(slug) || !Object.hasOwn(map,slug)) || Object.keys(map).some(slug => !slugs.includes(slug))) fail("INVALID_INPUT");
  return {registry,map};
}
export const approvedSlugs = ({registry,map}) => Object.keys(map).filter(slug => !(registry.reviewPending ?? []).includes(slug) && sourcePath(map[slug])).sort();
export async function iconBytes(original) {
  await decodeOriginal(original);
  return sharp(original).rotate().resize(192,192,{fit:"inside",withoutEnlargement:true}).webp({quality:65}).toBuffer();
}
function git(root, ref, file) {
  try { return execFileSync("git",["show",`${ref}:${file}`],{cwd:root,stdio:["ignore","pipe","pipe"],maxBuffer:16*1024*1024}); }
  catch { fail("REVIEW_REQUIRED"); }
}
export function baseline(root, ref) {
  if (typeof ref !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(ref) || ref.startsWith("-")) fail("INVALID_INPUT");
  let commit;
  try { commit=execFileSync("git",["rev-parse","--verify",`${ref}^{commit}`],{cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim(); }
  catch { fail("INVALID_INPUT"); }
  return { commit, registry:JSON.parse(git(root,commit,"data/materials.json")),map:mappings(git(root,commit,SOURCES).toString()),image:file=>git(root,commit,file) };
}
export async function planMigration(root,{baselineRef="HEAD",originalBucket,publicBucket}={}) {
  if (!validBucket(originalBucket) || !validBucket(publicBucket) || originalBucket===publicBucket) fail("INVALID_INPUT");
  const current=materialInputs(root), approved=baseline(root,baselineRef), originals=[];
  const files=fs.readdirSync(safePath(root,"images/material")).filter(file=>file.endsWith(".jpeg")).sort();
  for (const file of files) {
    const source=`images/material/${file}`; if (!sourcePath(source)) fail("UNSAFE_PATH");
    const bytes=read(root,source); await decodeOriginal(bytes);
    if (sha256(approved.image(source))!==sha256(bytes)) fail("REVIEW_REQUIRED");
    originals.push({source,...descriptor(bytes,`originals/${sha256(bytes)}/original.jpeg`)});
  }
  const entries={};
  for (const slug of approvedSlugs(current)) {
    const source=current.map[slug], original=originals.find(item=>item.source===source);
    if (!original) fail("MISSING");
    const contentHash=materialDefinitionHash(current.registry,slug);
    if ((approved.registry.reviewPending??[]).includes(slug) || approved.map[slug]!==source || materialDefinitionHash(approved.registry,slug)!==contentHash) fail("REVIEW_REQUIRED");
    const bytes=await iconBytes(read(root,source)), version=versionOf(original.sha256,sha256(bytes));
    entries[slug]={source,sourceHash:original.sha256,contentHash,version,icon:descriptor(bytes,`materials/${slug}/${version}/icon.webp`)};
  }
  return validatePlan({schemaVersion:1,transform:TRANSFORM,baselineCommit:approved.commit,buckets:{original:originalBucket,public:publicBucket},originals,entries});
}
export function validatePublic(candidate,bucket) {
  if (candidate?.schemaVersion!==1 || candidate.transform!==TRANSFORM || !validBucket(bucket) || candidate.bucket!==bucket || !candidate.entries || Array.isArray(candidate.entries) || typeof candidate.entries!=="object") fail("INVALID_INPUT");
  const entries={};
  for (const [slug,entry] of Object.entries(candidate.entries)) {
    const icon=entry?.icon;
    if (!validSlug(slug) || !hash(entry.sourceHash) || !hash(entry.contentHash) || !hash(icon?.sha256) || !Number.isSafeInteger(icon.bytes) || icon.bytes<1 || entry.version!==versionOf(entry.sourceHash,icon.sha256) || icon.path!==`materials/${slug}/${entry.version}/icon.webp`) fail("INVALID_INPUT");
    entries[slug]={sourceHash:entry.sourceHash,contentHash:entry.contentHash,version:entry.version,icon:{path:icon.path,sha256:icon.sha256,bytes:icon.bytes}};
  }
  return {schemaVersion:1,transform:TRANSFORM,bucket,entries};
}
export function validatePlan(plan) {
  if (plan?.schemaVersion!==1 || plan.transform!==TRANSFORM || !/^[a-f0-9]{40}$/.test(plan.baselineCommit??"") || !validBucket(plan.buckets?.original) || plan.buckets.original===plan.buckets.public || !Array.isArray(plan.originals) || !plan.originals.length || new Set(plan.originals.map(item=>item.source)).size!==plan.originals.length) fail("INVALID_INPUT");
  for (const item of plan.originals) if (!sourcePath(item.source) || !hash(item.sha256) || item.path!==`originals/${item.sha256}/original.jpeg` || !Number.isSafeInteger(item.bytes) || item.bytes<1) fail("INVALID_INPUT");
  const publicPart=validatePublic({schemaVersion:1,transform:TRANSFORM,bucket:plan.buckets.public,entries:plan.entries},plan.buckets.public);
  for (const [slug,entry] of Object.entries(plan.entries)) if (!sourcePath(entry.source) || !plan.originals.some(item=>item.source===entry.source && item.sha256===publicPart.entries[slug].sourceHash)) fail("INVALID_INPUT");
  return plan;
}
export function publicEntry(entry) {
  const {sourceHash,contentHash,version,icon}=entry;
  return {sourceHash,contentHash,version,icon:{path:icon.path,sha256:icon.sha256,bytes:icon.bytes}};
}
export function currentOriginal(root,plan,item) {
  const bytes=read(root,item.source);
  if (sha256(bytes)!==item.sha256 || bytes.length!==item.bytes || sha256(git(root,plan.baselineCommit,item.source))!==item.sha256) fail("SOURCE_CHANGED");
  return bytes;
}
export async function currentEntry(root,plan,slug) {
  const entry=plan.entries[slug], input=materialInputs(root), approved=baseline(root,plan.baselineCommit);
  if (!approvedSlugs(input).includes(slug) || input.map[slug]!==entry.source || approved.map[slug]!==entry.source || (approved.registry.reviewPending??[]).includes(slug) || materialDefinitionHash(input.registry,slug)!==entry.contentHash || materialDefinitionHash(approved.registry,slug)!==entry.contentHash) fail("REVIEW_REQUIRED");
  const item=plan.originals.find(item=>item.source===entry.source), bytes=currentOriginal(root,plan,item), icon=await iconBytes(bytes);
  if (sha256(icon)!==entry.icon.sha256 || sha256(bytes)!==entry.sourceHash) fail("SOURCE_CHANGED");
  return icon;
}
export const planHash = plan => sha256(JSON.stringify(canonical(validatePlan(plan))));
