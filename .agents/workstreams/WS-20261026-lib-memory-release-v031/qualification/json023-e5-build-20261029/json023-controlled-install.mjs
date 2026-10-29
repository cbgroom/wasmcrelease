import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inventory,sha,digest} from '/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/scripts/lib-refresh-cache-v2.mjs';
import {resolveCurrentPackage} from '/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/scripts/current-lib-release-v3.mjs';
import {installCurrentLib} from '/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/scripts/lib-install.mjs';
const state='/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028',root=state+'/json023-root2024-licensed-e5',source='/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/libspec/wasmc-json';
const old=JSON.parse(await readFile(state+'/json-v031-overlay-public-20261029/catalog/libs-current-v2.json')),manifest=JSON.parse(await readFile(root+'/lib.json')),files=await inventory(root),oldRow=old.packages.find(x=>x.id==='wasmc-json'),prefix='current-libs/wasmc-json/0.2.3';
const pin=async name=>{const b=await readFile(join(source,name));return {path:'libspec/wasmc-json/'+name,bytes:b.length,sha256:sha(b)}};
const row={...oldRow,version:'0.2.3',root:prefix,manifest_sha256:files['lib.json'].sha256,root_inventory_sha256:digest(files),wit_sha256:files['lib.wit'].sha256,source:{spec:await pin('lib.json'),wit:await pin('lib.wit')},views:Object.keys(manifest.bindings).sort(),delivery:{kind:'wasm-core-component',artifact:{path:manifest.artifact.path,bytes:manifest.artifact.bytes,sha256:manifest.artifact.sha256},component:{path:manifest.component.path,bytes:manifest.component.bytes,sha256:manifest.component.sha256},native_status:null,device_qualified:false},files:Object.entries(files).map(([path,p])=>({path:prefix+'/'+path,...p})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)};
const catalog={...old,package_authority_commit:'0'.repeat(40),packages:[row]},bytes=Buffer.from(JSON.stringify(catalog)),catalogSha=sha(bytes),read=p=>{assert.ok(p.startsWith(prefix+'/'));return Buffer.from(requireFile(p.slice(prefix.length+1)));};
function requireFile(rel){return requireRead(join(root,rel));}
import {readFileSync as requireRead} from 'node:fs';
const lock=resolveCurrentPackage(bytes,catalogSha,row,read),lockBytes=Buffer.from(JSON.stringify(lock));const mirror='https://raw.githubusercontent.com/cbgroom/wasmcrelease/'+catalog.package_authority_commit+'/';
const fetcher=async url=>{assert.ok(url.startsWith(mirror));return new Response(read(url.slice(mirror.length).split('/').map(decodeURIComponent).join('/')),{status:200});};
const destination=state+'/json023-controlled-install',receipt=await installCurrentLib({catalogBytes:bytes,catalogSha256:catalogSha,lockBytes,lockSha256:sha(lockBytes),destination,mirror:'github'},fetcher);
for(const f of row.files){const b=await readFile(join(destination,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
await writeFile(state+'/json023-controlled-catalog.json',bytes,{flag:'wx'});await writeFile(state+'/json023-controlled-lock.json',lockBytes,{flag:'wx'});
console.log(JSON.stringify({status:'PASS_SCOPED',catalog_sha256:catalogSha,manifest_sha256:row.manifest_sha256,inventory_sha256:row.root_inventory_sha256,files:receipt.files_verified,destination,transport:'controlled in-memory bytes',formal_release:false}));
