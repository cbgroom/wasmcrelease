// Qualify a complete, digest-pinned Std Root installed through the public
// current Lib installer. The installed directory is a product-relative file
// tree (current-libs/<id>/<version>/...), not a flat Std artifact directory.
// No network, Host authority or provider resolution is performed here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, lstatSync, realpathSync} from 'node:fs';
import {join, resolve, isAbsolute} from 'node:path';
import {compileLib} from '../current/index.mjs';
import {checkedCurrentCatalog, resolveCurrentPackage, currentProductReader, hash} from './current-lib-release-v3.mjs';

const exact={
  catalog:'a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad',
  provider:'c3ac42b93f4c27e24065abe804b91f54761eff782e2971e947847b3d20ee7e00',
  lib:'b79a499c8300361125e7fcdae02170184b82d4bbeff4d8f24ed95f3fd4db8d3b',
  plan:'8be27de32e1e8dadcb997f2b886d0349531eb9448c1b7dd73a74a3d9e34f87b3',
  stdModule:'wasmc:lib/wasmc.std@1.4.1',
  providerModule:'wasmc:lib/wasmc.lib_managed_object_heap@4.9.0',
};
const args=process.argv.slice(2);
const flag=name=>{const i=args.indexOf(name);assert.ok(i>=0&&args[i+1],'missing '+name);return args[i+1];};
assert.equal(args.length,4,'usage: --installed-root DIR --provider exact-corelib.wasm');
const installed=resolve(flag('--installed-root'));
const providerPath=resolve(flag('--provider'));
assert.ok(isAbsolute(installed)&&isAbsolute(providerPath));
assert.ok(lstatSync(installed).isSymbolicLink(),'installer must publish an atomic directory symlink');
assert.ok(realpathSync(installed)!==installed,'expected installed staging directory');
const productRoot=resolve(import.meta.dirname,'..');
const catalogBytes=readFileSync(join(productRoot,'catalog/libs-current-v2.json'));
assert.equal(hash(catalogBytes),exact.catalog);
const catalog=checkedCurrentCatalog(catalogBytes,exact.catalog);
const row=catalog.packages.find(r=>r.id==='wasmc-std'&&r.version==='1.4.1');
assert.ok(row&&row.files.length===19);
const currentRead=currentProductReader(productRoot+'/');
const lock=resolveCurrentPackage(catalogBytes,exact.catalog,{
 id:row.id,version:row.version,
 manifest_sha256:row.manifest_sha256,
 root_inventory_sha256:row.root_inventory_sha256,
},currentRead);
const installedRead=path=>readFileSync(join(installed,path));
const installReceipt=JSON.parse(readFileSync(join(installed,'install-receipt.json')));
const verifyReceipt=receipt=>{
 assert.equal(receipt.schema,'wasmc.public-lib-install/v2');
 assert.equal(receipt.catalog_sha256,exact.catalog);
 assert.equal(receipt.artifact_commit,catalog.package_authority_commit);
 assert.equal(receipt.id,row.id);
 assert.equal(receipt.version,row.version);
 assert.equal(receipt.profile,row.profile);
 assert.equal(receipt.files_verified,row.files.length);
 assert.equal(receipt.lock_sha256,hash(Buffer.from(JSON.stringify(lock))));
 assert.equal(receipt.publication,'exclusive-directory-symlink');
 assert.ok(['github','jsdelivr'].includes(receipt.mirror));
 assert.equal(receipt.authority_granted,false);
 assert.equal(receipt.device_qualified,false);
};
verifyReceipt(installReceipt);
// Mandatory complete installed package WIT+SDK+Core/Component+LICENSE/root digest audit.
// No library bytes are read from an in-tree product Root after this point.
assert.deepEqual(resolveCurrentPackage(catalogBytes,exact.catalog,lock,installedRead),lock);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const installedArtifact=installedRead(row.root+'/artifact.wasm');
const installedPlan=installedRead(row.root+'/typed-resource-plan.json');
const installedWit=installedRead(row.root+'/lib.wit');
assert.equal(sha(installedArtifact),exact.lib);
assert.equal(sha(installedPlan),exact.plan);
assert.ok(installedWit.includes(Buffer.from('package wasmc:std@1.4.1')));
const provider=readFileSync(providerPath);
assert.equal(sha(provider),exact.provider);
const pm=new WebAssembly.Module(provider);
assert.deepEqual(WebAssembly.Module.imports(pm),[]);
const lm=new WebAssembly.Module(installedArtifact);
assert.ok(WebAssembly.Module.imports(lm).length>0);
for(const imp of WebAssembly.Module.imports(lm))assert.equal(imp.module,exact.providerModule);
const source=readFileSync(join(productRoot,'examples/current/standard.wasmc'),'utf8');
const fixtures=JSON.parse(readFileSync(join(productRoot,'examples/current/standard-fixtures.json')));
const compiled=(await compileLib(source,{plan:installedPlan,libWasmBytes:installedArtifact})).appWasm;
const sealed=readFileSync(join(productRoot,'examples/current/standard-wasmc.wasm'));
const rust=readFileSync(join(productRoot,'examples/current/standard-rust.wasm'));
assert.equal(sha(compiled),fixtures.wasmc_sha256);
assert.equal(sha(sealed),fixtures.wasmc_sha256);
assert.equal(sha(rust),fixtures.rust_sha256);
// Negative gates are *virtual* input corruption, never mutations of live installed files.
let negativeCases=0;
const rejects=reader=>{assert.throws(()=>resolveCurrentPackage(catalogBytes,exact.catalog,lock,reader));negativeCases++;};
assert.throws(()=>verifyReceipt({...installReceipt,lock_sha256:'0'.repeat(64)}));negativeCases++;
assert.throws(()=>verifyReceipt({...installReceipt,authority_granted:true}));negativeCases++;
rejects(path=>path===row.root+'/artifact.wasm'
 ? Buffer.concat([installedRead(path),Buffer.from([0])])
 : installedRead(path));
