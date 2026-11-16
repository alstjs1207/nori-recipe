import fs from "node:fs";
import { materialDefinitionHash } from "../review/material-images.mjs";
import { approvedSlugs, materialInputs, validatePublic } from "../material-image-storage/manifest.mjs";
import { locked, safePath, sha256 } from "../play-image-storage/files.mjs";
import { storageImages } from "../../src/constants/playImageManifest.ts";

export function publicMaterialInput({root,env=process.env}) {
  const file=env.MATERIAL_IMAGE_PUBLIC_MANIFEST, origin=env.MATERIAL_IMAGE_PUBLIC_ORIGIN, bucket=env.MATERIAL_IMAGE_PUBLIC_BUCKET;
  if(!file&&!origin&&!bucket&&!env.MATERIAL_IMAGE_PUBLIC_ASSET_DIR)return null;
  if(!file||!origin||!bucket)throw new Error("Material public manifest, origin and bucket must be configured together");
  const storage=storageImages({origin,bucket});
  const candidate=validatePublic(JSON.parse(fs.readFileSync(file,"utf8")),bucket);
  const input=materialInputs(root), hashes=JSON.parse(fs.readFileSync(safePath(root,"src/constants/materialImageSourceHashes.json"),"utf8"));
  const entries={}, assets=[];
  for(const slug of approvedSlugs(input)) {
    const entry=candidate.entries[slug], source=hashes[slug];
    if(!entry)throw new Error(`${slug}: missing required public material image`);
    if(entry.contentHash!==materialDefinitionHash(input.registry,slug)||entry.sourceHash!==source?.sourceHash||sha256(input.map[slug])!==source?.mappingHash)throw new Error(`${slug}: stale public material image`);
    const icon=`${storage.origin}/storage/v1/object/public/${bucket}/${entry.icon.path}`;
    entries[slug]={version:entry.version,icon};assets.push({id:slug,kind:"icon",bucket,...entry.icon,url:icon});
  }
  return {manifest:{schemaVersion:1,storage,entries},assets,directory:env.MATERIAL_IMAGE_PUBLIC_ASSET_DIR||null};
}
export async function withWebMaterialManifest(root,manifest,action) {
  return locked(root,"generated/material-image-storage/web-build",async()=>{
    const file=safePath(root,"src/constants/materialImageWebManifest.json"), original=fs.readFileSync(file);
    try{fs.writeFileSync(file,JSON.stringify(manifest));return await action();}
    finally{fs.writeFileSync(file,original);}
  });
}
