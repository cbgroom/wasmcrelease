// Independent synthetic public fixtures, not producer/runtime/SDK admission.
// This file deliberately imports no candidate, route, WIT or license gate.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const routeTargets=Object.freeze(['mcpgit-resident-memory','wasmc-compression','wasmc-csv','wasmc-data-compute','wasmc-data-core','wasmc-data-expr','wasmc-data-interchange','wasmc-data-profile','wasmc-data-relational','wasmc-host-clock','wasmc-http1','wasmc-json','wasmc-lib-search','wasmc-owned-algorithms','wasmc-resource-counter','wasmc-router-policy','wasmc-std','wasmc-system-telemetry']);
export const routePublicInputs=Object.freeze(['LICENSE','catalog/current-v2-policy.json','catalog/libs-current-v2.json','examples/lib-search/client.mjs','license-policy.json','scripts/declared-thirdparty-notices.mjs','scripts/future-lib-license-admission.mjs','scripts/lib-catalog.mjs','scripts/lib-install.mjs','scripts/lib-route-closure.mjs','scripts/release-candidate.mjs','scripts/wasmc-lib.mjs']);
export const routeSha=b=>createHash('sha256').update(b).digest('hex');
const jsonBytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const order=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
const uleb=n=>{const b=[];do{let x=n&127;n>>>=7;if(n)x|=128;b.push(x);}while(n);return b;};
const sleb=n=>{const b=[];for(;;){let x=n&127;n>>=7;const done=n===0&&(x&64)===0||n===-1&&(x&64)!==0;if(!done)x|=128;b.push(x);if(done)return b;}};
const vector=rows=>[...uleb(rows.length),...rows.flat()];
const name=s=>{const b=Buffer.from(s);return [...uleb(b.length),...b];};
const section=(id,bytes)=>[id,...uleb(bytes.length),...bytes];
const iconst=n=>[0x41,...sleb(n)];
const get=n=>[0x20,...uleb(n)],set=n=>[0x21,...uleb(n)];
const load=(offset=0)=>[0x28,2,...uleb(offset)];
const store=(offset=0)=>[0x36,2,...uleb(offset)];
const write32=(address,value)=>[...iconst(address),...iconst(value),...store()];

// The six LSI fields and parent/flags are independently authored here.
export function makeFixtureIndex(entries){
  const strings=[...new Set(entries.flatMap(e=>[e.identity,e.signature,e.search_text,e.skill_path,e.wit_path,e.artifact_path]))].sort(order);
  const ids=new Map(strings.map((s,i)=>[s,i]));
  const stringBytes=strings.map(s=>Buffer.from(s));
  assertBound(entries.length<=16384&&strings.length<=65535,'index counts');
  assertBound(stringBytes.every(b=>b.length<=4096),'index string bound');
  const poolBytes=Buffer.concat(stringBytes);assertBound(poolBytes.length<=1048576,'index pool bound');
  const rowStart=8+(strings.length+1)*4,poolStart=rowStart+entries.length*15;
  const b=Buffer.alloc(poolStart+poolBytes.length);b.write('LSI1');b.writeUInt16LE(strings.length,4);b.writeUInt16LE(entries.length,6);
  let offset=0;for(let i=0;i<strings.length;i++){b.writeUInt32LE(offset,8+i*4);offset+=stringBytes[i].length;}b.writeUInt32LE(offset,8+strings.length*4);
  const packages=new Map(entries.map((e,i)=>[e.signature===''?e.identity:null,i]).filter(([key])=>key!==null));
  entries.forEach((e,i)=>{const p=rowStart+i*15,parent=e.signature===''?i:packages.get(e.package_identity);assertBound(Number.isInteger(parent),'API parent');b[p]=(e.signature===''?0:1)|(e.historical?2:0);b.writeUInt16LE(parent,p+1);[e.identity,e.signature,e.search_text,e.skill_path,e.wit_path,e.artifact_path].forEach((s,j)=>b.writeUInt16LE(ids.get(s),p+3+j*2));});
  poolBytes.copy(b,poolStart);assertBound(b.length<=2097152,'index bound');
  return b;
}
function assertBound(ok,what){if(!ok)throw Error(`independent fixture ${what} rejected`);}

