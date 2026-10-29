// Independent delivery-input obligations. Fixtures are not real Lib qualification.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import * as validator from './release-candidate.mjs';
import {makeRouteFixture} from './test-future-current-route-fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
// Do not derive the oracle from the implementation's own selected path list.
const required=[
  'LICENSE','catalog/current-v2-policy.json','catalog/libs-current-v2.json',
  'examples/lib-search/client.mjs','license-policy.json',
  'scripts/declared-thirdparty-notices.mjs','scripts/future-lib-license-admission.mjs',
  'scripts/lib-catalog.mjs','scripts/lib-install.mjs','scripts/lib-route-closure.mjs',
  'scripts/release-candidate.mjs','scripts/wasmc-lib.mjs'
];
function fixture(){
  // Full independent route/actual synthetic Wasm fixture: a delivery-input-only
  // fake closure must not bypass the new future route obligation.
  return makeRouteFixture();
}
const good=fixture();
assert.equal(validator.validateCandidate(good.candidate,good.read),true);
let negatives=0;
for(const path of required){
  // Keep exact bytes available in the checkout-like reader after deleting only
  // the inventory row. Rehashing a shortened inventory cannot erase an obligation.
  const f=fixture();f.candidate.product_files=f.candidate.product_files.filter(x=>x.path!==path);
  f.candidate.product_set_sha256=sha(JSON.stringify(f.candidate.product_files));
  let outsideReads=0;
  const read=p=>{if(p===path)outsideReads++;return f.read(p);};
  assert.throws(()=>validator.validateCandidate(f.candidate,read),undefined,`original validator accepted missing mandatory product input: ${path}`);
  assert.equal(outsideReads,0,'omitted inventory input must not be satisfied from checkout');negatives++;
  const missing=fixture();missing.bytes.delete(path);missing.refresh();
  assert.throws(()=>validator.validateCandidate(missing.candidate,missing.read));negatives++;
  const drift=fixture();drift.bytes.set(path,Buffer.from('substitution not authorized by candidate inventory\n'));
  assert.throws(()=>validator.validateCandidate(drift.candidate,drift.read),/product drift rejected/);negatives++;
}
// Policy variation outside the inventory used to leave the product identity
// unchanged while both variants passed the actual candidate validator.
for(const path of ['license-policy.json','catalog/current-v2-policy.json']){
  const f=fixture();f.candidate.product_files=f.candidate.product_files.filter(x=>x.path!==path);
  f.candidate.product_set_sha256=sha(JSON.stringify(f.candidate.product_files));
  for(const value of ['policy A\n','policy B\n']){f.bytes.set(path,Buffer.from(value));assert.throws(()=>validator.validateCandidate(f.candidate,f.read));negatives++;}
}
assert.deepEqual(validator.futureLibProductInputs('0.0.21'),required);
for(const version of ['0.1.0','1.0.0'])assert.deepEqual(validator.futureLibProductInputs(version),required);
for(const version of ['0.0.18','0.0.19','0.0.20'])assert.deepEqual(validator.futureLibProductInputs(version),[]);
assert(required.every(p=>!p.startsWith('.agents/')));

