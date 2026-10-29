import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentProductPaths,currentProductReader } from './current-lib-release-v3.mjs';
import { verifyMixedFromCatalog,verifyMixedArtifactAuthority } from './mixed-current-product-v1.mjs';
import { generatedLib } from './generated-lib-v2.mjs';
import { currentIndex } from './lib-current-index-v2.mjs';
import { projectResidentIndex } from './project-resident-search-index-v1.mjs';
import { sha, digest } from './lib-refresh-cache-v2.mjs';

// Check every selected Root against one commit and replay its original evidence.
// This preflight does not manufacture a mixed-cohort release or authorize publication.
export async function verifyResidentCombined({oldRoot,oldSha,source,run,receiptSha,authorityRepo,commit,witPath,witSha,out}) {
  for(const p of [oldRoot,source,run,authorityRepo,witPath,out])assert.ok(isAbsolute(p));
  for(const p of [oldSha,receiptSha,witSha])assert.match(p,/^[0-9a-f]{64}$/);
  assert.match(commit,/^[0-9a-f]{40}$/);
  const read=currentProductReader(oldRoot), oldBytes=read('catalog/libs-current-v2.json');
  const oldClosure=verifyMixedFromCatalog(oldBytes,oldSha,read,currentProductPaths(oldRoot));
  const old=JSON.parse(oldBytes), previous=old.packages.find(p=>p.id==='mcpgit-resident-memory');assert.ok(previous);
  const rbytes=await readFile(join(run,'refresh-receipt.json'));assert.equal(sha(rbytes),receiptSha);
  const receipt=JSON.parse(rbytes);assert.deepEqual(receipt.rows.map(x=>x.id),['mcpgit-resident-memory']);
  const root=await generatedLib('mcpgit-resident-memory',run), manifest=root.manifest, row=root.row;
  assert.equal(root.receipt_sha256,receiptSha);assert.equal(row.version,'0.2.1');
  assert.equal(digest(root.files),row.root_inventory_sha256,'resident Root inventory');
  const prefix='current-libs/mcpgit-resident-memory/0.2.1', src={};
  for(const [key,name] of [['spec','lib.json'],['wit','lib.wit']]){
    const path='libspec/mcpgit-resident-memory/'+name,b=await readFile(join(source,path));assert.equal(sha(b),receipt.source_digests[path]);src[key]={path,bytes:b.length,sha256:sha(b)};
  }
  const copy=x=>({path:x.path,bytes:x.bytes,sha256:x.sha256});
  const resident={...previous,version:row.version,root:prefix,manifest_sha256:row.manifest_sha256,
    root_inventory_sha256:row.root_inventory_sha256,wit_sha256:manifest.wit.sha256,source:src,views:Object.keys(manifest.bindings).sort(),
    delivery:{kind:'wasm-core-component',artifact:copy(manifest.artifact),component:copy(manifest.component),native_status:null,device_qualified:false},
    files:Object.entries(root.files).map(([path,pin])=>({path:prefix+'/'+path,...pin}))};
  const packages=old.packages.map(p=>p.id===resident.id?resident:p);
  const fresh=await currentIndex(source,[{run_root:run,receipt_sha256:receiptSha}],{path:witPath,sha256:witSha});
  const projection=projectResidentIndex(JSON.parse(read(old.index.path)),fresh.index,receiptSha);
  assert.equal(projection.reused,packages.length-1);
  // Authority source and delivery bytes are read directly from their verified inputs.
  const newRead=path=>{if(path.startsWith(prefix+'/'))return readFileSyncCompat(join(root.root,path.slice(prefix.length+1)));
    return readFileSyncCompat(join(source,path));};
  const reused=packages.filter(p=>p.id!==resident.id).map(p=>({id:p.id}));
  const authority=verifyMixedArtifactAuthority(authorityRepo,commit,packages,old.registry,read,newRead,reused);
  // Validate all Q0 source inputs against Git blobs, not only catalog WIT/spec.
  const tree=execFileSync('git',['ls-tree','-r','-z',commit],{cwd:authorityRepo,maxBuffer:100*1024*1024}).toString().split('\0').filter(Boolean);
  const blobs=new Map(tree.map(line=>{const m=/^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(line);assert.ok(m);return [m[3],m[2]];}));
  for(const [path,pin] of Object.entries(receipt.source_digests)){
    const b=await readFile(join(source,path));assert.equal(sha(b),pin,'receipt source: '+path);
    const gitSha=createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');assert.equal(blobs.get(path),gitSha,'authority source: '+path);
  }
  const indexBytes=Buffer.from(JSON.stringify(projection.index)+'\n');
  const result={schema:'wasmc.resident-combined-authority-preflight/v1',accepted:true,old_catalog_sha256:oldSha,
    old_closure:oldClosure.schema,new_receipt_sha256:receiptSha,authority_commit:commit,authority_files:authority.files,
    q0_source_inputs:Object.keys(receipt.source_digests).length,packages:packages.length,resident_files:resident.files.length,
    resident_manifest_sha256:resident.manifest_sha256,resident_inventory_sha256:resident.root_inventory_sha256,
    projected_index_sha256:sha(indexBytes),source_index_wit_normalizations:fresh.wit_normalizations.length,
    scope:'local preflight only; no portable combined proof graph, remote catalog admission, production route, CI, or formal release',public_admission:false};
  await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
import { readFileSync as readFileSyncCompat } from 'node:fs';
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [oldRoot,oldSha,source,run,receiptSha,authorityRepo,commit,witPath,witSha,out]=process.argv.slice(2);
 verifyResidentCombined({oldRoot,oldSha,source,run,receiptSha,authorityRepo,commit,witPath,witSha,out}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
}
