#!/usr/bin/env node
// Scoped current-value qualification. It does not claim full cohort Q2 or release.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {generatedLib} from './generated-lib-v2.mjs';
import {sha} from './lib-refresh-cache-v2.mjs';
const args=process.argv.slice(2);assert.equal(args.length,6);assert.equal(args[0],'--run-root');assert.equal(args[2],'--receipt-sha256');assert.equal(args[4],'--out');
assert.ok(isAbsolute(args[1])&&isAbsolute(args[5]));assert.match(args[3],/^[a-f0-9]{64}$/);
const runRoot=resolve(args[1]),out=resolve(args[5]),receiptPath=join(runRoot,'refresh-receipt.json'),receiptBytes=await readFile(receiptPath);
assert.equal(sha(receiptBytes),args[3],'independent Q0 receipt pin');const receipt=JSON.parse(receiptBytes);assert.equal(receipt.accepted,true);
const json=await generatedLib('wasmc-json',runRoot);assert.equal(json.receipt_sha256,args[3]);
await mkdir(out);const result={schema:'wasmc.current-lib-scoped-q1/v1',accepted:false,receipt_sha256:args[3],fingerprint:receipt.fingerprint,
  results:[],scope:'Node Core values, seven Data/CSV Roots and selected JSON operations; full Q2, Host and release remain independent'};
async function run(label,script,argv){
 const value=spawnSync(process.execPath,[script,...argv],{cwd:process.cwd(),encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
 await writeFile(join(out,label+'.stdout'),value.stdout??'',{flag:'wx'});await writeFile(join(out,label+'.stderr'),value.stderr??'',{flag:'wx'});
 if(value.error)throw value.error;assert.equal(value.status,0,label+' failed');const last=value.stdout.trim().split('\n').at(-1),parsed=JSON.parse(last);
 assert.ok(parsed.accepted===true||parsed.result==='PASS',label+' was not accepted');result.results.push({label,script,stdout_sha256:sha(Buffer.from(value.stdout)),output:parsed});
}
try {
 const common=['--run-root',runRoot,'--receipt-sha256',args[3]];
 await run('values','scripts/test-lib-refresh-current-values.mjs',[...common,'--out',join(out,'values.json')]);
 await run('data','scripts/test-lib-refresh-current-data.mjs',[...common,'--out',join(out,'data.json')]);
 await run('json-differential','scripts/test-json-current-differential.mjs',[json.root,json.row.artifact_sha256]);
 assert.equal(sha(await readFile(receiptPath)),args[3],'Q0 receipt changed during qualification');
 result.accepted=true;
} catch(error) { result.error=error.stack??String(error);process.exitCode=1; }
await writeFile(join(out,'receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
