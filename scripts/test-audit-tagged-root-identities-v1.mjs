import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {test} from 'node:test';
import {auditTaggedRoots} from './audit-tagged-root-identities-v1.mjs';
import {sha} from './lib-refresh-cache-v2.mjs';

test('tagged bytes are immutable and independently pinned',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'tagged-roots-'));
  try{
    const repo=join(temp,'repo'),product=join(temp,'product'),root='current-libs/example/1.0.0';
    await mkdir(join(repo,root),{recursive:true});await mkdir(join(product,root),{recursive:true});
    const files={'LICENSE':'license','lib.json':'original','lib.wit':'world'};
    for(const [name,value] of Object.entries(files)){await writeFile(join(repo,root,name),value);await writeFile(join(product,root,name),value);}
    const git=(...a)=>execFileSync('git',a,{cwd:repo,stdio:['ignore','pipe','pipe']}).toString().trim();
    git('init','-q');git('add','.');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture');git('tag','v0.0.1');
    const listing=Buffer.from(`${git('rev-parse','refs/tags/v0.0.1')}\trefs/tags/v0.0.1\n`),refsPath=join(temp,'refs');await writeFile(refsPath,listing);
    const desc=(path,value)=>({path,bytes:Buffer.byteLength(value),sha256:sha(Buffer.from(value))});
    const source={spec:desc('libspec/example/lib.json','source'),wit:desc('libspec/example/lib.wit','wit')};
    const row={id:'example',version:'1.0.0',profile:'value',target:'wasm32-unknown-unknown',root,
      manifest_sha256:sha(Buffer.from(files['lib.json'])),root_inventory_sha256:'a'.repeat(64),wit_sha256:sha(Buffer.from('world')),
      wit_world:'example',source,views:['rust_core'],delivery:{kind:'wasm-core-component',artifact:null,component:null,native_status:null,device_qualified:false},
      files:Object.entries(files).map(([name,value])=>desc(root+'/'+name,value)).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)};
    const catalog={schema:'wasmc.public-lib-catalog/v2',version:'0.0.31',package_authority_commit:'0'.repeat(40),
      registry:desc('libspec/registry.json','x'),index:desc('catalog/index.json','x'),cohort:desc('admission/cohort.json','x'),packages:[row]};
    const catalogPath=join(product,'catalog/libs-current-v2.json');await mkdir(dirname(catalogPath),{recursive:true});
    const save=async()=>{const b=Buffer.from(JSON.stringify(catalog));await writeFile(catalogPath,b);return sha(b);};
    let pin=await save(),options={repo,product,catalogSha:pin,refsPath,refsSha:sha(listing)};
    assert.equal((await auditTaggedRoots(options)).root_occurrences,1);
    await assert.rejects(auditTaggedRoots({...options,refsSha:'0'.repeat(64)}),/tag listing pin/);
    await writeFile(join(product,root,'lib.json'),'changed');row.files.find(f=>f.path===root+'/lib.json').sha256=sha(Buffer.from('changed'));
    row.files.find(f=>f.path===root+'/lib.json').bytes=7;row.manifest_sha256=sha(Buffer.from('changed'));pin=await save();
    await assert.rejects(auditTaggedRoots({...options,catalogSha:pin}),/tagged historical Root/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
