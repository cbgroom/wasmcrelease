import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const sha=path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const immutable={
  'release.json':'2ecbb778c18910568aac6a5ee13b1e7195ad97d1aa8e461d309f688e561ec0e1',
  'manifest.json':'636ef557f95f2174c9c9495434a38ea3dd0396ae0db3d9ab03d806b75f4d128e',
  'provenance.json':'17cc0d77eaab05fdf3c87e7ece73423f5d97999de97ef62020c42c18eb44a76c',
  'package-index.json':'d60b3132304e2b2106da6a2e3d125924f434dc8dbd8396a1a41cc4f8b3ba4356',
  'channels/candidates/0.0.13.json':'a4a1390f91f8068a4fd1b5645f6af5910d40546b1ec96c0c5f60e1a2c4ab9f3a',
  'channels/prod.json':'9ff5b7f1d097d48207d10672d9dbf640726ed59d6be7bd984a7654395a2a6f7e',
  'catalog/libs-v009.json':'13fe84e7faf77467b45d97460e9cd9fa1ba7d17c17b0175fb16ce5d694c82d82',
};
for(const [path,expected] of Object.entries(immutable))assert.equal(sha(path),expected,path+' immutable identity drift');

function run(command,args){
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:32<<20});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(command+' '+args.join(' ')+' failed:\n'+result.stderr+'\n'+result.stdout);
  return result.stdout.trim();
}

run('node',['scripts/refresh-lib-catalog.mjs']);
const completeness=JSON.parse(run('node',['scripts/validate-lib-discovery-completeness.mjs']).split(/\r?\n/).filter(Boolean).at(-1));
assert.equal(completeness.accepted,true);
assert.equal(completeness.released_lib_roots,13);
assert.equal(completeness.catalog_packages,13);
assert.equal(completeness.explicit_intent_rows,13);
assert.equal(completeness.required_query_checks,24);
run('node',['scripts/test-lib-catalog.mjs']);
run('node',['scripts/test-lib-install.mjs']);

const oldCandidate=spawnSync('node',['scripts/release-candidate.mjs','verify','channels/candidates/0.0.13.json'],{
  cwd:root,encoding:'utf8',maxBuffer:8<<20,
});
assert.notEqual(oldCandidate.status,0,'old v0.0.13 candidate must reject future product bytes');
const candidateFailure=(oldCandidate.stderr+'\n'+oldCandidate.stdout).trim();
assert.match(candidateFailure,/product drift rejected/,'old candidate rejection must be product drift');
for(const [path,expected] of Object.entries(immutable))assert.equal(sha(path),expected,path+' changed during focused validation');

console.log(JSON.stringify({
  accepted:true,
  schema:'wasmc.lib-discovery-workstream-validation/v1',
  phase:'pre-candidate',
  old_release_identity_unchanged:true,
  old_candidate_rejection:'product drift rejected',
  released_lib_roots:13,
  catalog_packages:13,
  required_query_checks:24,
  official_release_integrity_refresh_deferred:true,
  selection_authority:false
}));
