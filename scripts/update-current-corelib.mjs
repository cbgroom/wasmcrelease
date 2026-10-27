#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,unlinkSync,lstatSync} from 'node:fs';
import {dirname,resolve,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {corelibFunctionSignatures} from './corelib-abi.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [candidatePath,expected]=process.argv.slice(2);assert.ok(candidatePath&&/^[0-9a-f]{64}$/.test(expected??''),'usage: update-current-corelib.mjs CANDIDATE_WASM EXPECTED_SHA256');
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>readFileSync(resolve(root,p));
const old=read('current/lib_core.wasm'),candidate=readFileSync(resolve(candidatePath)),oldSha=sha(old);assert.equal(sha(candidate),expected,'candidate digest mismatch');
const exportsOf=b=>{const m=new WebAssembly.Module(b);assert.deepEqual(WebAssembly.Module.imports(m),[],'CoreLib must be import-free');return WebAssembly.Module.exports(m).sort((a,b)=>a.name.localeCompare(b.name));};assert.deepEqual(exportsOf(candidate),exportsOf(old),'CoreLib export names or kinds changed');assert.deepEqual(corelibFunctionSignatures(candidate),corelibFunctionSignatures(old),'CoreLib function signatures changed');
const files=['current/index.mjs','current/wasmc.mjs','current/wasmc.global.js','dist/wasmc.global.js'],writes=new Map();
for(const p of files){const full=resolve(root,p),info=lstatSync(full);assert.ok(info.isFile()&&!info.isSymbolicLink(),p);let source=read(p).toString('utf8');assert.equal(source.split(oldSha).length,2,'exactly one old CoreLib digest required: '+p);source=source.replace(oldSha,expected);
 if(p!=='current/index.mjs'){const marker='function decodeEmbeddedLib() {',at=source.indexOf(marker),prefix='const binary = atob("',start=source.indexOf(prefix,at)+prefix.length,end=source.indexOf('");',start);assert.ok(at>=0&&start>=prefix.length&&end>=start,'embedded CoreLib missing: '+p);assert.deepEqual(Buffer.from(source.slice(start,end),'base64'),old,'embedded CoreLib differs: '+p);source=source.slice(0,start)+candidate.toString('base64')+source.slice(end);}
 writes.set(p,{bytes:Buffer.from(source),mode:info.mode&0o777});}
const info=lstatSync(resolve(root,'current/lib_core.wasm'));assert.ok(info.isFile()&&!info.isSymbolicLink());writes.set('current/lib_core.wasm',{bytes:candidate,mode:info.mode&0o777});
const staged=[];try{for(const [p,v] of writes){const target=resolve(root,p),tmp=join(dirname(target),'.'+basename(target)+'.corelib-'+randomUUID());writeFileSync(tmp,v.bytes,{flag:'wx',mode:v.mode});staged.push({tmp,target});}for(const {tmp,target} of staged)renameSync(tmp,target);}finally{for(const {tmp} of staged)try{unlinkSync(tmp)}catch(e){if(e.code!=='ENOENT')throw e;}}
console.log(JSON.stringify({accepted:true,old_sha256:oldSha,corelib_sha256:expected,files:[...writes.keys()],export_signatures_verified:true,compiler_metadata_refresh_required:true,formal_release:false}));