// Copy only selected public delivery bytes into a fresh product-like directory.
// No .git, .agents, private source, node_modules or repository fallback is present.
const work=mkdtempSync(join(tmpdir(),'wasmc-future-inputs-'));
const legacyRoot=process.env.WASMC_LEGACY_CLI_FIXTURE_ROOT??root;
// Independently pin the historical current-five CLI fixture at 2f5efe27;
// the repository's present current catalog is a different schema.
for(const [p,pin] of Object.entries({
  'catalog/libs-current-v2.json':'bd330af885fd77632f9cb02b93ef75023723ad08b7f07f9b7d09f1746e9ce56c',
  'scripts/wasmc-lib.mjs':'bbdb959edd708fdef2236f1929d78d5d501784e15e21fa2daefad89017015f85',
  'scripts/lib-catalog.mjs':'3ccdc53aec8ccb2386231cbf16929aef5198a4da7d7d073bed1389584cc4d62a',
  'scripts/lib-install.mjs':'09d013ba9d31a9859a951c18e5ade476290a98afe99e0450edc9ad6ffeea0d26',
})) assert.equal(sha(readFileSync(join(legacyRoot,p))),pin,`historical CLI fixture identity: ${p}`);
const catalog=JSON.parse(readFileSync(join(legacyRoot,'catalog/libs-current-v2.json')));
const json=catalog.packages.find(p=>p.id==='wasmc-json');assert(json);
const paths=new Set([...required,...json.files.map(f=>f.path),...catalog.packages.map(p=>p.root+'/lib.json')]);
let copiedBytes=0;
for(const p of paths){const b=readFileSync(join(legacyRoot,p));copiedBytes+=b.length;assert(copiedBytes<=4*1024*1024,'bounded public-only fixture required');mkdirSync(dirname(join(work,p)),{recursive:true});writeFileSync(join(work,p),b,{flag:'wx'});}
const run=args=>spawnSync(process.execPath,args,{cwd:work,encoding:'utf8',timeout:10000,maxBuffer:1<<20});
const search=run(['scripts/wasmc-lib.mjs','search','json']);assert.equal(search.status,0,search.stderr);assert(JSON.parse(search.stdout).hits.some(p=>p.id==='wasmc-json'));
const resolve=run(['scripts/wasmc-lib.mjs','resolve',json.id,json.version,'--catalog-sha256',sha(readFileSync(join(work,'catalog/libs-current-v2.json'))),'--wit-sha256',json.wit_sha256,'--artifact-sha256',json.artifact_sha256]);
assert.equal(resolve.status,0,resolve.stderr);assert.equal(JSON.parse(resolve.stdout).verified,true);
const notices=run(['--input-type=module','-e',"import {readFileSync} from 'node:fs'; import {collectDeclaredThirdPartyNotices} from './scripts/declared-thirdparty-notices.mjs';const rows=await collectDeclaredThirdPartyNotices(readFileSync('catalog/libs-current-v2.json'),JSON.parse(readFileSync('catalog/current-v2-policy.json')),p=>readFileSync(p));console.log(JSON.stringify({declared:rows.size}));"]);
assert.equal(notices.status,0,notices.stderr);assert.equal(JSON.parse(notices.stdout).declared,0);
// Exercise the current mixed schema with its actual complete product fixture.
// Legacy CLI and current CLI have different schemas and command-line contracts.
const modern=process.env.WASMC_MIXED_CLI_FIXTURE,modernPin=process.env.WASMC_MIXED_CATALOG_SHA256;
assert.ok(modern&&/^[0-9a-f]{64}$/.test(modernPin??''),'independently pinned mixed fixture required');
assert.ok(!existsSync(join(modern,'.git'))&&!existsSync(join(modern,'.agents')),'product fixture must not rely on repository or maintainer files');
for(const p of ['scripts/wasmc-lib.mjs','scripts/current-lib-release-v3.mjs','scripts/mixed-current-product-v1.mjs','scripts/project-frozen-search-index-v1.mjs','scripts/lib-install.mjs'])
  assert.equal(sha(readFileSync(join(modern,p))),sha(readFileSync(join(root,p))),`current delivered script drift: ${p}`);
const catalogBytes=readFileSync(join(modern,'catalog/libs-current-v2.json'));
assert.equal(sha(catalogBytes),modernPin,'independent mixed catalog pin');
const current=JSON.parse(catalogBytes),currentJson=current.packages.find(p=>p.id==='wasmc-json');assert(currentJson);
const cli=args=>spawnSync(process.execPath,[join(modern,'scripts/wasmc-lib.mjs'),...args],{cwd:modern,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
const modernSearch=cli(['search','json','--catalog-sha256',modernPin,'--limit','2']);assert.equal(modernSearch.status,0,modernSearch.stderr);
const found=JSON.parse(modernSearch.stdout).result;assert.equal(found.tag,'ok');
assert.ok(found.value.some(row=>row.package_id===currentJson.id&&row.version===currentJson.version),'current JSON is discoverable');
const modernResolve=cli(['resolve',currentJson.id,currentJson.version,'--catalog-sha256',modernPin,'--manifest-sha256',currentJson.manifest_sha256,'--root-inventory-sha256',currentJson.root_inventory_sha256]);
assert.equal(modernResolve.status,0,modernResolve.stderr);assert.equal(JSON.parse(modernResolve.stdout).verified,true);
assert.notEqual(cli(['search','json','--catalog-sha256','0'.repeat(64)]).status,0);
console.log(JSON.stringify({accepted:true,mandatory_lib_cli_and_license_inputs:required.length,negative_controls:negatives,legacy_product_only_commands:3,copied_public_bytes:copiedBytes,legacy_selection_unchanged:true,mixed_catalog_sha256:modernPin,mixed_product_only_commands:2,mixed_negative_controls:1,scope:'historical input identity and legacy CLI plus pinned synthetic mixed product CLI; not real producer admission, installed Host or release'}));
