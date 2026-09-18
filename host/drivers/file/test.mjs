import { PreopenedFile } from './adapter.mjs';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = await mkdtemp(join(tmpdir(),'wasmc-preopened-'));
const tests = [
  {write:true,steps:[['read',0,4],['write',0,[1,2,3,255]],['read',0,4],['write',1,[42]],['read',0,4],['sync'],['read',64,0],['read',65,0],['read',-1,1],['write',63,[1,2]],['write',0,[256]],['release'],['read',0,1],['write',0,[1]],['sync'],['release']],expected:[{ok:[]},{ok:4},{ok:[1,2,3,255]},{ok:1},{ok:[1,42,3,255]},{ok:0},{ok:[]},{error:-5},{error:-5},{error:-5},{error:-5},{ok:0},{error:-1},{error:-1},{error:-1},{error:-1}]},
  {write:false,steps:[['write',0,[1]],['sync'],['read',0,1],['release']],expected:[{error:-2},{error:-2},{ok:[]},{ok:0}]},
];
try {
  for(let i=0;i<tests.length;i++) {
    const {write,steps,expected}=tests[i];
    const jsPath=join(root,`js-${i}`), nativePath=join(root,`native-${i}`);
    const host=new PreopenedFile(await open(jsPath,'wx+'),write);
    const rows=[];
    for(const [name,a,b] of steps) {
      try {
        let value;
        if(name==='read') value=await host.read(a,b);
        else if(name==='write') value=await host.write(a,b);
        else if(name==='sync') value=await host.invokeSync();
        else value=await host.release();
        rows.push({ok:value});
      } catch(error) { rows.push({error}); }
    }
    assert.deepEqual(rows,expected);
    const result=spawnSync(process.argv[2],[nativePath,write?'write':'read'],{env:{},input:JSON.stringify(steps),encoding:'utf8',timeout:30000});
    if(result.status!==0) throw Error(result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),expected);
    assert.deepEqual(await readFile(jsPath),await readFile(nativePath));
    const clobber=spawnSync(process.argv[2],[nativePath,'write'],{env:{},input:'[]',timeout:30000});
    assert.notEqual(clobber.status,0);
    assert.deepEqual(await readFile(jsPath),await readFile(nativePath));
  }
  console.log(JSON.stringify({accepted:true,real_file_io:true,operations:20,profiles:2,no_clobber:2,ambient_guest_paths:false}));
} finally { await rm(root,{recursive:true,force:true}); }
