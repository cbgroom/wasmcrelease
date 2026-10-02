// Independent delivery-input obligations. Fixtures are not real Lib qualification.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
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
const catalog=JSON.parse(readFileSync(join(root,'catalog/libs-current-v2.json')));
const json=catalog.packages.find(p=>p.id==='wasmc-json');assert(json);
const paths=new Set([...required,...json.files.map(f=>f.path),...catalog.packages.map(p=>p.root+'/lib.json')]);
let copiedBytes=0;
for(const p of paths){const b=readFileSync(join(root,p));copiedBytes+=b.length;assert(copiedBytes<=4*1024*1024,'bounded public-only fixture required');mkdirSync(dirname(join(work,p)),{recursive:true});writeFileSync(join(work,p),b,{flag:'wx'});}
const run=args=>spawnSync(process.execPath,args,{cwd:work,encoding:'utf8',timeout:10000,maxBuffer:1<<20});
const search=run(['scripts/wasmc-lib.mjs','search','json']);assert.equal(search.status,0,search.stderr);assert(JSON.parse(search.stdout).hits.some(p=>p.id==='wasmc-json'));
const resolve=run(['scripts/wasmc-lib.mjs','resolve',json.id,json.version,'--catalog-sha256',sha(readFileSync(join(work,'catalog/libs-current-v2.json'))),'--wit-sha256',json.wit_sha256,'--artifact-sha256',json.artifact_sha256]);
assert.equal(resolve.status,0,resolve.stderr);assert.equal(JSON.parse(resolve.stdout).verified,true);
const notices=run(['--input-type=module','-e',"import {readFileSync} from 'node:fs'; import {collectDeclaredThirdPartyNotices} from './scripts/declared-thirdparty-notices.mjs';const rows=await collectDeclaredThirdPartyNotices(readFileSync('catalog/libs-current-v2.json'),JSON.parse(readFileSync('catalog/current-v2-policy.json')),p=>readFileSync(p));console.log(JSON.stringify({declared:rows.size}));"]);
assert.equal(notices.status,0,notices.stderr);assert.equal(JSON.parse(notices.stdout).declared,0);
console.log(JSON.stringify({accepted:true,mandatory_lib_cli_and_license_inputs:required.length,negative_controls:negatives,product_only_commands:3,copied_public_bytes:copiedBytes,legacy_selection_unchanged:true,scope:'bounded input inventory/identity and current-five CLI load/search/JSON resolve; not all validators, all18 qualification, legal review, install transport or future route closure'}));
