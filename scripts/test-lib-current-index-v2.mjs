import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentIndex, indexEntries } from './lib-current-index-v2.mjs';
import { sha } from './lib-refresh-cache-v2.mjs';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'current-search-index-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'libspec'));
  const registry={schema:'wasmc.lib-refresh-registry/v2',libs:[]};
  const sources={};
  const policy={schema:'wasmc.lib-refresh-rust-policy/v2',target:'wasm32-unknown-unknown'};
  for(const id of ['android-display','ios-display']) {
    const path='libspec/'+id;await mkdir(join(root,path));registry.libs.push({id,source:path});
    const spec={schema:'wasmc.lib-refresh-source/v2',id,version:'0.0.1',profile:'native',description:'display',
      native:{target:id.startsWith('ios')?'ios':'android',kind:'swift-embedded'},apis:[{api:'read',delta:'read pixels'}]};
    const files={'lib.json':JSON.stringify(spec),'lib.wit':'package example:display@0.0.1; interface screen { read: func()->u32; } world app {export screen;}','platform.swift':'// fixture source'};
    for(const [f,b]of Object.entries(files)){await writeFile(join(root,path,f),b);sources[path+'/'+f]=sha(Buffer.from(b));}
  }
  await writeFile(join(root,'libspec/registry.json'),JSON.stringify(registry));
  await writeFile(join(root,'libspec/rust-policy.json'),JSON.stringify(policy));
  await writeFile(join(root,'libspec/Cargo.lock'),'fixture-lock');
  sources['libspec/rust-policy.json']=sha(Buffer.from(JSON.stringify(policy)));
  return {root,registry,sources};
}
async function boundFixture(t) {
  const f=await fixture(t),id='ios-display',run=join(f.root,'run'),pkg=join(run,'packages',id);await mkdir(pkg,{recursive:true});
  const desc=[];
  for(const path of ['lib.wit','platform.swift']){const b=await readFile(join(f.root,'libspec',id,path));await writeFile(join(pkg,path),b);desc.push({path,bytes:b.length,sha256:sha(b)});}
  const manifest={schema:'wasmc.lib-native/v2',id,version:'0.0.1',profile:'native',wit:desc[0],implementation:[desc[1]],
    artifact:null,native:{wasm_lowered:false},lifecycle:{runtime_qualified:false,admitted:false}};
  const bytes=Buffer.from(JSON.stringify(manifest));await writeFile(join(pkg,'lib.json'),bytes);
  const receipt={schema:'wasmc.lib-refresh-receipt/v2',accepted:true,producer:{sha256:'a'.repeat(64)},cargo_lock_sha256:sha(Buffer.from('fixture-lock')),
    source_digests:f.sources,rows:[{id,profile:'native',version:'0.0.1',package_root:pkg,manifest_sha256:sha(bytes),artifact_sha256:null}]};
  const rbytes=Buffer.from(JSON.stringify(receipt));await writeFile(join(run,'refresh-receipt.json'),rbytes);
  return {...f,run,pkg,receipt,bindings:[{run_root:run,receipt_sha256:sha(rbytes)}]};
}
test('source-only index is deterministic and preserves same-WIT implementations',async t=>{const f=await fixture(t);const a=await currentIndex(f.root),b=await currentIndex(f.root);assert.deepEqual(a.bytes,b.bytes);assert.equal(a.summary.packages,2);assert.equal(a.summary.apis,2);assert.equal(a.summary.bound_packages,0);});
test('registry order does not alter entry order',async t=>{const f=await fixture(t);const a=await currentIndex(f.root);f.registry.libs.reverse();await writeFile(join(f.root,'libspec/registry.json'),JSON.stringify(f.registry));assert.deepEqual(indexEntries((await currentIndex(f.root)).index),indexEntries(a.index));});
test('new current WIT changes the index, not a frozen catalog',async t=>{const f=await fixture(t);const before=await currentIndex(f.root);const p=join(f.root,'libspec/ios-display/lib.wit');await writeFile(p,(await readFile(p,'utf8')).replace('read:','extra: func()->u32; read:'));const after=await currentIndex(f.root);assert.equal(after.summary.apis,3);assert.notEqual(after.summary.index_sha256,before.summary.index_sha256);});
test('duplicate IDs reject',async t=>{const f=await fixture(t);f.registry.libs.push(f.registry.libs[0]);await writeFile(join(f.root,'libspec/registry.json'),JSON.stringify(f.registry));await assert.rejects(()=>currentIndex(f.root),/duplicate/);});
test('normalized wire does not duplicate package metadata per API',async t=>{const f=await fixture(t);const out=await currentIndex(f.root);assert.equal(out.index.entries,undefined);assert.equal(out.index.packages.length,2);assert.equal(indexEntries(out.index).length,4);assert.equal(indexEntries(out.index)[1].wit_route,'example:display@0.0.1/screen#read');});
test('inline export rejects rather than silently loses API',async t=>{const f=await fixture(t);await writeFile(join(f.root,'libspec/ios-display/lib.wit'),'package example:display@0.0.1;world app {export run:func();}');await assert.rejects(()=>currentIndex(f.root),/inline/);});
test('bound native source stays source-only, never a WASM artifact',async t=>{const f=await boundFixture(t);const out=await currentIndex(f.root,f.bindings);assert.equal(out.summary.bound_packages,1);assert.equal(out.summary.native_source_packages,1);const e=indexEntries(out.index).find(e=>e.package_id==='ios-display');assert.equal(e.delivery.artifact_kind,'native-source');assert.equal(e.delivery.artifact_sha256,null);});
test('wrong independent receipt pin rejects',async t=>{const f=await boundFixture(t);await assert.rejects(()=>currentIndex(f.root,[{...f.bindings[0],receipt_sha256:'0'.repeat(64)}]),/pin/);});
test('mutated package rejects even when source is unchanged',async t=>{const f=await boundFixture(t);await writeFile(join(f.pkg,'platform.swift'),'modified');await assert.rejects(()=>currentIndex(f.root,f.bindings),/digest/);});
test('stale source rejects even if old package remains valid',async t=>{const f=await boundFixture(t);await writeFile(join(f.root,'libspec/ios-display/platform.swift'),'new source');await assert.rejects(()=>currentIndex(f.root,f.bindings),/stale source/);});
test('stale lock rejects',async t=>{const f=await boundFixture(t);await writeFile(join(f.root,'libspec/Cargo.lock'),'new-lock');await assert.rejects(()=>currentIndex(f.root,f.bindings),/stale shared lock/);});
test('two bindings for the same implementation reject',async t=>{const f=await boundFixture(t);await assert.rejects(()=>currentIndex(f.root,[...f.bindings,...f.bindings]),/ambiguous/);});
