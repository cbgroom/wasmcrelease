// An independent structural checker; synthetic fixtures are not Lib qualification.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {all18Targets,validateFutureLibLicenses} from './future-lib-license-admission.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalogPath='catalog/libs-current-v2.json';
const profiles=['rust_component','rust_core'];
const schema={rust_component:'wasmc.lib-rust-component-sdk/v0',rust_core:'wasmc.lib-rust-core-sdk/v0'};

function fixture(declarations=profiles,carried=true){
  const payloads=new Map(),packages=[];
  const put=(path,value)=>payloads.set(path,Buffer.from(value));
  for(const id of all18Targets){
    const root=`current-libs/${id}/9.1.0`;
    const license=Buffer.from('Synthetic structural-test grant. Not a distribution license.\n');
    const cargo=Buffer.from('[package]\nname = "structural-sdk-fixture"\nversion = "9.1.0"\nlicense-file = "../../LICENSE"\n');
    const bindings=Object.fromEntries(declarations.map(profile=>[profile,{
      schema:schema[profile],path:'bindings/rust',
      cargo_toml:{path:'bindings/rust/Cargo.toml',sha256:sha(cargo)}
    }]));
    put(`${root}/LICENSE`,license);
    if(carried)put(`${root}/bindings/rust/Cargo.toml`,cargo);
    put(`${root}/lib.json`,JSON.stringify({
      schema:'wasmc.lib/v2',id,version:'9.1.0',bindings,
      license:{schema:'wasmc.lib-license/v1',identifier:'synthetic-test-only',
        files:[{path:'LICENSE',bytes:license.length,sha256:sha(license)}]}
    }));
    packages.push({id,root,version:'9.1.0',files:[]});
  }
  const row=(path,bytes)=>({path,bytes:bytes.length,sha256:sha(bytes)});
  const refresh=()=>{
    // Bind every surviving byte independently into both inventories. Removed
    // bytes are absent from both; the manifest declaration remains authoritative.
    for(const p of packages)p.files=[...payloads]
      .filter(([path])=>path.startsWith(`${p.root}/`))
      .map(([path,bytes])=>row(path,bytes)).sort((a,b)=>a.path.localeCompare(b.path));
    put(catalogPath,JSON.stringify({schema:'wasmc.public-lib-catalog/v1',packages}));
    return {version:'0.0.21',product_files:[...payloads]
      .map(([path,bytes])=>row(path,bytes)).sort((a,b)=>a.path.localeCompare(b.path))};
  };
  const target=id=>packages.find(p=>p.id===id);
  const edit=(id,change)=>{
    const path=`${target(id).root}/lib.json`,m=JSON.parse(payloads.get(path));
    change(m);put(path,JSON.stringify(m));
  };
  const read=path=>{
    assert(payloads.has(path),`checker requested absent bytes: ${path}`);
    return payloads.get(path);
  };
  return {payloads,packages,target,edit,put,read,refresh};
}

let positive=0,negative=0;
const pass=(name,declarations,carried,expectedBound)=>{
  const f=fixture(declarations,carried),r=validateFutureLibLicenses(f.refresh(),f.read);
  assert.equal(r.targets.length,18);
  assert(r.targets.every(row=>row.rust_sdk_license_bound===expectedBound));
  assert.equal(r.legal_compatibility,false);
  assert.equal(r.dependency_notice_completeness,false);
  assert.equal(r.runtime_qualification,false);
  positive++;
  console.log(`FUTURE_RUST_SDK_LICENSE_POSITIVE name=${name} targets=18 bound=${expectedBound}`);
};
pass('declared-component',['rust_component'],true,true);
pass('declared-core',['rust_core'],true,true);
pass('both-declarations',profiles,true,true);
pass('carried-without-declaration',[],true,true);
pass('neither-carried-nor-declared',[],false,false);

function reject(name,declarations,id,mutate){
  const f=fixture(declarations);mutate(f,id);
  let error;
  try {validateFutureLibLicenses(f.refresh(),f.read);}catch(value){error=value;}
  console.log(`FUTURE_RUST_SDK_LICENSE_NEGATIVE name=${name} profiles=${declarations.join(',')} target=${id} expected=REJECT actual=${error?'REJECT':'ACCEPT'}`);
  assert(error,`declared Rust SDK obligation bypass: ${name} / ${declarations.join(',')} / ${id}`);
  assert.match(error.message,/^future Lib license admission:/);
  negative++;
}

// Keep the first baseline mutation identical to the reported real-family hole.
reject('cargo-removed-from-both-inventories',['rust_component'],'wasmc-json',
  (f,id)=>f.payloads.delete(`${f.target(id).root}/bindings/rust/Cargo.toml`));

for(const profile of profiles){
  for(const id of all18Targets){
    reject('declared-cargo-removed',[profile],id,
      (f,key)=>f.payloads.delete(`${f.target(key).root}/bindings/rust/Cargo.toml`));
    reject('declared-cargo-stale-pin',[profile],id,
      (f,key)=>f.edit(key,m=>{m.bindings[profile].cargo_toml.sha256='0'.repeat(64);}));
    reject('declared-cargo-wrong-path',[profile],id,
      (f,key)=>f.edit(key,m=>{m.bindings[profile].cargo_toml.path='bindings/rust/other.toml';}));
    reject('declared-cargo-missing-pin',[profile],id,
      (f,key)=>f.edit(key,m=>{delete m.bindings[profile].cargo_toml;}));
    reject('declared-cargo-invalid-license',[profile],id,
      (f,key)=>{
        const text=Buffer.from('[package]\nlicense = "MIT"\n');
        f.put(`${f.target(key).root}/bindings/rust/Cargo.toml`,text);
        f.edit(key,m=>{m.bindings[profile].cargo_toml.sha256=sha(text);});
      });
  }
}

// Do not prefer one declaration and accidentally ignore the other one's pin.
for(const profile of profiles){
  reject('conflicting-existing-declarations',profiles,'wasmc-system-telemetry',
    (f,id)=>f.edit(id,m=>{m.bindings[profile].cargo_toml.sha256='f'.repeat(64);}));
}

// Independent inventories remain obligations even without a manifest declaration.
for(const inventory of ['product','catalog']){
  const f=fixture([]),id='wasmc-compression',path=`${f.target(id).root}/bindings/rust/Cargo.toml`;
  const candidate=f.refresh();
  if(inventory==='product')candidate.product_files=candidate.product_files.filter(row=>row.path!==path);
  else {
    f.target(id).files=f.target(id).files.filter(row=>row.path!==path);
    f.put(catalogPath,JSON.stringify({schema:'wasmc.public-lib-catalog/v1',packages:f.packages}));
    const bytes=f.payloads.get(catalogPath),bound=candidate.product_files.find(row=>row.path===catalogPath);
    bound.bytes=bytes.length;bound.sha256=sha(bytes);
  }
  assert.throws(()=>validateFutureLibLicenses(candidate,f.read),/^Error: future Lib license admission:/);
  negative++;
}

console.log(JSON.stringify({accepted:true,targets:18,positive_controls:positive,negative_controls:negative,
  existing_profiles:profiles,source_free_fixture:true,
  scope:'structural declaration/Cargo/license/product/catalog binding only; no legal, dependency completeness, runtime, full18 admission or release claim'}));