// A real, import-free Core module implementing the exact existing JS consumer
// ABI. The independently encoded LSI is embedded in its data section. No JS
// export replacement, runtime hook, producer tool or Cargo compiler is involved.
export function makeFixtureSearchCore(index,{version='9.1.0',entries,snapshotDigest=routeSha(index),snapshotCount=entries.length,snapshotLoop=false}={}){
  const b=Buffer.from(index),stringCount=b.readUInt16LE(4),rowStart=8+(stringCount+1)*4,poolStart=rowStart+b.readUInt16LE(6)*15;
  const lsiBase=1024,strings=new Map();
  for(let i=0;i<stringCount;i++){const start=b.readUInt32LE(8+i*4),end=b.readUInt32LE(12+i*4);strings.set(b.subarray(poolStart+start,poolStart+end).toString('utf8'),{ptr:lsiBase+poolStart+start,len:end-start});}
  let extraBase=lsiBase+b.length;const extra=[];
  for(const e of entries)for(const s of [e.identity,e.signature,e.skill_path,e.wit_path,e.artifact_path])if(!strings.has(s)){const raw=Buffer.from(s);strings.set(s,{ptr:extraBase,len:raw.length});extra.push(raw);extraBase+=raw.length;}
  const table=(extraBase+3)&~3,end=table+entries.length*40;assertBound(end<65536,'one-page immutable table');
  const data=Buffer.alloc(end);b.copy(data,lsiBase);Buffer.concat(extra).copy(data,lsiBase+b.length);Buffer.from(snapshotDigest).copy(data,64);
  data.writeUInt32LE(1,128);data.writeUInt32LE(snapshotCount,132);data.writeUInt32LE(64,136);data.writeUInt32LE(Buffer.byteLength(snapshotDigest),140);
  entries.forEach((e,i)=>[e.identity,e.signature,e.skill_path,e.wit_path,e.artifact_path].forEach((s,j)=>{const v=strings.get(s);data.writeUInt32LE(v.ptr,table+i*40+j*8);data.writeUInt32LE(v.len,table+i*40+j*8+4);}));
  const types=vector([[0x60,...vector(Array(4).fill([0x7f])),...vector([[0x7f]])],[0x60,...vector([[0x7f]]),...vector([])],[0x60,...vector([]),...vector([[0x7f]])],[0x60,...vector(Array(3).fill([0x7f])),...vector([[0x7f]])],[0x60,...vector(Array(2).fill([0x7f])),...vector([[0x7f]])],[0x60,...vector(Array(5).fill([0x7f])),...vector([[0x7f]])]]);
  const body=(locals,instructions)=>{const raw=[...(locals?vector([[...uleb(locals),0x7f]]):vector([])),...instructions,0x0b];return [...uleb(raw.length),...raw];};
  const realloc=body(0,[...get(3),...iconst(32768),0x4b,0x04,0x40,0x00,0x0b,...iconst(65536)]);
  const post=body(0,[]),snapshot=body(0,[...(snapshotLoop?[0x03,0x40,0x0c,0,0x0b]:[]),...iconst(128)]);
  const equal=body(1,[...iconst(0),...set(3),0x03,0x40,...get(3),...get(2),0x4f,0x04,0x40,...iconst(1),0x0f,0x0b,...get(0),...get(3),0x6a,0x2d,0,0,...get(1),...get(3),0x6a,0x2d,0,0,0x47,0x04,0x40,...iconst(0),0x0f,0x0b,...get(3),...iconst(1),0x6a,...set(3),0x0c,0,0x0b,...iconst(1)]);
  const copyHit=Array.from({length:10},(_,j)=>[...iconst(196+j*4),...get(3),...load(j*4),...store()]).flat();
  const lookup=body(2,[...write32(192,0),...iconst(0),...set(2),0x02,0x40,0x03,0x40,...get(2),...iconst(entries.length),0x4f,0x0d,1,...iconst(table),...get(2),...iconst(40),0x6c,0x6a,...set(3),...get(1),...get(3),...load(4),0x46,0x04,0x40,...get(0),...get(3),...load(),...get(1),0x10,3,0x04,0x40,...write32(192,1),...copyHit,...iconst(192),0x0f,0x0b,0x0b,...get(2),...iconst(1),0x6a,...set(2),0x0c,0,0x0b,0x0b,...iconst(192)]);
  const error=code=>[...write32(160,1),...write32(164,code),...iconst(160),0x0f];
  const search=body(1,[...write32(160,0),...write32(164,table),...write32(168,0),...get(1),...iconst(0),0x47,0x04,0x40,...error(0),0x0b,...get(4),...iconst(1),0x49,...get(4),...iconst(64),0x4b,0x72,0x04,0x40,...error(1),0x0b,...get(3),...iconst(entries.length),0x4f,0x04,0x40,...iconst(160),0x0f,0x0b,...iconst(entries.length),...get(3),0x6b,...set(5),...get(5),...get(4),0x4b,0x04,0x40,...get(4),...set(5),0x0b,...iconst(164),...iconst(table),...get(3),...iconst(40),0x6c,0x6a,...store(),...iconst(168),...get(5),...store(),...iconst(160)]);
  const prefix=`wasmc:lib-search/catalog@${version}#`;
  const exports=vector([[...name('memory'),2,0],[...name('cabi_realloc'),0,0],...[['snapshot',2],['lookup',4],['search',5]].flatMap(([n,id])=>[[...name(prefix+n),0,id],[...name('cabi_post_'+prefix+n),0,1]])]);
  const dataSegment=[0,...iconst(0),0x0b,...uleb(data.length),...data];
  const module=Buffer.from([0,97,115,109,1,0,0,0,...section(1,types),...section(3,vector([0,1,2,3,4,5].map(x=>[x]))),...section(5,vector([[1,2,2]])),...section(7,exports),...section(10,vector([realloc,post,snapshot,equal,lookup,search])),...section(11,vector([dataSegment]))]);
  assertBound(WebAssembly.validate(module),'standard Core encoding');
  assertBound(WebAssembly.Module.imports(new WebAssembly.Module(module)).length===0,'zero imports');
  return module;
}

