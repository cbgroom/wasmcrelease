import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {LibDefinedBoundary} from '../../../../host/runtime/lib-boundary/reference.mjs';
const [root,output]=process.argv.slice(2);assert.ok(root&&output);
const dir=await mkdtemp(join(tmpdir(),'wasmc-file-refresh-'));
const boundary=new LibDefinedBoundary();let resource;
try {
  const large=Buffer.alloc(17*1024*1024+17);for(let i=0;i<large.length;i++)large[i]=i%251;
  const largePath=join(dir,'large.bin'),shortPath=join(dir,'unicode-雪');
  await writeFile(largePath,large,{flag:'wx'});await writeFile(shortPath,'fresh-雪',{flag:'wx'});
  resource=await boundary.install(resolve(root));
  async function invoke(path) {
    const window=boundary.acquireWindow(Buffer.from(path)),op=boundary.submit(resource,window);
    try {const [done]=await boundary.wait([op]);assert.equal(done.state,'completed');return boundary.claim(op).bytes;}
    finally {boundary.releaseOperation(op);boundary.releaseWindow(window);}
  }
  const returned=Buffer.from(await invoke(largePath));assert.deepEqual(returned,large);
  assert.equal(Buffer.from(await invoke(shortPath)).toString(),'fresh-雪');
  boundary.releaseResource(resource);resource=null;assert.deepEqual(boundary.counts(),{resources:0,windows:0,operations:0});
  const receipt={accepted:true,large_input_bytes:large.length,sha256:createHash('sha256').update(returned).digest('hex'),same_resource_fresh_input:true,final_counts:boundary.counts(),scope:'reference native boundary on local disposable file; not device or formal release'};
  await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
} finally {if(resource)boundary.releaseResource(resource);await rm(dir,{recursive:true,force:true});}
