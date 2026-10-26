import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {suiteCases,runCase} from './ci-suite.mjs';
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
const ids=['wasmtime-component-consumer-tests','current-generated-Component-SDK-full-index-execution'];
const cases=suiteCases('rust').filter(x=>ids.includes(x.id));assert.equal(cases.length,2);
const out='target/ci/rust-search-recovery';mkdirSync(out,{recursive:true});const tests=[];
for(const test of cases){const row=await runCase(test,out);tests.push(row);console.log(JSON.stringify({id:row.id,accepted:row.accepted,exit_code:row.exit_code}));}
const report={schema:'wasmc.normal-rust-search-recovery/v1',source_commit:source,dirty:false,platform:process.platform,arch:process.arch,rustc:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),cargo:execFileSync('cargo',['--version'],{encoding:'utf8'}).trim(),profile:'release',index_sha256:createHash('sha256').update(readFileSync('catalog/current-index-v2.json')).digest('hex'),tests,accepted:tests.every(x=>x.accepted),scope:'Only the two previously failed Core/Component search commands; not a full normal or Rust aggregate'};
writeFileSync(out+'/recovery.json',JSON.stringify(report,null,2)+'\n');if(!report.accepted)process.exitCode=1;
