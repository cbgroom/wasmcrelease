// Public-byte checks only; candidate creation separately verifies private Q0.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {currentProductReader,currentProductPaths} from './current-lib-release-v3.mjs';
import {verifyPublicJsonOverlayPinned} from './json-overlay-public-v1.mjs';

const opts={};const args=process.argv.slice(2);
for(let i=0;i<args.length;i+=2){assert.ok(['--product','--catalog-sha256','--out','--mode'].includes(args[i])&&!opts[args[i]]&&args[i+1]);opts[args[i]]=args[i+1];}
assert.ok(opts['--product']);assert.match(opts['--catalog-sha256']??'',/^[a-f0-9]{64}$/);
const mode=opts['--mode']??'product';assert.ok(['product','notices'].includes(mode));
const root=resolve(opts['--product']),read=currentProductReader(root),bytes=read('catalog/libs-current-v2.json');
const catalog=JSON.parse(bytes),paths=currentProductPaths(root),pin=opts['--catalog-sha256'];
const verify=(get=read,hash=pin,inventory=paths)=>verifyPublicJsonOverlayPinned(bytes,hash,get,inventory);
const result=verify();assert.equal(result.accepted,true);assert.equal(result.private_provenance_verified,false);assert.equal(result.release,false);
assert.throws(()=>verify(read,'0'.repeat(64)));
if(mode==='product'){
 assert.throws(()=>verify(read,pin,[...paths,'current-libs/unselected/0.0.0/lib.json']));
 for(const target of [catalog.index.path,catalog.packages[0].files[0].path,'admission/json-overlay-prior-catalog-v1.json']){
  const corrupt=p=>p===target?Buffer.concat([read(p),Buffer.from('x')]):read(p);assert.throws(()=>verify(corrupt));
 }
}else{
 let count=0,firstNotice;
 for(const row of catalog.packages){
  const manifest=JSON.parse(read(row.root+'/lib.json')),files=new Map(row.files.map(f=>[f.path,f]));
  assert.ok(Array.isArray(manifest.license?.files),'declared notices required');
  for(const declared of manifest.license.files){
   assert.ok(typeof declared.path==='string'&&!declared.path.startsWith('/')&&!declared.path.split('/').includes('..'));
   const path=row.root+'/'+declared.path,listed=files.get(path);assert.ok(listed,'notice in selected root inventory');
   assert.equal(listed.bytes,declared.bytes);assert.equal(listed.sha256,declared.sha256);
   firstNotice??=path;const b=read(path);assert.equal(b.length,declared.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),declared.sha256);count++;
  }
 }
 assert.ok(count>0,'declared notices required');
 const corrupt=p=>p===firstNotice?Buffer.concat([read(p),Buffer.from('x')]):read(p);assert.throws(()=>verify(corrupt));
 result.declared_notice_files=count;
}
console.log(JSON.stringify({...result,mode,scope:'public projection and declared bytes only; private Q0 and original notice provenance require separate candidate admission'}));
