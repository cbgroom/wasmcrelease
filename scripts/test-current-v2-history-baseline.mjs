#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const baseline='c49bfcd5971fdd3780303b61378e5a1f2502a45d';
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const fixture=mkdtempSync(join(tmpdir(),'wasmc-history-baseline-'));
const git=args=>execFileSync('git',args,{cwd:fixture,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000});
try {
  git(['init','--quiet']);
  const remote=pathToFileURL(root).href;
  git(['fetch','--quiet','--depth=1',remote,source]);
  git(['checkout','--quiet','--detach','FETCH_HEAD']);
  assert.equal(git(['rev-parse','HEAD']).trim(),source);
  assert.equal(git(['rev-parse','--is-shallow-repository']).trim(),'true');
  const probe=()=>spawnSync(process.execPath,['scripts/validate-current-development.mjs'],{cwd:fixture,encoding:'utf8',timeout:60000,env:{...process.env,GITHUB_REF_TYPE:'branch'}});
  const shallow=probe();assert.equal(shallow.status,1);
  assert(shallow.stderr.includes(`git show ${baseline}:release.json`),'unexpected shallow failure');
  git(['fetch','--quiet','--unshallow',remote,source]);
  assert.equal(git(['rev-parse','--is-shallow-repository']).trim(),'false');
  const complete=probe();assert.equal(complete.status,0,complete.stderr);
  const observation=JSON.parse(complete.stdout.trim().split('\n').at(-1));
  assert.equal(observation.release_baseline,baseline);assert.equal(observation.old_candidate_rejects_future_bytes,true);
  assert.equal(observation.release_qualified,false);
  assert.equal(git(['status','--porcelain']).trim(),'');
  console.log(JSON.stringify({accepted:true,source_commit:source,baseline,shallow_rejection_reproduced:true,full_history_preflight:true,old_candidate_drift_rejected:true,release_qualified:false}));
}finally{
  // Only this invocation's generated fixture, never a checkout or caller path.
  rmSync(fixture,{recursive:true,force:true});
}
