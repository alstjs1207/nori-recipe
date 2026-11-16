import fs from "node:fs";
import { materialDefinitionHash } from "../review/material-images.mjs";
import { decodeOriginal } from "../play-image-storage/manifest.mjs";
import { createFile, errorCode, fail, locked, readOptional, safePath, sha256, writeJson } from "../play-image-storage/files.mjs";
import { approvedSlugs, currentEntry, currentOriginal, materialInputs, planHash, publicEntry, TRANSFORM, validatePlan, validatePublic } from "./manifest.mjs";

export const DEFAULT_PLAN="generated/material-image-storage/admin-plan.json";
export const DEFAULT_STATE="generated/material-image-storage/state.json";
export const DEFAULT_PUBLIC="generated/material-image-storage/public-candidate.json";
export function outputPath(relative) {
  if (typeof relative!=="string" || !relative.startsWith("generated/material-image-storage/") || !relative.endsWith(".json")) fail("UNSAFE_PATH");
  return relative;
}
const optionalJson=(root,file)=>{const bytes=readOptional(safePath(root,outputPath(file)));return bytes?JSON.parse(bytes):null;};
export function verify(bytes,asset) {
  if (!bytes) fail("MISSING");
  if (bytes.length!==asset.bytes || sha256(bytes)!==asset.sha256) fail("INTEGRITY");
}
function stateFor(root,plan,store,statePath) {
  const state=optionalJson(root,statePath);
  if (state && (state.schemaVersion!==1 || state.store!==store.identity || JSON.stringify(state.buckets)!==JSON.stringify(plan.buckets))) fail("CONFLICT");
  return {schemaVersion:1,store:store.identity,buckets:plan.buckets,planHash:planHash(plan),objects:state?.objects??{},cleanup:state?.cleanup??[],results:[]};
}
function queue(state,slug,bucket,icon,reason) {
  if (!state.cleanup.some(item=>item.bucket===bucket && item.path===icon.path)) state.cleanup.push({slug,bucket,...icon,reason});
}
function prune(root,manifest,state) {
  const input=materialInputs(root), approved=new Set(approvedSlugs(input));
  const reasonFor=(slug,entry)=>{
    if (!approved.has(slug)) return "not-approved";
    if (materialDefinitionHash(input.registry,slug)!==entry.contentHash) return "definition-changed";
    const bytes=readOptional(safePath(root,input.map[slug]));
    return !bytes || sha256(bytes)!==entry.sourceHash ? "source-changed" : null;
  };
  for (const [slug,entry] of Object.entries(manifest.entries)) {
    const reason=reasonFor(slug,entry);
    if (reason) {queue(state,slug,manifest.bucket,entry.icon,reason);delete manifest.entries[slug];}
  }
  for (const item of Object.values(state.objects)) if (item.bucket===manifest.bucket) {
    const reason=reasonFor(item.slug,item); if (reason) queue(state,item.slug,item.bucket,item,reason);
  }
}
async function ensure(store,bucket,asset,bytes,type,progress) {
  verify(bytes,asset); progress({attempted:true,verified:false});
  let found=await store.get(bucket,asset.path);
  if (found===null) {const created=await store.create(bucket,asset.path,bytes,type);progress({created,verified:false});found=await store.get(bucket,asset.path);}
  verify(found,asset); progress({verified:true});
}
export async function migrate(root,plan,store,{write=false,statePath=DEFAULT_STATE,publicPath=DEFAULT_PUBLIC}={}) {
  validatePlan(plan); outputPath(statePath); outputPath(publicPath); if(statePath===publicPath) fail("INVALID_INPUT");
  const run=async()=>{
    const state=stateFor(root,plan,store,statePath);
    const manifest=validatePublic(optionalJson(root,publicPath)??{schemaVersion:1,transform:TRANSFORM,bucket:plan.buckets.public,entries:{}},plan.buckets.public);
    const persist=()=>{
      prune(root,manifest,state);
      const active=new Set(Object.values(manifest.entries).map(entry=>entry.icon.path));
      state.cleanup=state.cleanup.filter(item=>item.bucket!==manifest.bucket || !active.has(item.path));
      if(write){writeJson(root,statePath,state);writeJson(root,publicPath,manifest);}
    };
    persist();
    const progress=(bucket,asset,extra={})=>(result)=>{
      const key=`${bucket}/${asset.path}`;state.objects[key]={...state.objects[key],bucket,...asset,...extra,...result};
      if(write)writeJson(root,statePath,state);
    };
    const failedSources=new Set();
    for(const item of plan.originals) {
      try {
        const bytes=currentOriginal(root,plan,item); await decodeOriginal(bytes);
        if(write){await ensure(store,plan.buckets.original,item,bytes,"image/jpeg",progress(plan.buckets.original,item));currentOriginal(root,plan,item);}
        state.results.push({source:item.source,status:write?"verified":"planned",kind:"original"});
      }catch(error){failedSources.add(item.source);state.results.push({source:item.source,status:"failed",code:errorCode(error),kind:"original"});}
      persist();
    }
    for(const [slug,entry] of Object.entries(plan.entries)) {
      try {
        if(failedSources.has(entry.source))fail("INTEGRITY");
        const bytes=await currentEntry(root,plan,slug);
        if(write){
          await ensure(store,plan.buckets.public,entry.icon,bytes,"image/webp",progress(plan.buckets.public,entry.icon,{slug,sourceHash:entry.sourceHash,contentHash:entry.contentHash}));
          await currentEntry(root,plan,slug);
          const previous=manifest.entries[slug];if(previous&&previous.version!==entry.version)queue(state,slug,manifest.bucket,previous.icon,"superseded");
          manifest.entries[slug]=publicEntry(entry);
        }
        state.results.push({slug,status:write?"verified":"planned",kind:"icon"});
      }catch(error){
        if(errorCode(error)==="INTEGRITY"&&manifest.entries[slug]?.version===entry.version){queue(state,slug,manifest.bucket,entry.icon,"integrity-failed");delete manifest.entries[slug];}
        state.results.push({slug,status:"failed",code:errorCode(error),kind:"icon"});
      }
      persist();
    }
    persist();return {mode:write?"write":"dry-run",results:state.results,cleanup:state.cleanup,publicManifest:manifest};
  };
  return write?locked(root,statePath,run):run();
}
export async function restore(root,plan,store,{write=false,statePath=DEFAULT_STATE}={}) {
  validatePlan(plan);outputPath(statePath);
  const run=async()=>{
    const state=stateFor(root,plan,store,statePath), results=[];
    for(const item of plan.originals){
      try{
        const target=safePath(root,item.source),existing=readOptional(target);
        if(existing&&sha256(existing)!==item.sha256)fail("CONFLICT");
        if(!write){results.push({source:item.source,status:"planned"});continue;}
        const bytes=await store.get(plan.buckets.original,item.path);verify(bytes,item);await decodeOriginal(bytes);
        safePath(root,item.source);const created=createFile(target,bytes);verify(fs.readFileSync(target),item);
        results.push({source:item.source,status:created?"restored":"reused"});
      }catch(error){results.push({source:item.source,status:"failed",code:errorCode(error)});}
      if(write){state.restoreResults=results;writeJson(root,statePath,state);}
    }
    return {mode:write?"write":"dry-run",results};
  };
  return write?locked(root,statePath,run):run();
}
