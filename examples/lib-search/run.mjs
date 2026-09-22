import fs from 'node:fs';
import assert from 'node:assert/strict';
import {instantiateLibSearch} from './client.mjs';
const root=new URL('../../candidates/wasmc-lib-search/0.2.0/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('lib.json',root)));
const bytes=fs.readFileSync(new URL('artifact.wasm',root));
const pin={artifact_sha256:manifest.artifact.sha256,index_sha256:'7f33c20e46499dd016f8656b075c78366a683686c070794d20dec152fbb8cbe5',wit_package:manifest.wit.package};
const lib=instantiateLibSearch(bytes,pin);
const results=lib.search({text:'base64',include_historical:false},0,8);
assert.equal(results.ok.length,3);
assert.deepEqual(lib.lookup(results.ok[0].identity),results.ok[0]);
assert.deepEqual(lib.search({text:'',include_historical:false},0,65),{error:'invalid-limit'});
assert.deepEqual(lib.search({text:'a'.repeat(257),include_historical:false},0,1),{error:'invalid-query'});
assert.throws(()=>instantiateLibSearch(bytes,{...pin,artifact_sha256:'0'.repeat(64)}),/digest/);
assert.throws(()=>instantiateLibSearch(bytes,{...pin,index_sha256:'0'.repeat(64)}),/digest/);
assert.throws(()=>lib.search({text:'',include_historical:false},-1,1),/u32/);
const feedback=[
  ['csv',false,/^wasmc:csv@0\.0\.1$/],
  ['wasmc-csv',false,/^wasmc:csv@0\.0\.1$/],
  ['equi-join',false,/wasmc:data-relational@0\.0\.1\/relational#equi-join$/],
  ['wasmc-data-relational',false,/^wasmc:data-relational@0\.0\.1$/],
  ['parquet',false,/wasmc:data-interchange@0\.0\.1/],
  ['wasmc-host-clock',true,/^wasmc:host-clock@0\.0\.1$/],
  ['resource counter',true,/^wasmc:resource-counter@0\.0\.1$/],
  ['owned algorithms',true,/^wasmc:owned-algorithms@0\.1\.0$/],
];
for(const [text,include_historical,identity] of feedback){
  const page=lib.search({text,include_historical},0,64);
  assert.ok(page.ok?.some(hit=>identity.test(hit.identity)),`feedback search missed: ${text}`);
}
console.log(JSON.stringify({accepted:true,snapshot:lib.snapshot(),hits:results.ok,client_checks:7,feedback_queries:feedback.length}));
