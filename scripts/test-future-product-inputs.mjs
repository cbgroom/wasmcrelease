// Independent delivery-input obligations. Fixtures are not real Lib qualification.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import * as validator from './release-candidate.mjs';
import {all18Targets,validateFutureLibLicenses} from './future-lib-license-admission.mjs';

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
  const bytes=new Map(),packages=[];
  const put=(path,data)=>{const b=Buffer.from(data);bytes.set(path,b);return {path,bytes:b.length,sha256:sha(b)};};
  for(const id of all18Targets){
    const packageRoot=`current-libs/${id}/9.0.0`,license=Buffer.from('Structural research fixture.\n');
    const manifest={schema:'wasmc.lib/v2',id,version:'9.0.0',license:{schema:'wasmc.lib-license/v1',identifier:'fixture',files:[{path:'LICENSE',bytes:license.length,sha256:sha(license)}]}};
    const files=[put(packageRoot+'/LICENSE',license),put(packageRoot+'/lib.json',JSON.stringify(manifest))];
    packages.push({id,version:'9.0.0',root:packageRoot,files});
  }
  for(const p of required)if(p!=='catalog/libs-current-v2.json')put(p,readFileSync(join(root,p)));
  put('catalog/libs-current-v2.json',JSON.stringify({schema:'wasmc.public-lib-catalog/v1',packages}));
  const candidate={schema:'wasmc.release-product-candidate/v2',version:'0.0.21',compiler_source_authority:'a'.repeat(40),lib_source_authority:'b'.repeat(40),lib_route_closure:{schema:'wasmc.release-candidate-lib-route-closure/v1',authority_receipt:{path:'fixture-receipt.json',sha256:'a'.repeat(64)},catalog:{path:'catalog/libs-current-v2.json',sha256:'b'.repeat(64)},search_index:{path:'fixture-index.lsi',sha256:'c'.repeat(64)},release_packages:18,package_routes:18,api_routes:1,candidate_extras:0,exact:true,candidate_extra_grants_release:false}};
  const refresh=()=>{candidate.product_files=[...bytes].map(([path,b])=>({path,bytes:b.length,sha256:sha(b)})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);candidate.product_set_sha256=sha(JSON.stringify(candidate.product_files));};
  const read=p=>{assert(bytes.has(p),`fixture bytes missing: ${p}`);return bytes.get(p);};
  refresh();candidate.lib_license_admission=validateFutureLibLicenses(candidate,read);
  return {candidate,bytes,refresh,read};
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
