import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {sha} from './lib-refresh-cache-v2.mjs';
import {stageQ0AuthoredSources} from './stage-q0-authored-sources-v1.mjs';

test('exact public Q0 source input staging and negative controls',async()=>{
  const temp=await mkdtemp(join(await realpath(tmpdir()),'q0-source-'));
  try{
    const repo=join(temp,'repo'),sourceRoot=join(temp,'source'),receiptPath=join(temp,'receipt.json');
    await mkdir(repo);await mkdir(join(sourceRoot,'libspec/example'),{recursive:true});
    const value=Buffer.from('public Rust delta\n');await writeFile(join(sourceRoot,'libspec/example/delta.rs'),value);
    const receipt={schema:'wasmc.lib-refresh-receipt/v2',accepted:true,source_digests:{'libspec/example/delta.rs':sha(value)}};
    const data=Buffer.from(JSON.stringify(receipt));await writeFile(receiptPath,data);
    const args={repo,sourceRoot,receiptPath,receiptSha:sha(data)};
    await assert.rejects(stageQ0AuthoredSources({...args,receiptSha:'0'.repeat(64)}),/receipt pin/);
    assert.equal((await stageQ0AuthoredSources(args)).changed,1);
    assert.deepEqual(await readFile(join(repo,'libspec/example/delta.rs')),value);
    assert.equal((await stageQ0AuthoredSources(args)).changed,0);
    await writeFile(join(sourceRoot,'libspec/example/delta.rs'),'changed');
    await assert.rejects(stageQ0AuthoredSources(args),/authored input drift/);
    assert.deepEqual(await readFile(join(repo,'libspec/example/delta.rs')),value);
  }finally{await rm(temp,{recursive:true,force:true});}
});
