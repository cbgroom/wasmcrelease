// Read-only archive-to-extracted-source audit; emits hashes, never source bodies.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFileSync,lstatSync,readdirSync,realpathSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {validateInventory} from './current-v2-dependency-inventory.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const ordered=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b))));
function real(path,directory=false){
  assert.equal(realpathSync(path),resolve(path),'linked registry path');
  const stat=lstatSync(path);assert(!stat.isSymbolicLink());
  assert(directory?stat.isDirectory():stat.isFile(),'unexpected registry input type');
}
// Fail closed outside the reviewed crates.io regular-file/GNU-longname tar subset.
export function archiveFiles(bytes,prefix){
  const tar=gunzipSync(bytes,{maxOutputLength:128*1024*1024}),files={};let long=null,ended=false;
  const text=b=>b.subarray(0,b.indexOf(0)<0?b.length:b.indexOf(0)).toString('utf8');
  for(let offset=0;offset+512<=tar.length;){
    const h=tar.subarray(offset,offset+512);offset+=512;
    if(h.every(b=>b===0)){assert(!long,'orphan longname');assert(tar.subarray(offset).every(b=>b===0),'trailing tar payload');ended=true;break;}
    const sizeText=text(h.subarray(124,136)).trim();assert.match(sizeText,/^[0-7]+$/);
    const size=parseInt(sizeText,8);assert(Number.isSafeInteger(size)&&size>=0&&offset+size<=tar.length);
    const body=tar.subarray(offset,offset+size);offset+=Math.ceil(size/512)*512;
    const type=h[156];
    if(type===76){assert.equal(long,null);long=text(body);continue;}
    assert(type===0||type===48,'unsupported archive entry type');
    const stem=text(h.subarray(0,100)),parent=text(h.subarray(345,500));
    const name=long??(parent?parent+'/'+stem:stem);long=null;
    assert(name.startsWith(prefix+'/'),'archive root drift');const path=name.slice(prefix.length+1);
    assert(path&&!path.startsWith('/')&&!path.includes('\\')&&path.split('/').every(p=>p&&p!=='.'&&p!=='..'),'unsafe archive path');
    assert(!Object.hasOwn(files,path),'duplicate archive path');files[path]={bytes:body.length,sha256:sha(body)};
  }
  assert(ended,'unterminated archive');return ordered(files);
}
export function auditRegistryCrate(crate,cache,source){
  assert.match(crate.name,/^[a-zA-Z0-9_-]+$/);assert.match(crate.version,/^[0-9][a-zA-Z0-9.+-]*$/);
  assert.match(crate.checksum,/^[a-f0-9]{64}$/);
  real(cache,true);real(source,true);const prefix=crate.name+'-'+crate.version;
  const archive=join(cache,prefix+'.crate');real(archive);
  const bytes=readFileSync(archive);assert.equal(sha(bytes),crate.checksum,'locked archive checksum drift');
  const expected=archiveFiles(bytes,prefix),base=join(source,prefix);real(base,true);
  const files={},directories=new Set();for(const path of Object.keys(expected)){
    const parts=path.split('/');for(let i=1;i<parts.length;i++)directories.add(parts.slice(0,i).join('/'));
  }
  const walk=(dir,path='')=>{for(const name of readdirSync(dir).sort()){
    const target=join(dir,name),rel=path+name,stat=lstatSync(target);assert(!stat.isSymbolicLink(),'linked extracted source');
    if(stat.isDirectory()){assert(directories.has(rel),'extra source directory');walk(target,rel+'/');}
    else{
      assert(stat.isFile(),'non-file extracted source');
      if(rel==='.cargo-ok'&&!Object.hasOwn(expected,rel)){
        assert.equal(stat.size,7);const data=readFileSync(target);
        assert.deepEqual(data,Buffer.from('{"v":1}'),'unexpected Cargo extraction marker');continue;
      }
      assert(Object.hasOwn(expected,rel),'extra extracted source');assert.equal(stat.size,expected[rel].bytes,'source size drift');
      const data=readFileSync(target);files[rel]={bytes:data.length,sha256:sha(data)};
    }
  }};walk(base);assert.deepEqual(ordered(files),expected,'extracted source differs from locked archive');
  return {name:crate.name,version:crate.version,archive_sha256:crate.checksum,
    source_files:Object.keys(expected).length,source_tree_sha256:sha(Buffer.from(JSON.stringify(expected)))};
}
export function captureRegistrySources(inventory,cache,source){
  validateInventory(inventory);const crates=inventory.crates.map(c=>auditRegistryCrate(c,cache,source));
  return {schema:'wasmc.current-v2-registry-source-witness/v1',scope:'conservative-locked-crates-archive-and-extracted-source',
    inventory_sha256:sha(Buffer.from(JSON.stringify(inventory))),crates,
    sha256:sha(Buffer.from(JSON.stringify(crates))),historical_builds_attested:false,release_qualified:false};
}
export function captureCargoRouting(cargoHome,workspace){
  real(cargoHome,true);real(workspace,true);
  for(const key of Object.keys(process.env))assert(!/^CARGO_(SOURCE_|REGISTRIES_|REGISTRY_)/.test(key),'unreviewed Cargo registry environment override');
  const config={};
  const check=(dir,prefix)=>{for(const name of ['config','config.toml']){
    const path=join(dir,name);if(!existsSync(path))continue;real(path);const bytes=readFileSync(path);
    assert(!/^\s*\[(source|registries|registry|patch)([.\]])/m.test(bytes.toString()),'unreviewed Cargo registry/source/patch configuration');
    assert(!/^\s*paths\s*=/m.test(bytes.toString()),'unreviewed Cargo path override');
    assert(!/CARGO_(SOURCE_|REGISTRIES_|REGISTRY_)/.test(bytes.toString()),'unreviewed Cargo registry environment configuration');
    // A finite reviewed profile, not a partial TOML parser. Quoted/dotted keys
    // must not bypass source routing checks. New config profiles need review.
    assert.equal(sha(bytes),'cfcc4d6056a0637c71868be9bbea3cc90ab503002d965f6045e8c19e14793097',
      'Cargo config outside the reviewed non-routing profile');
    config[prefix+'/'+name]={bytes:bytes.length,sha256:sha(bytes)};
  }};
  check(cargoHome,'cargo-home');
  for(const [start,label]of [[workspace,'workspace'],[realpathSync(tmpdir()),'temporary-adapter-parent']]){
    let dir=start,depth=0;for(;;){
      check(join(dir,'.cargo'),label+'-ancestor-'+depth++);
      if(dirname(dir)===dir)break;dir=dirname(dir);
    }
  }
  return {schema:'wasmc.retained-cargo-routing/v1',explicit_cargo_home:true,
    reviewed_registry_layout:'index.crates.io-1949cf8c6b5b557f',configs:ordered(config),temporary_adapter_contents_attested:false};
}
export function captureCargoRegistry(inventory,cargoHome,workspace){
  const routing=captureCargoRouting(cargoHome,workspace),index=routing.reviewed_registry_layout;
  return {...captureRegistrySources(inventory,join(cargoHome,'registry/cache',index),join(cargoHome,'registry/src',index)),
    routing};
}
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,4,'usage: current-v2-registry-source-witness.mjs CACHE_DIR SOURCE_DIR');
  const inventory=JSON.parse(readFileSync(join(root,'admission/current-v2-next/dependency-inventory.json')));
  console.log(JSON.stringify(captureRegistrySources(inventory,resolve(process.argv[2]),resolve(process.argv[3])),null,2));
}