rejects(path=>path===row.root+'/lib.wit'
 ? Buffer.from('not-the-pinned-WIT')
 : installedRead(path));
rejects(path=>{if(path===row.root+'/artifact.wasm')throw Error('missing installed artifact');return installedRead(path);});
let calls=0;
for(const appBytes of [compiled,sealed,rust]){
  const p=new WebAssembly.Instance(pm,{});
  assert.equal(p.exports.provider_domain_init(127,7),0);
  const lib=new WebAssembly.Instance(lm,{[exact.providerModule]:p.exports});
  assert.equal(lib.exports.std_init(),0);
  const am=new WebAssembly.Module(appBytes);
  for(const imp of WebAssembly.Module.imports(am))assert.equal(imp.module,exact.stdModule);
  const app=new WebAssembly.Instance(am,{[exact.stdModule]:lib.exports});
  for(let round=0;round<128;round++)for(const index of [0,1,2,99,4294967295])for(const item of [0,1,128,255]){
    const result=app.exports.run(index,item);
    assert.equal(Array.isArray(result)?result[0]:result,[-7,0,2147483647][index]??9);
    if(Array.isArray(result))assert.equal(result[1],0);
    calls++;
  }
}
assert.equal(calls,7680);
console.log(JSON.stringify({
 accepted:true,source:'exact-installed-complete-root',
 lib:'wasmc-std@1.4.1',package_root:row.root,
 artifact_commit:catalog.package_authority_commit,
 catalog_sha256:exact.catalog,
 complete_files_verified:row.files.length,
 installed_app_source_compiled:true,providers_instantiated:3,
 actual_consumer_calls:calls,consumer_count:3,negative_cases:negativeCases,
 provider_sha256:exact.provider,library_sha256:exact.lib,plan_sha256:exact.plan,
 bytes_from_in_tree_lib:false,install_receipt_verified:true,mirror_receipt:installReceipt.mirror,network_fetched_by_consumer:false,authority_granted:false,
 commercial_use_qualified:false,device_qualified:false,
}));
