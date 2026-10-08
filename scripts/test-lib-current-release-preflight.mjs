// These are gate fixtures, not real compiler/Lib qualification evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { identityCoverage } from './validate-lib-identity-coverage.mjs';
import { retiredAuthoringDirectory, validateCurrentOnlySources } from './validate-current-only-libs.mjs';
import { currentReleasePreflight, currentReleaseArguments } from './lib-current-release-preflight.mjs';
import { sha, digest, inventory } from './lib-refresh-cache-v2.mjs';

const gen = ['lib-refresh-v2.mjs','lib-refresh-runner-v2.mjs','lib-refresh-cache-v2.mjs','lib-refresh-native-v2.mjs','lib-refresh-resource-core-v2.mjs','lib-refresh-upstream-source-v2.mjs'];
const put = async (root, path, value) => {
  const file = join(root, path); await mkdir(dirname(file), {recursive:true});
  await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value));
};
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'current-release-gate-'));
  t.after(() => rm(root, {recursive:true,force:true}));
  const ids = ['android-display','ios-display'];
  const authorities = {historical_package_identities:'catalog/libs-v018.json',
    retired_candidate_identities:'.agents/workstreams/WS-20261006-lib-refresh-v2/legacy-retirement.json',
    current_sources:'libspec/registry.json'};
  const disposition = {schema:'wasmc.current-lib-identity-dispositions/v1',inventory_authorities:authorities,
    pending:[],retired_capabilities:[]};
  const registry = {schema:'wasmc.lib-refresh-registry/v2',libs:ids.map(id=>({id,source:'libspec/'+id}))};
  await put(root, 'libspec/identity-dispositions.json', disposition);
  await put(root, authorities.historical_package_identities, {packages:[{id:ids[0]}]});
  await put(root, authorities.retired_candidate_identities, {original_candidates:ids});
  await put(root, authorities.current_sources, registry);
  await put(root, 'libspec/rust-policy.json', {schema:'wasmc.lib-refresh-rust-policy/v2',target:'wasm32-unknown-unknown'});
  await put(root, 'libspec/Cargo.lock', 'fixture-lock');
  const source = {}, generator = {}, rows = [], run = join(root, 'run');
  for (const file of gen) {
    await put(root, 'scripts/'+file, '// gate fixture '+file);
    generator[file] = sha(await readFile(join(root, 'scripts', file)));
  }
  for (const id of ids) {
    const base = 'libspec/'+id;
    const files = {'lib.json':JSON.stringify({schema:'wasmc.lib-refresh-source/v2',id,version:'0.0.1',
      profile:'native',description:'display',native:{target:id.split('-')[0],kind:'swift-embedded',files:['platform.swift']},
      apis:[{api:'read',delta:'read pixels'}]}),
      'lib.wit':'package example:display@0.0.1; interface screen {read: func()->u32;} world app {export screen;}',
      'platform.swift':'// native source fixture'};
    for (const [file, bytes] of Object.entries(files)) {
      await put(root,base+'/'+file,bytes);source[base+'/'+file]=sha(Buffer.from(bytes));
    }
    const pkg = join(run,'packages',id), descriptors=[];
    for (const file of ['lib.wit','platform.swift']) {
      await put(pkg,file,files[file]);descriptors.push({path:file,bytes:Buffer.byteLength(files[file]),sha256:sha(Buffer.from(files[file]))});
    }
    const manifest = {schema:'wasmc.lib-native/v2',id,version:'0.0.1',profile:'native',wit:descriptors[0],
      implementation:[descriptors[1]],artifact:null,bindings:{},native:{wasm_lowered:false,status:'source-only'},
      lifecycle:{runtime_qualified:false,admitted:false}};
    await put(pkg,'lib.json',manifest);
    rows.push({id,version:'0.0.1',profile:'native',state:'verified',package_root:pkg,
      manifest_sha256:sha(await readFile(join(pkg,'lib.json'))),artifact_sha256:null,
      root_inventory_sha256:digest(await inventory(pkg))});
  }
  for (const path of ['libspec/registry.json','libspec/rust-policy.json']) source[path]=sha(await readFile(join(root,path)));
  const receipt = {schema:'wasmc.lib-refresh-receipt/v2',accepted:true,run_root:run,
    selected:ids,rows,producer:{sha256:'a'.repeat(64)},generator_digests:generator,
    cargo_lock_sha256:sha(Buffer.from('fixture-lock')),source_digests:source};
  const f = {root,run,registry,disposition,receipt,authorities};
  f.seal = async () => {
    await put(run,'refresh-receipt.json',receipt);
    f.options = {run_root:run,receipt_sha256:sha(await readFile(join(run,'refresh-receipt.json'))),producer_sha256:'a'.repeat(64)};
  };
  await f.seal();return f;
}
const assess = f => currentReleasePreflight(f.root, f.options);
const has = (r,id) => r.blockers.some(b=>b.id===id);