export function makeRouteFixture({variant='a'}={}){
  assertBound(['a','b'].includes(variant),'variant');
  const bytes=new Map(),packages=[],expectedEntries=[],version=variant==='a'?'9.1.0':'9.2.0';
  const oldCandidate=JSON.parse(readFileSync(new URL('../channels/candidates/0.0.20.json',import.meta.url)));
  // Historical product compatibility bytes coexist, but are never the selected
  //18 denominator. Keeping them reproduces the old genuine22/140 route bypass.
  for(const f of oldCandidate.product_files)bytes.set(f.path,readFileSync(new URL('../'+f.path,import.meta.url)));
  for(const p of routePublicInputs)if(p!=='catalog/libs-current-v2.json')bytes.set(p,readFileSync(new URL('../'+p,import.meta.url)));
  const put=(p,b)=>bytes.set(p,Buffer.from(b));
  const n=variant==='a'?{iface:'api',aux:'aux',run:'run',resource:'token',method:'bump',static:'zero',signal:'signal',noop:'noop',outcome:'outcome'}:{iface:'ops',aux:'second',run:'execute',resource:'other-token',method:'advance',static:'initial',signal:'notify',noop:'finish',outcome:'answer'};
  for(const [position,id]of routeTargets.entries()){
    const root=`current-libs/${id}/${version}`,identity=id==='wasmc-lib-search'?`wasmc:lib-search@${version}`:`fixture-${variant}:${id}@${version}`,skillPath=variant==='a'?'guide/SKILL.md':'docs/USE.md';
    const world=id==='wasmc-lib-search'?'search-index':`app-${variant}`;
    const extra=position===0?` ${n.noop}: func(); ${n.outcome}: func() -> result<u32>; `:'';
    const catalogInterface=id==='wasmc-lib-search'?'interface catalog { enum search-error { invalid-query, invalid-limit } record snapshot-info { format-version: u32, entry-count: u32, index-sha256: string } record query { text: string, include-historical: bool } record hit { identity: string, signature: string, skill-path: string, wit-path: string, artifact-path: string } snapshot: func() -> snapshot-info; search: func(query: query, offset: u32, limit: u32) -> result<list<hit>, search-error>; lookup: func(identity: string) -> option<hit>; }\n':'';
    const wit=Buffer.from(`package ${identity};\n${catalogInterface}interface ${n.iface} { ${n.run}: func(n: u32) -> u32; resource ${n.resource} { constructor(seed: u32); ${n.method}: func(step: u32) -> u32; ${n.static}: static func() -> u32; } ${extra} }\ninterface ${n.aux} { use ${n.iface}.{${n.resource}}; ${n.signal}: func(value: borrow<${n.resource}>,) -> u32; }\ninterface unused { hidden: func() -> u32; }\nworld ${world} { ${id==='wasmc-lib-search'?'export catalog; ':''}export ${n.iface}; export ${n.aux}; }\nworld ignored { export unused; }\n`);
    const skill=Buffer.from(`Synthetic ${variant} skill for ${id}; not a published grant.\n`),license=Buffer.from('Structural research fixture; not a distribution license.\n'),cargo=Buffer.from(`[package]\nname = "fixture-${id}"\nversion = "${version}"\nlicense-file = "../../LICENSE"\n`);
    const manifest={schema:'wasmc.lib/v2',id,version,wit:{path:'lib.wit',package:identity,world,sha256:routeSha(wit)},artifact:{path:'artifact.wasm',format:'core-wasm',bytes:8,sha256:routeSha(Buffer.from([0,97,115,109,1,0,0,0]))},agent:{skill:{path:skillPath,sha256:routeSha(skill)}},bindings:{rust_core:{cargo_toml:{path:'bindings/rust/Cargo.toml',sha256:routeSha(cargo)}}},license:{schema:'wasmc.lib-license/v1',identifier:'LicenseRef-Structural-Test',files:[{path:'LICENSE',bytes:license.length,sha256:routeSha(license)}]}};
    put(root+'/lib.wit',wit);put(root+'/'+skillPath,skill);put(root+'/LICENSE',license);put(root+'/bindings/rust/Cargo.toml',cargo);put(root+'/artifact.wasm',Buffer.from([0,97,115,109,1,0,0,0]));put(root+'/lib.json',jsonBytes(manifest));
    const row={id,version,root,wit_package:identity,wit_sha256:routeSha(wit),artifact_sha256:manifest.artifact.sha256,keywords:[`fixture-${variant}`],historical:false,files:[],...(id==='wasmc-std'?{companion:JSON.parse(readFileSync(new URL('../catalog/libs-current-v2.json',import.meta.url))).packages.find(p=>p.id==='wasmc-std').companion}: {})};packages.push(row);
    const common={skill_path:root+'/'+skillPath,wit_path:root+'/lib.wit',artifact_path:root+'/artifact.wasm',historical:false,package_identity:identity};
    expectedEntries.push({...common,identity,signature:'',search_text:`${identity} ${id} ${row.keywords.join(' ')}`});
    const api=(iface,key,signature)=>expectedEntries.push({...common,identity:`${identity}/${iface}#${key}`,signature,search_text:`${identity}/${iface}#${key} ${signature}`});
    api(n.iface,n.run,`${n.run}:func(n:u32)->u32`);api(n.iface,`[constructor]${n.resource}`,`[constructor]${n.resource}:func(seed:u32)->own<${n.resource}>`);api(n.iface,`[method]${n.resource}.${n.method}`,`[method]${n.resource}.${n.method}:func(self:borrow<${n.resource}>,step:u32)->u32`);api(n.iface,`[static]${n.resource}.${n.static}`,`[static]${n.resource}.${n.static}:func()->u32`);api(n.aux,n.signal,`${n.signal}:func(value:borrow<${n.resource}>)->u32`);
    if(position===0){api(n.iface,n.noop,`${n.noop}:func()->_`);api(n.iface,n.outcome,`${n.outcome}:func()->result<u32,_>`);}
    if(id==='wasmc-lib-search'){api('catalog','snapshot','snapshot:func()->snapshot-info');api('catalog','search','search:func(query:query,offset:u32,limit:u32)->result<list<hit>,search-error>');api('catalog','lookup','lookup:func(identity:string)->option<hit>');}
  }
  expectedEntries.sort((a,b)=>order(a.identity,b.identity));
  assertBound(expectedEntries.length===113,'independent18 plus95 API count');
  const indexPath=`examples/lib-search/fixture-current-${variant}.lsi`,receiptPath='admission/future-current-lib-routes.json',catalogPath='catalog/libs-current-v2.json',policyPath='catalog/current-v2-policy.json';
  const search=packages.find(p=>p.id==='wasmc-lib-search'),index=makeFixtureIndex(expectedEntries);put(indexPath,index);
  put(search.root+'/artifact.wasm',makeFixtureSearchCore(index,{version,entries:expectedEntries}));
  const catalog={schema:'wasmc.public-lib-catalog/v1',release_tag:`fixture-current-${variant}`,release_commit:(variant==='a'?'1':'2').repeat(40),packages};
  const candidate={schema:'wasmc.release-product-candidate/v2',version:'0.0.21',compiler_source_authority:'a'.repeat(40),lib_source_authority:'b'.repeat(40)};
  const read=p=>{if(!bytes.has(p))throw Error(`fixture file missing: ${p}`);return bytes.get(p);};
  const json=p=>JSON.parse(read(p));
  const write=(p,obj)=>put(p,jsonBytes(obj));
  function refresh(){
    candidate.product_files=[...bytes].map(([path,b])=>({path,bytes:b.length,sha256:routeSha(b)})).sort((a,b)=>order(a.path,b.path));candidate.product_set_sha256=routeSha(JSON.stringify(candidate.product_files));
    try{const selected=json(catalogPath);candidate.lib_license_admission={schema:'wasmc.future-lib-license-admission/v1',catalog:{path:catalogPath,sha256:routeSha(read(catalogPath))},targets:[...selected.packages].sort((a,b)=>order(a.id,b.id)).map(row=>{const m=json(row.root+'/lib.json');return {id:row.id,version:row.version,root:row.root,manifest_sha256:routeSha(read(row.root+'/lib.json')),license_sha256:routeSha(read(row.root+'/LICENSE')),license_files:m.license.files.length,license_bytes:m.license.files.reduce((n,f)=>n+f.bytes,0),rust_sdk_license_bound:true};}),all18_explicit_snapshots:true,legal_compatibility:false,dependency_notice_completeness:false,runtime_qualification:false};}catch{/* Negative missing-catalog/root fixtures preserve the last independent receipt. */}
  }
  function rebind({pin=true}={}){
    for(const row of catalog.packages){const m=json(row.root+'/lib.json');m.wit.sha256=routeSha(read(row.root+'/lib.wit'));m.artifact.bytes=read(row.root+'/'+m.artifact.path).length;m.artifact.sha256=routeSha(read(row.root+'/'+m.artifact.path));if(m.component&&bytes.has(row.root+'/'+m.component.path)){m.component.bytes=read(row.root+'/'+m.component.path).length;m.component.sha256=routeSha(read(row.root+'/'+m.component.path));}write(row.root+'/lib.json',m);row.wit_package=m.wit.package;row.wit_sha256=m.wit.sha256;row.artifact_sha256=m.artifact.sha256;row.files=[...bytes].filter(([p])=>p.startsWith(row.root+'/')).map(([path,b])=>({path,bytes:b.length,sha256:routeSha(b)})).sort((a,b)=>order(a.path,b.path));}
    write(catalogPath,catalog);
    const sm=json(search.root+'/lib.json'),receipt={schema:'wasmc.future-current-route-authority/v1',catalog:{path:catalogPath,sha256:routeSha(read(catalogPath)),release_tag:catalog.release_tag,release_commit:catalog.release_commit},index:{path:indexPath,bytes:read(indexPath).length,sha256:routeSha(read(indexPath))},search:{id:search.id,version:search.version,root:search.root,manifest:{path:search.root+'/lib.json',sha256:routeSha(read(search.root+'/lib.json'))},artifact:{path:search.root+'/'+sm.artifact.path,sha256:sm.artifact.sha256},...(sm.component?{component:{path:search.root+'/'+sm.component.path,sha256:sm.component.sha256}}: {})}};
    write(receiptPath,receipt);
    const policy=bytes.has(policyPath)?json(policyPath):{};Object.assign(policy,{schema:'wasmc.current-lib-policy/v1',catalog:catalogPath,package_authority_commit:catalog.release_commit});if(pin||!policy.future_route_authority)policy.future_route_authority={path:receiptPath,sha256:routeSha(read(receiptPath))};write(policyPath,policy);
    candidate.lib_route_closure={schema:'wasmc.release-candidate-lib-route-closure/v1',authority_receipt:{path:receiptPath,sha256:routeSha(read(receiptPath))},catalog:{path:catalogPath,sha256:routeSha(read(catalogPath))},search_index:{path:indexPath,sha256:routeSha(read(indexPath)),active_identity:search.wit_package},release_packages:18,package_routes:18,api_routes:95,candidate_extras:0,exact:true,candidate_extra_grants_release:false};refresh();
  }
  // An initial real policy is read only as product compatibility input; this
  // synthetic independent pin exists solely inside this private in-memory map.
  rebind();
  const setIndex=entries=>{put(indexPath,makeFixtureIndex(entries));return read(indexPath);};
  const rebuildSearch=(options={})=>put(search.root+'/artifact.wasm',makeFixtureSearchCore(read(indexPath),{version,entries:expectedEntries,...options}));
  return {candidate,bytes,refresh,read,json,write,put,rebind,setIndex,rebuildSearch,packages,catalog,expectedEntries,search,version,indexPath,receiptPath,catalogPath,policyPath,legacyClosure:structuredClone(oldCandidate.lib_route_closure),variant};
}
