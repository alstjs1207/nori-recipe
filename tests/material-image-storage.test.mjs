import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import sharp from "sharp";
import {planMigration,validatePublic,TRANSFORM,versionOf} from "../scripts/material-image-storage/manifest.mjs";
import {migrate,restore} from "../scripts/material-image-storage/migration.mjs";
import {directoryStore,supabaseStore} from "../scripts/material-image-storage/stores.mjs";
import {directoryStore as playStore} from "../scripts/play-image-storage/stores.mjs";
import {sha256} from "../scripts/play-image-storage/files.mjs";
import {publicMaterialInput,withWebMaterialManifest} from "../scripts/web/material-images.mjs";
import {verifyPublicImageAssets} from "../scripts/web/public-image-assets.mjs";
import {materialImageUrl} from "../src/constants/materialImageManifest.ts";
import {main} from "../scripts/migrate-material-images.mjs";

function put(root,file,bytes){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),bytes);}
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"material-storage-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const image=await sharp({create:{width:32,height:24,channels:3,background:"#aabbcc"}}).jpeg().toBuffer();
 put(root,"images/material/paper.jpeg",image);put(root,"images/material/orphan.jpeg",image);
 const registry={categories:{test:["paper","pending"]},displayNames:{paper:"종이",pending:"대기"},reviewPending:["pending"]};
 put(root,"data/materials.json",JSON.stringify(registry));put(root,"src/constants/materialImageSources.ts",'export const MATERIAL_IMAGES = {\n  paper: require("../../images/material/paper.jpeg"),\n  pending: require("../../assets/icon.png"),\n};');
 execFileSync("git",["init","-q"],{cwd:root});execFileSync("git",["add","."],{cwd:root});execFileSync("git",["-c","user.name=Fixture","-c","user.email=fixture@example.test","commit","-qm","approved baseline"],{cwd:root});
 const plan=await planMigration(root,{originalBucket:"private-fixture",publicBucket:"material-fixture"});
 fs.mkdirSync(path.join(root,"objects"));const store=directoryStore(path.join(root,"objects"));
 return {root,plan,store,image,registry};
}
test("재료 계획은 기준 승인·미사용/공유 원본을 보존하고 대기 브랜드를 제외한다",async t=>{
 const f=await fixture(t);assert.equal(f.plan.originals.length,2);assert.deepEqual(Object.keys(f.plan.entries),["paper"]);
 assert.match(f.plan.entries.paper.icon.path,/^materials\/paper\/[a-f0-9]{64}\/icon.webp$/);
 f.registry.displayNames.paper="changed";put(f.root,"data/materials.json",JSON.stringify(f.registry));
 await assert.rejects(planMigration(f.root,{originalBucket:"private-fixture",publicBucket:"material-fixture"}),/REVIEW_REQUIRED/);
});
test("dry-run은 키·전송·체크포인트 쓰기 없이 계획하며 경로·옵션을 차단한다",async t=>{
 const f=await fixture(t);const report=await migrate(f.root,f.plan,{identity:"none",get(){throw Error("network");}});
 assert.equal(report.mode,"dry-run");assert.equal(fs.existsSync(path.join(f.root,"generated")),false);
 await assert.rejects(main(["plan","--ids","paper"],{root:f.root}),/INVALID_INPUT/);
 await assert.rejects(f.store.get("material-fixture","play_301/"+"a".repeat(64)+"/detail.webp"),/INVALID_INPUT/);
 await assert.rejects(playStore(path.join(f.root,"objects")).get("material-fixture",f.plan.entries.paper.icon.path),/INVALID_INPUT/);
});
test("부분 실패·재개는 실제 GET 재검증·불변 생성·완전 후보만 활성화한다",async t=>{
 const f=await fixture(t);let fail=true,creates=0;
 const store={...f.store,async create(bucket,file,bytes,type){creates++;if(bucket==="material-fixture"&&fail)throw Error("offline");return f.store.create(bucket,file,bytes,type);}};
 let result=await migrate(f.root,f.plan,store,{write:true});assert.equal(Object.keys(result.publicManifest.entries).length,0);assert.ok(result.results.some(x=>x.status==="failed"));
 fail=false;result=await migrate(f.root,f.plan,store,{write:true});assert.equal(Object.keys(result.publicManifest.entries).length,1);
 const count=creates;await migrate(f.root,f.plan,store,{write:true});assert.equal(creates,count);
 const file=path.join(f.root,"objects/material-fixture",f.plan.entries.paper.icon.path);fs.writeFileSync(file,Buffer.from("corrupt"));
 result=await migrate(f.root,f.plan,store,{write:true});assert.equal(Object.keys(result.publicManifest.entries).length,0);assert.equal(fs.readFileSync(file,"utf8"),"corrupt");assert.ok(result.cleanup.length);
});
test("전송 중 승인 철회는 부분 객체도 정리 후보로 기록하고 원격 삭제하지 않는다",async t=>{
 const f=await fixture(t);const store={...f.store,async create(bucket,file,bytes,type){const result=await f.store.create(bucket,file,bytes,type);if(bucket==="material-fixture"){f.registry.reviewPending.push("paper");put(f.root,"data/materials.json",JSON.stringify(f.registry));}return result;}};
 const result=await migrate(f.root,f.plan,store,{write:true});assert.deepEqual(result.publicManifest.entries,{});assert.ok(result.cleanup.some(x=>x.slug==="paper"));
 assert.ok(fs.existsSync(path.join(f.root,"objects/material-fixture",f.plan.entries.paper.icon.path)));
});
test("복원은 다운로드 JPEG/해시 확인 후 없는 파일만 만들고 충돌/손상을 보존한다",async t=>{
 const f=await fixture(t);await migrate(f.root,f.plan,f.store,{write:true});fs.unlinkSync(path.join(f.root,"images/material/paper.jpeg"));
 let result=await restore(f.root,f.plan,f.store,{write:true});assert.ok(result.results.some(x=>x.status==="restored"));assert.deepEqual(fs.readFileSync(path.join(f.root,"images/material/paper.jpeg")),f.image);
 put(f.root,"images/material/paper.jpeg","local work");result=await restore(f.root,f.plan,f.store,{write:true});assert.ok(result.results.some(x=>x.code==="CONFLICT"));assert.equal(fs.readFileSync(path.join(f.root,"images/material/paper.jpeg"),"utf8"),"local work");
 fs.unlinkSync(path.join(f.root,"images/material/orphan.jpeg"));put(f.root,`objects/private-fixture/${f.plan.originals[0].path}`,"corrupt");result=await restore(f.root,f.plan,f.store,{write:true});assert.ok(result.results.some(x=>x.code==="INTEGRITY"));assert.equal(fs.existsSync(path.join(f.root,"images/material/orphan.jpeg")),false);
});
test("원본 없는 공개 입력은 정의·매핑/바이트·필수 항목·192px WebP를 검사한다",async t=>{
 const f=await fixture(t);const report=await migrate(f.root,f.plan,f.store,{write:true});const e=f.plan.entries.paper;
 put(f.root,"src/constants/materialImageSourceHashes.json",JSON.stringify({paper:{sourceHash:e.sourceHash,mappingHash:sha256(e.source)}}));
 put(f.root,"public.json",JSON.stringify({...report.publicManifest,adminSecret:"must-be-stripped"}));fs.rmSync(path.join(f.root,"images"),{recursive:true});
 const env={MATERIAL_IMAGE_PUBLIC_MANIFEST:path.join(f.root,"public.json"),MATERIAL_IMAGE_PUBLIC_ORIGIN:"https://storage.fixture.invalid",MATERIAL_IMAGE_PUBLIC_BUCKET:"material-fixture",MATERIAL_IMAGE_PUBLIC_ASSET_DIR:path.join(f.root,"objects")};
 const input=publicMaterialInput({root:f.root,env});assert.equal((await verifyPublicImageAssets(input)).verifiedPublicAssets,1);assert.equal(materialImageUrl(input.manifest,"pending"),"/nori-icon.svg");
 assert.equal(materialImageUrl(input.manifest,"paper"),input.assets[0].url);assert.ok(!JSON.stringify(input).includes("must-be-stripped"));
 put(f.root,`objects/material-fixture/${e.icon.path}`,Buffer.alloc(e.icon.bytes));await assert.rejects(verifyPublicImageAssets(input),/integrity/);
 f.registry.displayNames.paper="changed";put(f.root,"data/materials.json",JSON.stringify(f.registry));assert.throws(()=>publicMaterialInput({root:f.root,env}),/stale/);
});
test("공개 경로·version·private 필드를 검증하고 snapshot은 실패에도 복원한다",async t=>{
 const f=await fixture(t);const result=await migrate(f.root,f.plan,f.store,{write:true});
 const forged=structuredClone(result.publicManifest);forged.entries.paper.icon.path="../private/original.jpeg";assert.throws(()=>validatePublic(forged,"material-fixture"));
 const entry={...result.publicManifest.entries.paper,original:"private",signedUrl:"secret"};const clean=validatePublic({...result.publicManifest,entries:{paper:entry}},"material-fixture");assert.ok(!JSON.stringify(clean).includes("secret"));
 put(f.root,"src/constants/materialImageWebManifest.json","original snapshot");await assert.rejects(withWebMaterialManifest(f.root,{entries:{}},()=>{throw Error("export failed");}),/export failed/);assert.equal(fs.readFileSync(path.join(f.root,"src/constants/materialImageWebManifest.json"),"utf8"),"original snapshot");
});
test("재료 HTTP 어댑터는 익명 쓰기 대신 로컬 키·no-upsert·제한된 경로를 쓴다",async()=>{
 const calls=[];const bytes=Buffer.from("image");
 const store=supabaseStore({url:"https://storage.fixture.invalid",serviceRoleKey:"fixture-secret",fetchImpl:async(url,options)=>{calls.push({url,options});return options.method?new Response("ok"):new Response(bytes);}});
 const file=`materials/paper/${"a".repeat(64)}/icon.webp`;await store.create("material-fixture",file,bytes,"image/webp");assert.equal(calls[0].options.headers["x-upsert"],"false");assert.equal(calls[0].options.redirect,"error");assert.deepEqual(await store.get("material-fixture",file),bytes);
 await assert.rejects(store.create("material-fixture","materials/../original.jpeg",bytes,"image/jpeg"),/INVALID_INPUT/);
});
