// Authored dependency WIT and a producer's self-contained WIT are distinct
// byte identities. Prove their whole-graph normalization with one explicit,
// digest-pinned standard tool; do not erase types with a regex comparison.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha } from './lib-refresh-cache-v2.mjs';

export async function verifyWitClosure(source, dependencies, delivered, tool) {
  const author = sha(source), product = sha(delivered);
  if (!dependencies.length && author === product)
    return {mode:'exact-bytes',authored_sha256:author,delivered_sha256:product};
  assert.ok(tool && isAbsolute(tool.path) && /^[a-f0-9]{64}$/.test(tool.sha256),
    'normalized WIT requires an explicit absolute tool and independent SHA256');
  assert.equal(sha(await readFile(tool.path)),tool.sha256,'WIT normalization tool pin mismatch');
  const work = await mkdtemp(join(tmpdir(),'wasmc-wit-closure-'));
  try {
    const input=join(work,'source');await mkdir(input);
    await writeFile(join(input,'root.wit'),source);
    const names=new Set();
    for(const dependency of dependencies) {
      assert.match(dependency.id,/^[a-z0-9][a-z0-9-]*$/);
      assert.ok(!names.has(dependency.id),'duplicate dependency WIT');names.add(dependency.id);
      const path=join(input,'deps',dependency.id);await mkdir(path,{recursive:true});
      await writeFile(join(path,'root.wit'),dependency.bytes);
    }
    const output=join(work,'delivered.wit');await writeFile(output,delivered);
    const normalize=path=>{
      const result=spawnSync(tool.path,['component','wit',path,'--no-docs'],
        {timeout:30000,maxBuffer:4*1024*1024});
      if(result.error)throw result.error;
      assert.equal(result.status,0,'WIT normalization rejected: '+result.stderr.toString('utf8').slice(0,3000));
      assert.ok(result.stdout.length>0&&result.stdout.length<=2*1024*1024,'normalized WIT byte bound');
      return result.stdout;
    };
    const a=normalize(input),b=normalize(output);
    assert.equal(sha(a),sha(b),'authored dependency graph and delivered WIT differ');
    assert.equal(sha(await readFile(tool.path)),tool.sha256,'WIT tool changed during verification');
    return {mode:'standard-tool-normalization',authored_sha256:author,delivered_sha256:product,
      normalized_sha256:sha(a),tool:{...tool},dependencies:dependencies.map(d=>({id:d.id,sha256:sha(d.bytes)}))};
  } finally {await rm(work,{recursive:true,force:true});}
}
