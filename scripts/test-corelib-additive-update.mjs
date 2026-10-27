import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const [predecessorRoot,candidatePath]=process.argv.slice(2);
assert.ok(predecessorRoot&&candidatePath,'usage: test-corelib-additive-update.mjs PREDECESSOR_ROOT CANDIDATE_WASM');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const oldHash=hash(readFileSync(join(predecessorRoot,'current/lib_core.wasm')));
const candidate=resolve(candidatePath),candidateHash=hash(readFileSync(candidate));
const temp=mkdtempSync(join(tmpdir(),'wasmc-corelib-additive-'));
const contract={schema:'wasmc.corelib-additive-exports/v1',previous_sha256:oldHash,candidate_sha256:candidateHash,additions:[{name:'object_take_list_child',params:[126,126,127,126],results:[126]}]};
const results=[];
function run(name,change,mode){
 const work=join(temp,name);for(const dir of ['scripts','current','dist'])mkdirSync(join(work,dir),{recursive:true});
 for(const file of ['current/lib_core.wasm','current/index.mjs','current/wasmc.mjs','current/wasmc.global.js','dist/wasmc.global.js'])cpSync(join(predecessorRoot,file),join(work,file));
 for(const file of ['update-current-corelib.mjs','corelib-abi.mjs'])cpSync(join(root,'scripts',file),join(work,'scripts',file));
 const record=structuredClone(contract);change(record);const bytes=Buffer.from(JSON.stringify(record));const path=join(work,'contract.json');writeFileSync(path,bytes);
 const unchanged=name==='unchanged';
 const args=[join(work,'scripts/update-current-corelib.mjs'),unchanged?join(predecessorRoot,'current/lib_core.wasm'):candidate,unchanged?oldHash:candidateHash];
 if(mode!=='default')args.push('--additive-exports',path,mode==='bad-digest'?'0'.repeat(64):hash(bytes));
 const result=spawnSync(process.execPath,args,{encoding:'utf8'});
 writeFileSync(join(work,'result.json'),JSON.stringify({command:args,status:result.status,stdout:result.stdout,stderr:result.stderr},null,2)+'\n');
 const success=name==='valid'||unchanged;assert.equal(result.status===0,success,`${name}: ${result.stderr}`);
 if(success){const output=JSON.parse(result.stdout);assert.deepEqual(output.added_exports,unchanged?[]:['object_take_list_child']);assert.equal(hash(readFileSync(join(work,'current/lib_core.wasm'))),unchanged?oldHash:candidateHash);}
 else assert.equal(hash(readFileSync(join(work,'current/lib_core.wasm'))),oldHash,`${name} changed predecessor`);
 results.push({case:name,status:result.status,stderr_sha256:hash(Buffer.from(result.stderr))});
}
run('unchanged',()=>{},'default');
run('default',()=>{},'default');
run('bad-digest',()=>{},'bad-digest');
run('wrong-predecessor',c=>{c.previous_sha256='0'.repeat(64);});
run('wrong-candidate',c=>{c.candidate_sha256='0'.repeat(64);});
run('wrong-signature',c=>{c.additions[0].results=[127];});
run('unknown-export',c=>{c.additions[0].name='not_a_corelib_export';});
run('duplicate',c=>{c.additions.push(c.additions[0]);});
run('valid',()=>{});
console.log(JSON.stringify({accepted:true,old_sha256:oldHash,candidate_sha256:candidateHash,cases:results,temporary_root:temp,release:false}));
