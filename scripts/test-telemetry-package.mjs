// Exercise real reopen rejections, rather than merely compare two hashes.
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync,symlinkSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {verifyCandidate,sha} from './verify-telemetry-candidate.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(process.argv[2]??join(repo,'admission/system-telemetry-v1/package'));
const expected=JSON.parse(readFileSync(join(repo,'admission/system-telemetry-v1/local-qualification.json'),'utf8')).artifacts;
const result=verifyCandidate(root,expected);
const scratch=mkdtempSync(join(tmpdir(),'wasmc-telemetry-reopen-'));
const rejected=[];
function negative(name,edit) {
  const p=join(scratch,name);cpSync(root,p,{recursive:true});edit(p);
  assert.throws(()=>verifyCandidate(p,expected),undefined,name+' must reject');rejected.push(name);
}
try {
  for(const name of ['artifact.wasm','component.wasm','lib.wit','SKILL.md','references/agent-delta.json']) {
    negative('tamper-'+name.replaceAll('/','-'),p=>{const f=join(p,name),b=readFileSync(f);b[b.length-1]^=1;writeFileSync(f,b);});
  }
  negative('self-rehashed-artifact',p=>{
    const f=join(p,'artifact.wasm'),b=readFileSync(f);b[b.length-1]^=1;writeFileSync(f,b);
    const m=JSON.parse(readFileSync(join(p,'lib.json'),'utf8'));m.artifact.sha256=sha(b);writeFileSync(join(p,'lib.json'),JSON.stringify(m));
  });
  negative('path-escape',p=>{const m=JSON.parse(readFileSync(join(p,'lib.json'),'utf8'));m.artifact.path='../outside.wasm';writeFileSync(join(p,'lib.json'),JSON.stringify(m));});
  negative('unexpected-file',p=>writeFileSync(join(p,'extra.txt'),'unexpected'));
  negative('unexpected-reference',p=>writeFileSync(join(p,'references','extra.txt'),'unexpected'));
  negative('missing-file',p=>rmSync(join(p,'component.wasm')));
  negative('directory-as-artifact',p=>{rmSync(join(p,'artifact.wasm'));mkdirSync(join(p,'artifact.wasm'));});
  negative('linked-references',p=>{
    const outside=join(scratch,'linked-target');cpSync(join(p,'references'),outside,{recursive:true});
    rmSync(join(p,'references'),{recursive:true});
    symlinkSync(outside,join(p,'references'),process.platform==='win32'?'junction':'dir');
  });
  console.log(JSON.stringify({...result,negative_controls:rejected,negative_count:rejected.length}));
} finally {rmSync(scratch,{recursive:true,force:true});}