test('complete source and pinned Q0 do not claim runtime or release admission',async t=>{
  const f=await fixture(t),r=await assess(f);assert.equal(r.accepted,true,JSON.stringify(r.blockers));
  assert.equal(r.coverage.required_identity_count,2);assert.equal(r.index.entries,4);
  assert.equal(r.public_admission,false);assert.equal(r.released,false);
  assert.ok(r.remaining_product_gates.length>0);assert.ok(r.packages.every(p=>p.artifact_kind==='native-source'&&!p.runtime_qualified));
});
test('pending historical identity still blocks an otherwise complete current build',async t=>{
  const f=await fixture(t);await put(f.root,f.authorities.historical_package_identities,{packages:[{id:'missing-lib'}]});
  f.disposition.pending=[{id:'missing-lib',state:'pending_current',owner:'maintainer',reason:'not implemented',next:'implement',fallback:false}];
  await put(f.root,'libspec/identity-dispositions.json',f.disposition);
  const r=await assess(f);assert.equal(r.accepted,false);assert.ok(has(r,'pending-implementations'));
});
test('authority cannot be redirected to a reduced convenience list',async t=>{
  const f=await fixture(t);f.disposition.inventory_authorities.historical_package_identities='empty.json';
  await put(f.root,'libspec/identity-dispositions.json',f.disposition);
  assert.ok(has(await assess(f),'current-identity-union'));
});
test('duplicate current identities reject independently of other source validators',async t=>{
  const f=await fixture(t);f.registry.libs.push(f.registry.libs[0]);await put(f.root,'libspec/registry.json',f.registry);
  await assert.rejects(()=>identityCoverage(f.root),/duplicate current/);
});
test('old authoring tree rejects even with no files in it',async t=>{
  const f=await fixture(t);await mkdir(join(f.root,retiredAuthoringDirectory));assert.ok(has(await assess(f),'no-legacy-source-tree'));
});
test('dangling retired-authoring symlink cannot evade the no-legacy check',async t=>{
  const f=await fixture(t);await symlink(join(f.root,'absent'),join(f.root,retiredAuthoringDirectory));
  assert.ok(has(await assess(f),'no-legacy-source-tree'));
});
test('current-only audit accepts registered non-wasmc-prefixed implementations',async t=>{
  const f=await fixture(t);
  for(const dir of ['.github/workflows','host/platform'])await mkdir(join(f.root,dir),{recursive:true});
  await put(f.root,f.authorities.retired_candidate_identities,{original_candidates:f.registry.libs.map(x=>x.id),retired_commands:[],retired_file_count:0});
  assert.equal(validateCurrentOnlySources(f.root).candidates,2);
  await mkdir(join(f.root,'libspec/orphan'));assert.throws(()=>validateCurrentOnlySources(f.root),/orphan/);
});
test('missing independent pins do not infer trust from receipt contents',async t=>{
  const f=await fixture(t);const r=await currentReleasePreflight(f.root);assert.ok(has(r,'independent-current-build-pins'));
});
test('wrong independent receipt pin rejects',async t=>{
  const f=await fixture(t);f.options.receipt_sha256='0'.repeat(64);assert.ok(has(await assess(f),'full-current-refresh'));
});
test('producer selection is independent of the supplied receipt',async t=>{
  const f=await fixture(t);f.options.producer_sha256='b'.repeat(64);assert.ok(has(await assess(f),'full-current-refresh'));
});
test('selected subset is not a whole-product build',async t=>{
  const f=await fixture(t);f.receipt.selected.pop();f.receipt.rows.pop();await f.seal();assert.ok(has(await assess(f),'full-current-refresh'));
});
test('duplicate receipt rows reject',async t=>{
  const f=await fixture(t);f.receipt.rows.push(f.receipt.rows[0]);await f.seal();assert.ok(has(await assess(f),'full-current-refresh'));
});
test('unverified package row rejects',async t=>{
  const f=await fixture(t);f.receipt.rows[0].state='building';await f.seal();assert.ok(has(await assess(f),'full-current-refresh'));
});
test('accepted false is retained as a failed build',async t=>{
  const f=await fixture(t);f.receipt.accepted=false;await f.seal();assert.ok(has(await assess(f),'full-current-refresh'));
});
test('old generator receipt cannot be used after a builder change',async t=>{
  const f=await fixture(t);await put(f.root,'scripts/lib-refresh-runner-v2.mjs','// changed');assert.ok(has(await assess(f),'full-current-refresh'));
});
test('live delta/source drift rejects an intact old package',async t=>{
  const f=await fixture(t);await put(f.root,'libspec/ios-display/platform.swift','// changed');assert.ok(has(await assess(f),'current-source-and-WIT-routes'));
});
test('shared lock drift rejects',async t=>{
  const f=await fixture(t);await put(f.root,'libspec/Cargo.lock','changed');assert.ok(has(await assess(f),'current-source-and-WIT-routes'));
});
test('old receipts without whole-root pins must be regenerated',async t=>{
  const f=await fixture(t);delete f.receipt.rows[0].root_inventory_sha256;await f.seal();assert.ok(has(await assess(f),'independent-whole-root-inventories'));
});
test('wrong independently sealed package inventory rejects',async t=>{
  const f=await fixture(t);f.receipt.rows[0].root_inventory_sha256='0'.repeat(64);await f.seal();assert.ok(has(await assess(f),'independent-whole-root-inventories'));
});
test('extra package file is not hidden by a valid manifest',async t=>{
  const f=await fixture(t);await put(f.receipt.rows[0].package_root,'undeclared.txt','extra');assert.equal((await assess(f)).accepted,false);
});
test('package symlink rejects',async t=>{
  const f=await fixture(t);const path=join(f.receipt.rows[0].package_root,'platform.swift');
  await rm(path);await symlink(join(f.root,'libspec/android-display/platform.swift'),path);assert.equal((await assess(f)).accepted,false);
});
test('self-rehashed replacement still fails the independent receipt',async t=>{
  const f=await fixture(t),pkg=f.receipt.rows[0].package_root;
  await put(pkg,'platform.swift','replacement');const m=JSON.parse(await readFile(join(pkg,'lib.json')));
  m.implementation[0].sha256=sha(Buffer.from('replacement'));m.implementation[0].bytes=11;await put(pkg,'lib.json',m);
  assert.equal((await assess(f)).accepted,false);
});
test('CLI rejects missing, duplicate and unknown current pins',()=>{
  for(const argv of [['--current-run'],['--fallback','yes'],['--current-run','/a','--current-run','/b']])
    assert.throws(()=>currentReleaseArguments(argv));
});
test('actual new-product creation refuses missing current pins before creating a candidate file',async t=>{
  const f=await fixture(t),out=join(f.root,'must-not-be-created.json');
  const script=fileURLToPath(new URL('release-candidate.mjs',import.meta.url));
  const run=spawnSync(process.execPath,[script,'create',out,'a'.repeat(40),'b'.repeat(40),'0.0.21'],
    {encoding:'utf8',timeout:20000});
  assert.equal(run.status,1);assert.match(run.stderr,/current release preflight rejected/);
  assert.equal(existsSync(out),false);
});
