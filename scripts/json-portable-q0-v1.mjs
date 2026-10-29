import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha, digest, verifyRoot, inside } from './lib-refresh-cache-v2.mjs';
import { verifyReleaseLicenseReceipt } from './lib-refresh-license-receipt-v1.mjs';
import { validateUpstreamSourceContract } from './lib-refresh-upstream-source-v2.mjs';
import { currentIndex } from './lib-current-index-v2.mjs';
import { verifyWitClosure } from './lib-wit-closure-v2.mjs';

// Receipt locators remain immutable historical data. External inputs are
// addressed by their recorded hashes so verification does not require those paths.
const pin=/^[0-9a-f]{64}$/;
async function put(path,data){await mkdir(dirname(path),{recursive:true});await writeFile(path,data,{flag:'wx'});}
export async function capture({source,run,receiptSha,producer,out}){
  for(const p of [source,run,producer,out])assert.ok(isAbsolute(p));assert.match(receiptSha,pin);
  const rb=await readFile(join(run,'refresh-receipt.json'));assert.equal(sha(rb),receiptSha);const r=JSON.parse(rb);
  assert.equal(r.accepted,true);assert.deepEqual(r.rows.map(x=>x.id),['wasmc-json']);
  await mkdir(out);await put(join(out,'receipt.json'),rb);
  for(const [path,expected] of Object.entries(r.source_digests)){
    assert.match(expected,pin);const b=await readFile(inside(source,path));assert.equal(sha(b),expected);await put(inside(join(out,'source'),path),b);
  }
  const captured=new Set();
  for(const [path,expected] of Object.entries(r.producer_input_digests)){
    assert.ok(isAbsolute(path));assert.match(expected,pin);const b=await readFile(path);assert.equal(sha(b),expected);
    if(!captured.has(expected)){await put(join(out,'external',expected),b);captured.add(expected);}
  }
  const pb=await readFile(producer);assert.equal(sha(pb),r.producer.sha256);await put(join(out,'producer'),pb);
  assert.ok(['0.2.2','0.2.3'].includes(r.rows[0].version),'unsupported JSON successor');
  const original=join(run,'packages/wasmc-json'),verified=await verifyRoot(original,'wasmc-json',r.rows[0].version,'value');
  assert.equal(digest(verified.files),r.rows[0].root_inventory_sha256);
  for(const path of Object.keys(verified.files)){const target=inside(join(out,'root'),path);await mkdir(dirname(target),{recursive:true});await copyFile(inside(original,path),target);}
}
export async function verify({capsule,receiptSha,witPath,witSha}){
  for(const p of [capsule,witPath])assert.ok(isAbsolute(p));for(const p of [receiptSha,witSha])assert.match(p,pin);
  const rb=await readFile(join(capsule,'receipt.json'));assert.equal(sha(rb),receiptSha);const r=JSON.parse(rb);
  assert.equal(r.schema,'wasmc.lib-refresh-receipt/v2');assert.equal(r.accepted,true);
  assert.deepEqual(r.rows.map(x=>x.id),['wasmc-json']);const row=r.rows[0];assert.ok(['0.2.2','0.2.3'].includes(row.version),'unsupported JSON successor');assert.equal(row.profile,'value');
  assert.equal(r.resource_core_input_manifest,null);assert.deepEqual(r.resource_core_inputs,{});
  const src=join(capsule,'source');
  for(const [path,expected] of Object.entries(r.source_digests)){assert.match(expected,pin);assert.equal(sha(await readFile(inside(src,path))),expected,'source '+path);}
  assert.equal(sha(await readFile(join(src,'libspec/Cargo.lock'))),r.cargo_lock_sha256);
  assert.equal(sha(await readFile(join(capsule,'producer'))),r.producer.sha256);
  const external=async path=>{const expected=r.producer_input_digests[path];assert.match(expected??'',pin,'undeclared external input');const b=await readFile(join(capsule,'external',expected));assert.equal(sha(b),expected);return b;};
  for(const path of Object.keys(r.producer_input_digests))await external(path);
  await verifyReleaseLicenseReceipt(src,r,external);
  const policy=JSON.parse(await readFile(join(src,'libspec/rust-policy.json'))), loc=r.upstream_source_input_manifest;
  const upstream=JSON.parse(await external(loc.path));assert.equal(sha(await external(loc.path)),loc.sha256);
  assert.equal(upstream.schema,'wasmc.lib-refresh-upstream-source-inputs/v1');assert.equal(upstream.producer_sha256,r.producer.sha256);
  const wanted=Object.entries(policy.shared_modules??{}).filter(([,x])=>x.upstream_source).map(([id])=>id).sort();
  assert.deepEqual(upstream.modules.map(x=>x.id).sort(),wanted);assert.equal(new Set(wanted).size,wanted.length);
  const identities={};
  for(const entry of upstream.modules){
    const info=policy.shared_modules[entry.id],contract=validateUpstreamSourceContract(info);assert.deepEqual(entry.upstream,contract);
    assert.equal(entry.source,contract.source_path);const bytes=await external(join(entry.root,entry.source));
    assert.equal(sha(bytes),contract.sha256);assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),contract.git_blob);
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);for(const token of ['wit_bindgen','export!(','core_abi','wasmtime','wasmi','Store<','Linker<'])assert.ok(!text.includes(token));
    identities[entry.id]={manifest_sha256:loc.sha256,producer_sha256:r.producer.sha256,module:info.module,upstream:contract,bytes:bytes.length,sha256:sha(bytes)};
  }
  assert.deepEqual(r.upstream_source_inputs,identities);
  const spec=JSON.parse(await readFile(join(src,'libspec/wasmc-json/lib.json')));
  assert.deepEqual(row.upstream_source_inputs,Object.fromEntries((spec.shared_modules ?? []).filter(id=>identities[id]).map(id=>[id,identities[id]])));
  const root=await verifyRoot(join(capsule,'root'),row.id,row.version,row.profile);
  assert.equal(root.manifest_sha256,row.manifest_sha256);assert.equal(digest(root.files),row.root_inventory_sha256);
  assert.equal(root.manifest.artifact.sha256,row.artifact_sha256);assert.equal(root.manifest.component.sha256,row.component_sha256);
  const license=await external(r.release_license_input.path);assert.deepEqual(await readFile(join(capsule,'root/LICENSE')),license);
  const notices=JSON.parse(await external(r.release_notices_input.path));
  for(const notice of notices.files){const b=await readFile(inside(join(capsule,'root'),notice.path));assert.equal(b.length,notice.bytes);assert.equal(sha(b),notice.sha256);}
  const wit=await readFile(join(src,'libspec/wasmc-json/lib.wit')),delivered=await readFile(join(capsule,'root/lib.wit'));
  assert.deepEqual(spec.wit_dependencies??[],[]);const normalized=await verifyWitClosure(wit,[],delivered,{path:witPath,sha256:witSha});
  const index=await currentIndex(src,[]);
  const sourcePrefixes=index.index.packages.map(p=>'libspec/'+p.package_id+'/');
  const receiptPackageInputs=Object.keys(r.source_digests).filter(p=>sourcePrefixes.some(prefix=>p.startsWith(prefix))).sort();
  assert.deepEqual(Object.keys(index.inputs).sort(),receiptPackageInputs,'complete package source inventory');
  const item=index.index.packages.find(p=>p.package_id===row.id);assert.equal(item.version,row.version);assert.equal(item.delivery,null);
  return {schema:'wasmc.portable-json-q0-verification/v1',accepted:true,receipt_sha256:receiptSha,source_inputs:Object.keys(r.source_digests).length,external_inputs:Object.keys(r.producer_input_digests).length,root_files:Object.keys(root.files).length,root_inventory_sha256:row.root_inventory_sha256,producer_sha256:r.producer.sha256,wit_mode:normalized.mode,source_index_sha256:index.summary.index_sha256,scope:'portable JSON single-root Q0 input and Root checks; no original build replay, full mixed product, CI, production route, or release',public_admission:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,...a]=process.argv.slice(2);
 if(mode==='capture'){const [source,run,receiptSha,producer,out]=a;await capture({source,run,receiptSha,producer,out});console.log('capture complete');}
 else if(mode==='verify'){const [capsule,receiptSha,witPath,witSha]=a;console.log(JSON.stringify(await verify({capsule,receiptSha,witPath,witSha})));}
 else throw Error('expected capture or verify');
}
