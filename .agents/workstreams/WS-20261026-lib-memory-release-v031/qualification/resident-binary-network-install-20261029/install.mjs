// Exact candidate network install with a scoped synthetic selection catalog.
// This catalog is not a complete release or Search/admission authority.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {installCurrentLib} from '../../../../../scripts/lib-install.mjs';
import {resolveCurrentPackage} from '../../../../../scripts/current-lib-release-v3.mjs';
import {inventory,digest} from '../../../../../scripts/lib-refresh-cache-v2.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const state='/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028';
const product=join(state,'resident-binary-refresh-output-3-20261029/runs/refresh-oOABfT');
const receiptBytes=await readFile(join(product,'refresh-receipt.json'));
assert.equal(sha(receiptBytes),'f7020cf17a1d337f45b220fbefdf81db2e85b9c264705d31742a241f0f2a7de8');
const receipt=JSON.parse(receiptBytes),original=receipt.rows.find(x=>x.id==='mcpgit-resident-memory');assert.equal(original.version,'0.2.1');
const root=join(product,'packages/mcpgit-resident-memory'),files=await inventory(root);
assert.equal(digest(files),original.root_inventory_sha256);
const manifestBytes=await readFile(join(root,'lib.json')),manifest=JSON.parse(manifestBytes);
assert.equal(sha(manifestBytes),original.manifest_sha256);
const commit='842fb3a5397b7993c1f89e94265db335723ee1b3',prefix='current-libs/mcpgit-resident-memory/0.2.1';
const source={};
for(const [key,name] of [['spec','lib.json'],['wit','lib.wit']]){
 const path='libspec/mcpgit-resident-memory/'+name;
 const bytes=execFileSync('git',['show',commit+':'+path]);
 assert.equal(sha(bytes),receipt.source_digests[path],'candidate source pin');source[key]={path,bytes:bytes.length,sha256:sha(bytes)};
}
const old=JSON.parse(await readFile(join(state,'mixed-product-real-authority-20261029/catalog/libs-current-v2.json')));
const previous=old.packages.find(x=>x.id==='mcpgit-resident-memory');
const copy=x=>({path:x.path,bytes:x.bytes,sha256:x.sha256});
const row={...previous,version:'0.2.1',root:prefix,manifest_sha256:original.manifest_sha256,
 root_inventory_sha256:original.root_inventory_sha256,wit_sha256:manifest.wit.sha256,source,
 views:Object.keys(manifest.bindings).sort(),delivery:{kind:'wasm-core-component',artifact:copy(manifest.artifact),component:copy(manifest.component),native_status:null,device_qualified:false},
 files:Object.entries(files).map(([path,pin])=>({path:prefix+'/'+path,...pin}))};
const catalog={...old,package_authority_commit:commit,packages:[row]};
const catalogBytes=Buffer.from(JSON.stringify(catalog)),catalogSha=sha(catalogBytes);
const lock=resolveCurrentPackage(catalogBytes,catalogSha,row,path=>{assert(path.startsWith(prefix+'/'));return requireRead(path.slice(prefix.length+1));});
function requireRead(path){return execFileSync('git',['show',commit+':'+prefix+'/'+path]);}
const lockBytes=Buffer.from(JSON.stringify(lock)),base=join(state,'resident-binary-network-install-20261029');await mkdir(base);
await writeFile(join(base,'selection-catalog.json'),catalogBytes,{flag:'wx'});await writeFile(join(base,'selection-lock.json'),lockBytes,{flag:'wx'});
const dest=join(base,'installed'),result=await installCurrentLib({catalogBytes,catalogSha256:catalogSha,lockBytes,lockSha256:sha(lockBytes),destination:dest,mirror:'github'});
for(const f of row.files){const b=await readFile(join(dest,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
assert.equal(result.files_verified,row.files.length);
const report={schema:'wasmc.resident-network-install-witness/v1',accepted:true,candidate_commit:commit,catalog_sha256:catalogSha,lock_sha256:sha(lockBytes),manifest_sha256:row.manifest_sha256,root_inventory_sha256:row.root_inventory_sha256,files:row.files.length,destination:dest,scope:'actual anonymous GitHub transport and installer with one-package synthetic selection catalog; not complete release catalog, Search, source admission or formal release'};
await writeFile(join(base,'witness.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
