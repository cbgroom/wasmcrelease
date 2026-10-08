// Offline product-identity gate. This does not publish, sign or grant authority.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,relative,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkedCurrentCatalog,verifyCurrentRelease,currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {buildHistoricalClosure} from './lib-route-closure.mjs';
import {parseCatalog,resolveCatalog} from './lib-catalog.mjs';
import {instantiateLibSearch} from '../examples/lib-search/client.mjs';
import {all18Targets,needsFutureLibLicenseGate,validateFutureLibLicenses} from './future-lib-license-admission.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const safe=p=>typeof p==='string'&&p.split('/').every(x=>x&&x!=='.'&&x!=='..')&&!p.includes('\\')&&!p.startsWith('/');
const legacyV1ProductSets=Object.freeze({
  '0.0.10':'dd01d2fef9a4010e0bf4ed50f2fbf790a2771c92e4a4252bd6889441bc2059d8',
  '0.0.11':'101a8a3783d52fc3d06e15731b20ec5fbe5a2bdbd7d9e964876f76ce44e33662',
  '0.0.12':'6c5da874b9a3cce2beef0936fa761c45d5e33869db165a30e3e2984622b7bb6b',
  '0.0.13':'e2a1bb7e3bf30092ddda1313a9c20dd37a36e820b076bd64e0ac6ecec6ec36d0'
});
// Narrow delivery obligations, not all public tools or a legal-review oracle.
// Keep this inside the existing candidate tool: no new relative import may
// introduce another omitted dependency into historical product inventories.
const futureLibInputs=Object.freeze([
  'LICENSE','catalog/current-v2-policy.json','catalog/libs-current-v2.json',
  'examples/lib-search/client.mjs','license-policy.json',
  'scripts/declared-thirdparty-notices.mjs','scripts/future-lib-license-admission.mjs',
  'scripts/lib-catalog.mjs','scripts/lib-install.mjs','scripts/lib-route-closure.mjs',
  'scripts/release-candidate.mjs','scripts/wasmc-lib.mjs'
]);
export const futureLibProductInputs=version=>needsFutureLibLicenseGate(version)?[...futureLibInputs]:[];
function validateFutureLibProductInputs(candidate,read){
  const inventory=new Map(candidate.product_files.map(row=>[row.path,row]));
  for(const path of futureLibProductInputs(candidate.version)){
    const row=inventory.get(path);
    if(!row)throw Error(`future Lib product input missing: ${path}`);
    const bytes=read(path);
    if(!(bytes instanceof Uint8Array)||bytes.length!==row.bytes||hash(bytes)!==row.sha256)throw Error(`future Lib product input drift: ${path}`);
  }
}
// Deliberately separate from the frozen legacy parsers. This is a bounded
// selected-world route grammar, not a full compiler/WIT validation oracle.
const routeFail=message=>{throw Error(`future current Lib routes: ${message}`);};
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const text=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
const routeReceiptPath='admission/future-current-lib-routes.json';
const currentCatalogPath='catalog/libs-current-v2.json';
function futureRouteAuthority(read){
  const policy=JSON.parse(text(read('catalog/current-v2-policy.json'))),pin=policy.future_route_authority;
  if(policy.schema!=='wasmc.current-lib-policy/v1'||policy.catalog!==currentCatalogPath||!/^[0-9a-f]{40}$/.test(policy.package_authority_commit??'')||pin?.path!==routeReceiptPath||!digest(pin.sha256))routeFail('separately reviewed current-route authority pin required');
  const bytes=read(pin.path);
  if(hash(bytes)!==pin.sha256)routeFail('reviewed route receipt drift');
  const receipt=JSON.parse(text(bytes));
  if(receipt.schema!=='wasmc.future-current-route-authority/v1'||receipt.catalog?.path!==currentCatalogPath||!digest(receipt.catalog.sha256)||typeof receipt.catalog.release_tag!=='string'||!receipt.catalog.release_tag||receipt.catalog.release_commit!==policy.package_authority_commit||!safe(receipt.index?.path)||!digest(receipt.index?.sha256)||!Number.isSafeInteger(receipt.index?.bytes)||receipt.index.bytes<8||receipt.index.bytes>2097152)routeFail('route authority rejected');
  return {policy,pin,receipt};
}
export function futureLibRouteProductInputs(version,read){
  if(!needsFutureLibLicenseGate(version))return [];
  const {receipt}=futureRouteAuthority(read);
  return [routeReceiptPath,receipt.index.path];
}
function witTokens(bytes){
  if(bytes.length>1048576)routeFail('WIT byte bound');
  const source=text(bytes),tokens=[];let at=0;
  while(at<source.length){
    if(/\s/.test(source[at])){at++;continue;}
    if(source.startsWith('//',at)){const end=source.indexOf('\n',at+2);at=end<0?source.length:end+1;continue;}
    if(source.startsWith('/*',at)){at+=2;let depth=1;while(at<source.length&&depth){if(source.startsWith('/*',at)){depth++;at+=2;}else if(source.startsWith('*/',at)){depth--;at+=2;}else at++;}if(depth)routeFail('unclosed WIT comment');continue;}
    const match=/^(?:->|%?[A-Za-z_][A-Za-z0-9_-]*|[0-9]+|[{}()<>,:;=@.\[\]\/])/.exec(source.slice(at));
    if(!match)routeFail('unsupported WIT token');tokens.push(match[0]);if(tokens.length>131072)routeFail('WIT token bound');at+=match[0].length;
  }
  if(tokens.length>131072)routeFail('WIT token bound');return tokens;
}
const witName=value=>{if(!/^%?[A-Za-z][A-Za-z0-9-]*$/.test(value??''))routeFail('WIT name rejected');return value.replace(/^%/,'');};
function group(tokens,at,open,close){
  if(tokens[at]!==open)routeFail('WIT group required');
  const stack=[close],pairs={'{':'}','(':')','<':'>'};let end=at+1;
  for(;end<tokens.length&&stack.length;end++){
    const value=tokens[end];if(Object.hasOwn(pairs,value))stack.push(pairs[value]);else if(['}',')','>'].includes(value)){if(stack.pop()!==value)routeFail('WIT unbalanced');}
  }
  if(stack.length)routeFail('WIT unbalanced');return {body:tokens.slice(at+1,end-1),end};
}
function statements(tokens){
  const rows=[];let start=0,at=0;
  while(at<tokens.length){if(['{','(','<'].includes(tokens[at])){const close={'{':'}','(':')','<':'>'}[tokens[at]];at=group(tokens,at,tokens[at],close).end;}else if(tokens[at]===';'){rows.push(tokens.slice(start,at));start=++at;}else at++;}
  if(start!==tokens.length)routeFail('WIT statement terminator required');return rows;
}
function splitTypes(tokens){
  const rows=[];let start=0,at=0;
  while(at<tokens.length){if(['(','<'].includes(tokens[at]))at=group(tokens,at,tokens[at],tokens[at]==='('?')':'>').end;else if(tokens[at]===','){rows.push(tokens.slice(start,at));start=++at;}else at++;}
  if(start<tokens.length)rows.push(tokens.slice(start));return rows;
}
function witType(tokens,resources){
  let at=0;
  const parse=()=>{
    const name=tokens[at++];if(name==='_')return '_';const id=witName(name);
    if(tokens[at]!=='<')return name==='result'?'result<_,_>':resources.has(id)?`own<${id}>`:id;
    at++;const args=[];
    if(['own','borrow'].includes(id)){args.push(witName(tokens[at++]));}
    else {args.push(parse());while(tokens[at]===','){at++;args.push(parse());}}
    if(tokens[at++]!=='>')routeFail('WIT type unbalanced');
    const limits={list:[1,1],option:[1,1],result:[1,2],tuple:[1,64],own:[1,1],borrow:[1,1]};
    if(!Object.hasOwn(limits,id)||args.length<limits[id][0]||args.length>limits[id][1]||(['own','borrow'].includes(id)&&!resources.has(args[0])))routeFail('unsupported WIT type');
    if(id==='result'&&args.length===1)args.push('_');
    return `${id}<${args.join(',')}>`;
  };
  const result=parse();if(at!==tokens.length)routeFail('unsupported WIT type');return result;
}
function witFunction(tokens,resources,{name,resource=null,kind=null}){
  let at=0;if(kind==='constructor'){if(tokens[at++]!=='constructor')routeFail('WIT constructor required');}
  else {if(witName(tokens[at++])!==name||tokens[at++]!==':')routeFail('WIT function rejected');if(kind==='static'&&tokens[at++]!=='static')routeFail('WIT static required');if(tokens[at++]!=='func')routeFail('WIT func required');}
  const params=group(tokens,at,'(',')');at=params.end;const seen=new Set();
  const parameters=splitTypes(params.body).map(row=>{const id=witName(row[0]);if(row[1]!==':'||seen.has(id))routeFail('WIT parameter rejected');seen.add(id);return `${id}:${witType(row.slice(2),resources)}`;});
  if(kind==='method'){if(seen.has('self'))routeFail('WIT receiver collision');parameters.unshift(`self:borrow<${resource}>`);}
  let result='->_';
  if(kind==='constructor'){if(at!==tokens.length)routeFail('WIT constructor result rejected');result=`->own<${resource}>`;}
  else if(at<tokens.length){if(tokens[at++]!=='->')routeFail('WIT function result rejected');
    if(tokens[at]==='(')routeFail('unsupported named WIT results');
    result='->'+witType(tokens.slice(at),resources);at=tokens.length;
    if(at!==tokens.length)routeFail('WIT result trailing tokens');
  }
  return `${name}:func(${parameters.join(',')})${result}`;
}
function witModel(bytes){
  const tokens=witTokens(bytes),interfaces=new Map(),worlds=new Map();let at=0;
  if(tokens[at++]!=='package')routeFail('WIT package missing');const end=tokens.indexOf(';',at);if(end<0)routeFail('WIT package missing');
  const identity=tokens.slice(at,end).join('');if(!/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+@\d+\.\d+\.\d+$/.test(identity))routeFail('WIT package rejected');at=end+1;
  while(at<tokens.length){const kind=tokens[at++],name=witName(tokens[at++]);if(!['interface','world'].includes(kind))routeFail('unsupported WIT top-level declaration');const value=group(tokens,at,'{','}');at=value.end;const map=kind==='interface'?interfaces:worlds;if(map.has(name))routeFail('WIT duplicate declaration');map.set(name,value.body);}
  return {identity,interfaces,worlds,typeCache:new Map()};
}
function interfaceTypes(model,iface,models){
  if(model.typeCache.has(iface))return model.typeCache.get(iface);
  const body=model.interfaces.get(iface);if(!body)routeFail('WIT use interface missing');const types=new Map();model.typeCache.set(iface,types);let p=0;
  const add=(name,value)=>{if(types.has(name))routeFail('WIT duplicate type');types.set(name,value);};
  while(p<body.length){const start=p,kind=body[p];
    if(['resource','record','enum','variant','flags'].includes(kind)){p++;const name=witName(body[p++]);add(name,{kind:kind==='resource'?'resource':'value'});if(body[p]===';'&&kind==='resource')p++;else {p=group(body,p,'{','}').end;if(body[p]===';')p++;}}
    else {
      while(p<body.length&&body[p]!==';'){if(['{','(','<'].includes(body[p]))p=group(body,p,body[p],{'{':'}','(':')','<':'>'}[body[p]]).end;else p++;}if(body[p++]!==';')routeFail('WIT declaration terminator required');const row=body.slice(start,p-1);
      if(kind==='type'){const name=witName(row[1]);if(row[2]!=='=')routeFail('WIT alias rejected');add(name,{kind:'alias',target:row.slice(3)});}
      if(kind==='use'){
        const open=row.indexOf('{');if(open<2||row[open-1]!=='.')routeFail('WIT use rejected');const members=group(row,open,'{','}');if(members.end!==row.length)routeFail('WIT use trailing tokens');const path=row.slice(1,open-1).join('');let owner=model,sourceIface;
        if(row.slice(1,open-1).length===1)sourceIface=witName(row[1]);
        else {const match=/^([A-Za-z0-9_-]+:[A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)@(\d+\.\d+\.\d+)$/.exec(path);if(!match)routeFail('unsupported external WIT use');owner=models.get(`${match[1]}@${match[3]}`);sourceIface=match[2];if(!owner)routeFail('external WIT use must bind selected package identity');}
        for(const member of splitTypes(members.body)){const original=witName(member[0]),name=member.length===1?original:member.length===3&&member[1]==='as'?witName(member[2]):routeFail('WIT use member rejected');add(name,{kind:'use',owner,iface:sourceIface,original});}
      }
    }
  }
  return types;
}
function resourceType(model,iface,name,models,seen=new Set()){
  const key=`${model.identity}/${iface}/${name}`;if(seen.has(key))routeFail('cyclic WIT resource alias');seen.add(key);
  const value=interfaceTypes(model,iface,models).get(name);if(!value)routeFail('WIT imported type missing');
  if(value.kind==='resource')return true;
  if(value.kind==='use')return resourceType(value.owner,value.iface,value.original,models,seen);
  if(value.kind==='alias'&&value.target.length===1){const target=witName(value.target[0]);if(interfaceTypes(model,iface,models).has(target))return resourceType(model,iface,target,models,seen);}
  return false;
}
function selectedWitRoutes(model,worldName,models){
  const {identity,interfaces,worlds}=model;
  const world=worlds.get(witName(worldName));if(!world)routeFail('selected WIT world missing');
  const exports=new Set();for(const declaration of statements(world)){
    if(declaration[0]==='import'){if(declaration.length<2)routeFail('WIT import rejected');continue;}
    if(declaration[0]!=='export'||declaration.length!==2)routeFail('unsupported selected WIT export');const name=witName(declaration[1]);if(exports.has(name)||!interfaces.has(name))routeFail('selected WIT interface missing/duplicate');exports.add(name);
  }
  if(!exports.size)routeFail('selected WIT exports missing');const routes=new Map();
  for(const iface of exports){const body=interfaces.get(iface),resources=new Set([...interfaceTypes(model,iface,models).keys()].filter(name=>resourceType(model,iface,name,models))),decls=[];let p=0;
    while(p<body.length){const start=p;
      if(['resource','record','enum','variant','flags'].includes(body[p])){
        const kind=body[p++],name=witName(body[p++]);
        if(body[p]===';'&&kind==='resource'){p++;continue;}
        const value=group(body,p,'{','}');p=value.end;if(body[p]===';')p++;if(kind==='resource')decls.push({resource:name,body:value.body});
      }else {
        while(p<body.length&&body[p]!==';'){if(['{','(','<'].includes(body[p]))p=group(body,p,body[p],{'{':'}','(':')','<':'>'}[body[p]]).end;else p++;}
        if(body[p++]!==';')routeFail('WIT interface terminator required');const row=body.slice(start,p-1);
        if(!['use','type'].includes(row[0]))decls.push({tokens:row});
      }
    }
    const add=(name,signature)=>{const key=`${identity}/${iface}#${name}`;if(routes.has(key))routeFail('WIT duplicate API');routes.set(key,signature);};
    for(const declaration of decls){
      if(declaration.resource){for(const row of statements(declaration.body)){const constructor=row[0]==='constructor';const kind=constructor?'constructor':row[2]==='static'?'static':'method';const method=constructor?null:witName(row[0]),name=constructor?`[constructor]${declaration.resource}`:`[${kind}]${declaration.resource}.${method}`;add(name,witFunction(row,resources,{name:constructor?name:method,resource:declaration.resource,kind}).replace(/^[^:]+:/,`${name}:`));}}
      else {const name=witName(declaration.tokens[0]);add(name,witFunction(declaration.tokens,resources,{name}));}
    }
  }
  return {identity,routes};
}
function strictLsi(bytes){
  const b=Buffer.from(bytes);if(b.length<8||b.length>2097152||b.subarray(0,4).toString('ascii')!=='LSI1')routeFail('LSI header rejected');
  const strings=b.readUInt16LE(4),count=b.readUInt16LE(6),rows=8+(strings+1)*4,pool=rows+count*15;
  if(!strings||!count||count>16384||pool>b.length||b.length-pool>1048576)routeFail('LSI bounds rejected');
  const offsets=Array.from({length:strings+1},(_,i)=>b.readUInt32LE(8+i*4));
  if(offsets[0]!==0||offsets.at(-1)!==b.length-pool||offsets.some((v,i)=>v>b.length-pool||(i&&v<offsets[i-1])))routeFail('LSI offsets/trailing bytes rejected');
  const values=[];let previous;
  for(let i=0;i<strings;i++){const raw=b.subarray(pool+offsets[i],pool+offsets[i+1]);if(raw.length>4096||(previous&&Buffer.compare(previous,raw)>=0))routeFail('LSI strings rejected');values.push(text(raw));previous=raw;}
  const seen=new Set(),entries=[];let previousIdentity;
  for(let i=0;i<count;i++){const base=rows+i*15,flags=b[base],parent=b.readUInt16LE(base+1);if(flags>1||parent>=count)routeFail('LSI kind/parent rejected');const fields=Array.from({length:6},(_,k)=>{const id=b.readUInt16LE(base+3+k*2);if(id>=strings)routeFail('LSI string ID rejected');return values[id];});const [identity,signature,search_text,skill_path,wit_path,artifact_path]=fields;const identityBytes=Buffer.from(identity);if(!identity||seen.has(identity)||(previousIdentity&&Buffer.compare(previousIdentity,identityBytes)>=0))routeFail('LSI duplicate/unsorted/empty identity');previousIdentity=identityBytes;seen.add(identity);entries.push({flags,parent,identity,signature,search_text,skill_path,wit_path,artifact_path});}
  for(let i=0;i<entries.length;i++){const e=entries[i],p=entries[e.parent];if(e.flags===0?(e.parent!==i||e.signature!==''):(p.flags!==0||!e.signature||!e.identity.startsWith(p.identity+'/')))routeFail('LSI API parent closure rejected');}
  return entries;
}
function executeSearch(core,manifest,index,entries){
  // Run the same carried typed consumer in a disposable Node process. A Core
  // loop/trap cannot hang the synchronous gate. No package filesystem fallback.
  const probe=`import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';const instantiateLibSearch=${instantiateLibSearch.toString()};const x=JSON.parse(readFileSync(0,'utf8'));const a=instantiateLibSearch(Buffer.from(x.core,'base64'),x.pins);assert.deepEqual(a.snapshot(),{format_version:1,entry_count:x.rows.length,index_sha256:x.pins.index_sha256});for(const row of x.rows)assert.deepEqual(a.lookup(row.identity),row);assert.equal(a.lookup('__wasmc_missing_route__'),null);for(const include_historical of [false,true]){let actual=[];for(let offset=0;offset<=x.rows.length;offset+=64){const result=a.search({text:'',include_historical},offset,64);assert.ok(result.ok);actual.push(...result.ok);if(result.ok.length<64)break;}assert.deepEqual(actual,x.rows);}console.log(JSON.stringify({accepted:true,entries:x.rows.length,lookups:x.rows.length,paginated_searches:2}));`;
  const rows=entries.map(({identity,signature,skill_path,wit_path,artifact_path})=>({identity,signature,skill_path,wit_path,artifact_path}));
  const result=spawnSync(process.execPath,['--wasm-max-mem-pages=1024','--max-old-space-size=128','--input-type=module','-e',probe],{input:JSON.stringify({core:Buffer.from(core).toString('base64'),pins:{artifact_sha256:manifest.artifact.sha256,index_sha256:index.sha256,wit_package:manifest.wit.package},rows}),encoding:'utf8',timeout:10000,killSignal:'SIGKILL',maxBuffer:2097152,env:{...process.env,NODE_OPTIONS:''}});
  if(result.error||result.signal||result.status!==0)routeFail(`actual Search Core rejected (${result.error?.code??result.signal??result.status}): ${(result.stderr??'').slice(0,2048)}`);
  const observation=JSON.parse(result.stdout);if(observation.accepted!==true||observation.entries!==entries.length)routeFail('Search observation rejected');
}
export function buildFutureCurrentClosure(candidate,read){
  if(!Array.isArray(candidate.product_files)||candidate.product_files.length>10000)routeFail('bounded product inventory required');
  const inventory=new Map();for(const row of candidate.product_files){if(!safe(row.path)||inventory.has(row.path)||!digest(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<=0)routeFail('unique product identity required');inventory.set(row.path,row);}
  const exact=path=>{const row=inventory.get(path);if(!row)routeFail(`inventoried input required: ${path}`);const b=read(path);if(!(b instanceof Uint8Array)||b.length!==row.bytes||hash(b)!==row.sha256)routeFail(`input drift: ${path}`);return b;};
  const {pin,receipt}=futureRouteAuthority(exact),catalogBytes=exact(currentCatalogPath);
  if(hash(catalogBytes)!==receipt.catalog.sha256)routeFail('selected catalog drift');
  const authority={release_tag:receipt.catalog.release_tag,release_commit:receipt.catalog.release_commit},catalog=parseCatalog(catalogBytes,authority);
  if(JSON.stringify(catalog.packages.map(row=>row.id).sort())!==JSON.stringify(all18Targets))routeFail('original18 selected identities required');
  const expected=new Map(),roots=new Set(),manifests=new Map();
  const models=new Map();for(const row of catalog.packages){const model=witModel(exact(`${row.root}/lib.wit`));if(model.identity!==row.wit_package||models.has(model.identity))routeFail('WIT package model identity drift');models.set(model.identity,model);}
  for(const row of catalog.packages){
    if(row.root!==`current-libs/${row.id}/${row.version}`||row.historical||roots.has(row.root))routeFail('current exact root required');roots.add(row.root);
    resolveCatalog(catalogBytes,{catalog_sha256:receipt.catalog.sha256,id:row.id,version:row.version,wit_sha256:row.wit_sha256,artifact_sha256:row.artifact_sha256},exact,authority);
    const files=new Map(row.files.map(f=>[f.path,f])),manifest=JSON.parse(text(exact(`${row.root}/lib.json`)));
    const bound=(file,format)=>{if(!file||!safe(file.path)||!digest(file.sha256)||(format&&file.format!==format))routeFail('manifest file pin required');const path=`${row.root}/${file.path}`,b=exact(path),f=files.get(path);if(!f||f.bytes!==b.length||f.sha256!==hash(b)||file.sha256!==hash(b)||(file.bytes!==undefined&&file.bytes!==b.length))routeFail('manifest/catalog file drift');return {path,bytes:b};};
    if(manifest.schema!=='wasmc.lib/v2'||!manifest.agent?.skill)routeFail('selected v2 Skill required');
    if((manifest.bindings?.rust_component||files.has(`${row.root}/component.wasm`)||inventory.has(`${row.root}/component.wasm`))&&!manifest.component)routeFail('declared/carried Component manifest pin required');
    const skill=bound(manifest.agent.skill),wit=bound(manifest.wit),artifact=bound(manifest.artifact,'core-wasm');if(manifest.component)bound(manifest.component,'component-wasm');
    const parsed=selectedWitRoutes(models.get(row.wit_package),manifest.wit.world,models);if(parsed.identity!==row.wit_package||!parsed.identity.endsWith('@'+row.version))routeFail('selected WIT identity drift');
    const paths={skill_path:skill.path,wit_path:wit.path,artifact_path:artifact.path};
    if(expected.has(parsed.identity))routeFail('duplicate WIT identity');expected.set(parsed.identity,{signature:'',search_text:`${parsed.identity} ${row.id} ${row.keywords.join(' ')}`,...paths});
    for(const [identity,signature]of parsed.routes){if(expected.has(identity))routeFail('duplicate API identity');expected.set(identity,{signature,search_text:identity+' '+signature,...paths});}
    manifests.set(row.id,{row,manifest,artifact});
  }
  // Additional current manifests cannot hide an unselected release package.
  for(const path of inventory.keys())if(/^current-libs\/[^/]+\/[^/]+\/lib\.json$/.test(path)&&!roots.has(path.slice(0,-9)))routeFail('unselected current package');
  const search=receipt.search,selected=manifests.get('wasmc-lib-search');
  if(search?.id!=='wasmc-lib-search'||search.version!==selected.row.version||search.root!==selected.row.root||selected.manifest.wit.package!==`wasmc:lib-search@${search.version}`)routeFail('active Search must be selected inside original18');
  const pinned=(pin,path)=>{if(pin?.path!==path||!digest(pin.sha256)||hash(exact(path))!==pin.sha256)routeFail('active Search pin drift');};
  pinned(search.manifest,`${search.root}/lib.json`);pinned(search.artifact,selected.artifact.path);
  if(selected.manifest.component)pinned(search.component,`${search.root}/${selected.manifest.component.path}`);else if(search.component)routeFail('undeclared Search Component');
  const indexBytes=exact(receipt.index.path);if(indexBytes.length!==receipt.index.bytes||hash(indexBytes)!==receipt.index.sha256)routeFail('selected LSI drift');
  const entries=strictLsi(indexBytes);if(entries.length!==expected.size)routeFail('exact package/API route count required');
  let packages=0;for(const entry of entries){const row=expected.get(entry.identity);if(!row)routeFail('extra/unselected route');for(const key of ['signature','search_text','skill_path','wit_path','artifact_path'])if(entry[key]!==row[key])routeFail(`route ${key} drift`);if(entry.flags===0){packages++;if(entry.signature!=='')routeFail('package kind drift');}else if(entry.signature==='')routeFail('API kind drift');}
  if(packages!==18)routeFail('exact18 package routes required');
  executeSearch(selected.artifact.bytes,selected.manifest,receipt.index,entries);
  return {schema:'wasmc.release-candidate-lib-route-closure/v1',authority_receipt:{path:pin.path,sha256:pin.sha256},catalog:{path:receipt.catalog.path,sha256:receipt.catalog.sha256},search_index:{path:receipt.index.path,sha256:receipt.index.sha256,active_identity:selected.manifest.wit.package},release_packages:18,package_routes:packages,api_routes:entries.length-packages,candidate_extras:0,exact:true,candidate_extra_grants_release:false};
}
export function validateCandidate(candidate,read) {
  if(!['wasmc.release-product-candidate/v1','wasmc.release-product-candidate/v2','wasmc.release-product-candidate/v3'].includes(candidate.schema)||!/^\d+\.\d+\.\d+$/.test(candidate.version))throw Error('candidate schema/version rejected');
  if(candidate.schema==='wasmc.release-product-candidate/v1'&&legacyV1ProductSets[candidate.version]!==candidate.product_set_sha256)throw Error('legacy v1 candidate identity rejected; new candidates require v2 Lib route closure');
  for(const key of ['compiler_source_authority','lib_source_authority'])if(!/^[0-9a-f]{40}$/.test(candidate[key]))throw Error('exact private source authority required');
  const rows=candidate.product_files;
  if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('product inventory rejected');
  let previous='';
  for(const row of rows) {
    if(!safe(row.path)||row.path<=previous||!Number.isSafeInteger(row.bytes)||row.bytes<=0||!/^[0-9a-f]{64}$/.test(row.sha256))throw Error('product row rejected');
    const bytes=read(row.path);if(bytes.length!==row.bytes||hash(bytes)!==row.sha256)throw Error('product drift rejected');previous=row.path;
  }
  if(candidate.product_set_sha256!==hash(JSON.stringify(rows)))throw Error('product set identity rejected');
  if(candidate.schema==='wasmc.release-product-candidate/v2'){
    const closure=candidate.lib_route_closure;
    if(closure?.schema!=='wasmc.release-candidate-lib-route-closure/v1'||!safe(closure.authority_receipt?.path)||!/^[0-9a-f]{64}$/.test(closure.authority_receipt?.sha256??'')||!safe(closure.catalog?.path)||!/^[0-9a-f]{64}$/.test(closure.catalog?.sha256??'')||!safe(closure.search_index?.path)||!/^[0-9a-f]{64}$/.test(closure.search_index?.sha256??'')||!Number.isSafeInteger(closure.release_packages)||closure.release_packages<1||!Number.isSafeInteger(closure.package_routes)||closure.package_routes!==closure.release_packages||!Number.isSafeInteger(closure.api_routes)||closure.api_routes<1||closure.candidate_extras!==0||closure.exact!==true||closure.candidate_extra_grants_release!==false)throw Error('candidate Lib route closure rejected');
  }
  if(candidate.schema==='wasmc.release-product-candidate/v3'){
    assert.deepEqual(candidate.current_release_closure,currentCandidateClosure(candidate,read),'current42 candidate closure drift');
  }else if(needsFutureLibLicenseGate(candidate.version)){
    validateFutureLibProductInputs(candidate,read);
    const checked=validateFutureLibLicenses(candidate,read);
    if(JSON.stringify(candidate.lib_license_admission)!==JSON.stringify(checked))throw Error('future candidate license receipt rejected');
    assert.deepEqual(candidate.lib_route_closure,buildFutureCurrentClosure(candidate,read),'future candidate current route closure drift');
  }
  return true;
}

function closureSummary(model){
  return {
    schema:'wasmc.release-candidate-lib-route-closure/v1',
    authority_receipt:model.authority_receipt,
    catalog:{path:model.catalog.path,sha256:model.catalog.sha256},
    search_index:{path:model.search_index.path,sha256:model.search_index.sha256,active_identity:model.search_index.active_identity},
    release_packages:model.release_bindings.length,
    package_routes:model.search_index.package_routes,
    api_routes:model.search_index.api_routes,
    candidate_extras:model.candidate_extras.length,
    exact:model.claims.release_catalog_exact&&model.claims.release_package_routes_exact&&model.claims.release_api_routes_exact&&model.claims.api_parents_closed,
    candidate_extra_grants_release:false
  };
}

function candidateClosure(candidate,read){
  if(candidate.schema==='wasmc.release-product-candidate/v3')return currentCandidateClosure(candidate,read);
  if(needsFutureLibLicenseGate(candidate.version))return buildFutureCurrentClosure(candidate,read);
  return closureSummary(buildHistoricalClosure(undefined,{
    release:{version:candidate.version,tag:`v${candidate.version}`,staged_product_manifest:null},
    stagedProduct:candidate
  }));
}
export function validateTransition(previous,next,candidate) {
  if(next.schema!=='wasmc.release-stage/v1'||next.version!==candidate.version||next.product_set_sha256!==candidate.product_set_sha256||!/^[0-9a-f]{40}$/.test(next.product_candidate_commit))throw Error('stage identity rejected');
  const suffix=next.stage==='prod'?'':next.stage==='dev'?'-dev.':next.stage==='main'?'-main.':null;
  if(suffix===null||!(suffix===''?next.tag===`v${next.version}`:new RegExp(`^v${next.version.replaceAll('.','\\.')}${suffix.replace('.','\\.')}[1-9][0-9]*$`).test(next.tag)))throw Error('stage tag rejected');
  if(next.stage==='dev'){if(previous!==null)throw Error('dev must begin a new candidate');return true;}
  if(!previous||previous.version!==next.version||previous.product_set_sha256!==next.product_set_sha256||previous.product_candidate_commit!==next.product_candidate_commit||previous.stage!==(next.stage==='main'?'dev':'main'))throw Error('promotion cannot rebuild or skip stages');
  if(next.qualification?.accepted!==true||next.qualification?.lib_search_result!=='success'||next.qualification?.full_consumer_result!=='success'||next.qualification?.tested_product_set_sha256!==candidate.product_set_sha256||!/^[0-9a-f]{40}$/.test(next.qualification?.tested_source_commit))throw Error('exact successful qualification required');
  return true;
}
function walk(directory) {
  return readdirSync(resolve(root,directory)).sort().flatMap(name=>{
    if(['target','.DS_Store'].includes(name))return [];
    const path=`${directory}/${name}`,s=lstatSync(resolve(root,path));
    if(s.isSymbolicLink())throw Error('product symlink rejected');
    return s.isDirectory()?walk(path):[path];
  });
}

export const currentV3ProductInputs=Object.freeze([
  'LICENSE','catalog/current-v3-license-policy.json','scripts/current-license-policy-v3.mjs','compatibility/core-artifacts-v021.json','current/compiler-release.json','catalog/libs-current-v2.json','catalog/current-index-v2.json','libspec/registry.json',
  'admission/current-refresh-cohort-v2.json','admission/current-product-v3.json',
  'scripts/current-lib-release-v3.mjs','scripts/current-lib-search-v3.mjs',
  'scripts/current-core-value-codec-v3.mjs','scripts/current-wit-routes-v3.mjs',
  'scripts/lib-install.mjs','scripts/wasmc-lib.mjs'
]);
export function currentCandidateClosure(candidate,read){
  const rows=new Map(candidate.product_files.map(r=>[r.path,r]));
  const exact=path=>{
    const row=rows.get(path);if(!row)throw Error('current product input missing: '+path);
    const bytes=read(path);if(bytes.length!==row.bytes||hash(bytes)!==row.sha256)throw Error('current product input drift: '+path);
    return bytes;
  };
  for(const path of currentV3ProductInputs)exact(path);
  const catalogBytes=exact('catalog/libs-current-v2.json');
  if(candidate.current_catalog?.path!=='catalog/libs-current-v2.json'||hash(catalogBytes)!==candidate.current_catalog.sha256)throw Error('current catalog independent candidate pin');
  const catalog=checkedCurrentCatalog(catalogBytes,candidate.current_catalog.sha256);
  if(catalog.version!==candidate.version)throw Error('current catalog release version drift');
  const compiler=JSON.parse(exact('current/compiler-release.json'));
  if(compiler.schema!=='wasmc.current-compiler/v2'||compiler.version!==candidate.version||
     compiler.source_commit!==candidate.compiler_source_authority||compiler.source_branch!=='master')
    throw Error('canonical compiler source/version authority drift');
  const raw=exact('current/wasmc_compiler.wasm');
  if(hash(raw)!==compiler.compiler.sha256||raw.length!==compiler.compiler.bytes||raw.length>2097152)
    throw Error('compiler identity or byte budget drift');
  if(WebAssembly.Module.imports(new WebAssembly.Module(raw)).length)throw Error('compiler imports forbidden');
  const binaries=[],embeddings=[];
  for(const [path]of rows){
    if(path.endsWith('.wasm')){
      const bytes=exact(path);let module;try{module=new WebAssembly.Module(bytes);}catch{continue;}
      if(WebAssembly.Module.exports(module).some(e=>e.name==='wasmc_compile')){
        if(hash(bytes)!==compiler.compiler.sha256)throw Error('obsolete compiler '+path);binaries.push(path);
      }
    }else if(/\.(mjs|js)$/.test(path)){
      for(const m of exact(path).toString().matchAll(/function decodeEmbeddedCompiler\(\) \{\s*const binary = atob\("([A-Za-z0-9+/=]+)"\);/g)){
        if(hash(Buffer.from(m[1],'base64'))!==compiler.compiler.sha256)throw Error('obsolete embedding '+path);embeddings.push(path);
      }
    }
  }
  assert.deepEqual(binaries.sort(),['current/wasmc_compiler.wasm','runtime/wasmc-runtime-v0/compiler.wasm']);
  assert.deepEqual(embeddings.sort(),['current/wasmc.global.js','current/wasmc.mjs','dist/wasmc.global.js']);
  assert.equal(compiler.active_compiler_versions,1);
  for(const pin of compiler.artifacts){const bytes=exact(pin.path);if(bytes.length!==pin.bytes||hash(bytes)!==pin.sha256)throw Error('compiler manifest artifact drift '+pin.path);}
  const closure=verifyCurrentRelease(catalogBytes,candidate.current_catalog.sha256,exact,[...rows.keys()]);
  return{...closure,compiler_manifest_sha256:hash(exact('current/compiler-release.json')),
    compiler_sha256:compiler.compiler.sha256,compiler_source_commit:compiler.source_commit,
    canonical_source_branch:compiler.source_branch,compiler_build_receipt_sha256:compiler.source_build_receipt_sha256,
    compiler_carriers:{binaries,embeddings},active_compiler_versions:1};
}
export async function createCurrentCandidate(repo,{compilerSource,libSource,version,currentOptions}){
  const {requireCurrentReleaseCohort}=await import('./lib-current-release-preflight.mjs');
  const preflight=await requireCurrentReleaseCohort(repo,currentOptions);
  const read=path=>readFileSync(resolve(repo,path));
  const walk=p=>readdirSync(resolve(repo,p)).sort().flatMap(n=>{
    if(['target','.DS_Store'].includes(n))return [];
    const path=p+'/'+n,s=lstatSync(resolve(repo,path));
    if(s.isSymbolicLink()||!s.isFile()&&!s.isDirectory())throw Error('linked/nonregular product input');
    return s.isDirectory()?walk(path):[path];
  });
  const catalogBytes=read('catalog/libs-current-v2.json'),catalog=checkedCurrentCatalog(catalogBytes,hash(catalogBytes));
  const directories=['current','dist','package','examples/current','examples/base64','examples/agent-quickstart','standard','sdk','runtime','current-libs','licenses',
    'skills',
    'host/contract','host/sdk','host/drivers/file/rust','host/drivers/memory/rust'];
  const paths=new Set([...currentV3ProductInputs,...directories.flatMap(walk),
    'AGENTS.md','README.md','HOSTING.md','LANGUAGE.md','LIB.md','license-policy.json',
    'agent-quickstart.json','release-surfaces.json','agent-evaluation/fresh-agent-learning-v2.json','docs/AGENT_DECISION_MODEL.md','docs/RELEASE_V021.md','scripts/release-candidate.mjs']);
  for(const row of catalog.packages)for(const pin of Object.values(row.source))paths.add(pin.path);
  const addImports=path=>{
    const source=read(path).toString('utf8');
    for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g)){
      const target=relative(repo,resolve(repo,dirname(path),match[1])).split('\\').join('/');
      if(!safe(target))throw Error('module import path outside product');
      if(paths.has(target))continue;paths.add(target);if(target.endsWith('.mjs')||target.endsWith('.js'))addImports(target);
    }
  };
  for(const path of [...paths])if(path.endsWith('.mjs')||path.endsWith('.js'))addImports(path);
  const product_files=[...paths].sort().map(path=>{const b=read(path);return{path,bytes:b.length,sha256:hash(b)};});
  const candidate={schema:'wasmc.release-product-candidate/v3',version,
    compiler_source_authority:compilerSource,lib_source_authority:libSource,
    current_catalog:{path:'catalog/libs-current-v2.json',sha256:hash(catalogBytes)},
    product_files,product_set_sha256:hash(JSON.stringify(product_files))};
  candidate.current_release_closure=currentCandidateClosure(candidate,read);
  if(candidate.current_release_closure.refresh_receipt_sha256!==currentOptions.receipt_sha256||
     candidate.current_release_closure.producer_sha256!==currentOptions.producer_sha256)throw Error('independent creation cohort identity drift');
  validateCandidate(candidate,read);return candidate;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [command,path,source,libSourceOrVersion,explicitVersion,...currentArgs]=process.argv.slice(2);
  const read=p=>readFileSync(resolve(root,p));
  if(command==='create-current'){
    const {currentReleaseArguments}=await import('./lib-current-release-preflight.mjs');
    const candidate=await createCurrentCandidate(root,{compilerSource:source,libSource:libSourceOrVersion,version:explicitVersion,currentOptions:currentReleaseArguments(currentArgs)});
    writeFileSync(path,JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({accepted:true,schema:candidate.schema,product_set_sha256:candidate.product_set_sha256}));
  }else if(command==='create') {
    const compilerSource=explicitVersion===undefined?'e69abb73f667f3810b0c40937fd1a1e2d04d4255':source;
    const libSource=explicitVersion===undefined?source:libSourceOrVersion;
    const version=explicitVersion===undefined?libSourceOrVersion:explicitVersion;
    if(!/^[0-9a-f]{40}$/.test(compilerSource))throw Error('exact compiler source required');
    if(!/^[0-9a-f]{40}$/.test(libSource))throw Error('exact Lib source required');
    if(needsFutureLibLicenseGate(version)) {
      // New creation must first prove current source/Q0 closure. Historical
      // read-only candidate verification below remains byte-identity scoped.
      if(explicitVersion===undefined)throw Error('new product requires explicit compiler and Lib source authorities');
      const {currentReleaseArguments,requireCurrentReleaseCohort}=await import('./lib-current-release-preflight.mjs');
      await requireCurrentReleaseCohort(root,currentReleaseArguments(currentArgs));
    } else if(currentArgs.length)throw Error('unexpected candidate creation arguments');
    const productDirectories=[
      'current','standard','sdk','runtime','libs',
      ...(needsFutureLibLicenseGate(version)?['current-libs']:[]),
      'skills',
      'host/contract','host/sdk','host/drivers/file/rust','host/drivers/memory/rust'
    ];
    const carriesV019Compiler=['0.0.19','0.0.20'].includes(version);
    const releaseDocument=version==='0.0.20'?'docs/RELEASE_V020.md':version==='0.0.19'?'docs/RELEASE_V019.md':'docs/RELEASE_V018.md';
    const productFiles=[
      'AGENTS.md','README.md','HOSTING.md','LANGUAGE.md',
      'agent-quickstart.json','release-lib-route-readiness.json',
      ...(version==='0.0.20'?['LICENSE','license-policy.json']:[]),
      ...(carriesV019Compiler?['agent-evaluation/fresh-agent-learning-v2.json']:[]),
      'admission/lib-search-v040-v018-admission.json',
      ...(carriesV019Compiler?['admission/compiler-v019-u64-admission.json']:[]),
      'admission/data-foundation-v11/relational-v002-admission.json',
      'admission/mcpgit-resident-memory-v1/formal-admission.json',
      'catalog/libs-v018.json','catalog/discovery-intent-v018.json',
      'examples/lib-search/index-v018-v040.lsi',
      'host/ARCHITECTURE.md','host/architecture.json','host/manifest.json',
      'bench/manifest.json','bench/host-external-load.json',
      'docs/ASMD.md','docs/AGENT_DECISION_MODEL.md','docs/FRESH_AGENT_LEARNING_FLYWHEEL.md','docs/RELEASE_SURFACES.md',releaseDocument,'release-surfaces.json',
      'examples/lib-search/client.mjs',
      'scripts/wasmc-lib.mjs',
      'scripts/lib-catalog.mjs','scripts/lib-route-closure.mjs','scripts/release-candidate.mjs',
      'scripts/future-lib-license-admission.mjs',
      ...futureLibProductInputs(version),
      ...futureLibRouteProductInputs(version,read),
      'scripts/agent-guidance-contract.mjs',
      ...(carriesV019Compiler?['scripts/update-current-compiler.mjs']:[]),
      'scripts/test-agent-guidance.mjs',
      'scripts/validate-agent-docs.mjs',
      'scripts/validate-sdk-agent-routes.mjs',
      'skills/wasmc-lib/SKILL.md'
    ];
    const paths=[...new Set([...productDirectories.flatMap(walk),...productFiles])];
    const rows=paths.sort().map(path=>{const b=read(path);return {path,bytes:b.length,sha256:hash(b)};});
    const candidate={schema:'wasmc.release-product-candidate/v2',version,compiler_source_authority:compilerSource,lib_source_authority:libSource,product_files:rows,product_set_sha256:hash(JSON.stringify(rows))};
    if(needsFutureLibLicenseGate(version))candidate.lib_license_admission=validateFutureLibLicenses(candidate,read);
    candidate.lib_route_closure=candidateClosure(candidate,read);
    if(candidate.lib_route_closure.candidate_extras!==0)throw Error('release candidate blocked: active LibSearch must be inside the product, catalog and exact route set');
    if(candidate.schema==='wasmc.release-product-candidate/v3'){
      const exactRead=currentProductReader(root);
      assert.deepEqual(currentProductPaths(root),candidate.product_files.map(r=>r.path).filter(p=>p.startsWith('current-libs/')),'v3 actual current package inventory drift');
      validateCandidate(candidate,exactRead);
    }else validateCandidate(candidate,read);writeFileSync(path,JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});
  } else if(command==='verify') {
    const candidateBytes=readFileSync(path),candidate=JSON.parse(candidateBytes);
    if(candidate.schema==='wasmc.release-product-candidate/v3'){
      if(source!=='--candidate-sha256'||!digest(libSourceOrVersion)||explicitVersion!==undefined||hash(candidateBytes)!==libSourceOrVersion)throw Error('v3 reopen requires independent expected candidate SHA256');
    }
    if(candidate.schema==='wasmc.release-product-candidate/v3'){
      const exactRead=currentProductReader(root);
      assert.deepEqual(currentProductPaths(root),candidate.product_files.map(r=>r.path).filter(p=>p.startsWith('current-libs/')),'v3 actual current package inventory drift');
      validateCandidate(candidate,exactRead);
    }else validateCandidate(candidate,read);
    if(candidate.schema==='wasmc.release-product-candidate/v2')assert.deepEqual(candidate.lib_route_closure,candidateClosure(candidate,read),'candidate Lib route closure drift');
    console.log(JSON.stringify({accepted:true,products:candidate.product_files.length,product_set_sha256:candidate.product_set_sha256}));
  } else throw Error('usage: release-candidate.mjs create FILE COMPILER_SOURCE LIB_SOURCE VERSION --current-run ABSOLUTE_RUN --current-receipt-sha256 SHA256 --current-producer-sha256 SHA256 | verify FILE');
}
