#!/usr/bin/env node
// Current Component contracts, selected from an independently pinned Q0 receipt.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {generatedLib} from './generated-lib-v2.mjs';
import {sha} from './lib-refresh-cache-v2.mjs';

const a=process.argv.slice(2);
assert.equal(a.length,6); assert.equal(a[0],'--run-root'); assert.equal(a[2],'--receipt-sha256'); assert.equal(a[4],'--out');
assert.ok(isAbsolute(a[1]) && isAbsolute(a[5])); assert.match(a[3],/^[0-9a-f]{64}$/);
const root=resolve(a[1]), receiptPath=join(root,'refresh-receipt.json');
assert.equal(sha(await readFile(receiptPath)),a[3],'Q0 receipt pin');
const components={};
for (const id of ['wasmc-json','wasmc-compression','wasmc-http1']) {
  const selected=await generatedLib(id,root);
  assert.equal(selected.receipt_sha256,a[3]); assert.ok(selected.component,id+' missing Component');
  components[id]={path:selected.component,sha256:sha(await readFile(selected.component)),manifest_sha256:selected.row.manifest_sha256,version:selected.row.version};
}
const bytes=s=>'['+[...Buffer.from(s)].join(',')+']';
const json=bytes('{"n":42,"b":true,"a":[1]}');
const cases=[
 ['wasmc-json','compact(" { \\\"a\\\": 1 } ")','ok("{\\\"a\\\":1}")'],
 ['wasmc-json','object-from-fields([{name:"a",value-json:"1"},{name:"b",value-json:"true"}])','ok("{\\\"a\\\":1,\\\"b\\\":true}")'],
 ['wasmc-json','array-from-values(["1","true","null"])','ok("[1,true,null]")'],
 ['wasmc-json',`read-u64(${json},"/n")`,'ok({present: true, value: 42})'],
 ['wasmc-json',`read-u64(${json},"/missing")`,'ok({present: false, value: 0})'],
 ['wasmc-json',`read-u64(${json},"/b")`,'err(type-mismatch)'],
 ['wasmc-json',`read-bool(${json},"/b")`,'ok({present: true, value: true})'],
 ['wasmc-json',`edit-or-bytes(${json},[{kind:set,path:"/n",value-json:"7"},{kind:set,path:"/a/-",value-json:"2"},{kind:remove,path:"/b",value-json:""}],"fallback")`,'"{\\\"a\\\":[1,2],\\\"n\\\":7}"'],
 ['wasmc-json',`edit-or-bytes(${json},[{kind:remove,path:"/missing",value-json:""}],"fallback")`,'"fallback"'],
 ['wasmc-compression','decompress([31,139,8,0,0,0,0,0,0,255,203,72,205,201,201,7,0,134,166,16,54,5,0,0,0])','ok([104, 101, 108, 108, 111])'],
 ['wasmc-compression','decompress([1,2,3])','err(invalid-stream)'],
 ['wasmc-http1',`parse-request(${bytes('GET / HTTP/1.1\r\n\r\n')})`,'ok({method: "GET", target: "/", minor-version: 1, headers: [], body-offset: 18})'],
 ['wasmc-http1',`request-frame-length(${bytes('GET / HTTP/1.1\r\n\r\n')})`,'ok(some(18))'],
];
const version=spawnSync('wasmtime',['--version'],{encoding:'utf8'}); assert.equal(version.status,0);
const results=[];
for (const [id,invocation,expected] of cases) {
 const run=spawnSync('wasmtime',['run','--invoke',invocation,components[id].path],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 assert.ifError(run.error); assert.equal(run.status,0,`${id} ${invocation}: ${run.stderr}`);
 assert.equal(run.stdout.trim(),expected,`${id} ${invocation}`);
 results.push({id,invocation,output:run.stdout.trim(),stderr_sha256:sha(Buffer.from(run.stderr))});
}
assert.equal(sha(await readFile(receiptPath)),a[3],'receipt changed during test');
for (const value of Object.values(components)) assert.equal(sha(await readFile(value.path)),value.sha256,'Component changed during test');
const result={schema:'wasmc.current-values-component/v1',accepted:true,engine:version.stdout.trim(),receipt_sha256:a[3],components,cases:results,
 scope:'three current Components, isolated invocation per case; not full cohort, installed Host, or release'};
await writeFile(resolve(a[5]),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
