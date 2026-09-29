import fs from 'node:fs';
import assert from 'node:assert/strict';
import {instantiateLibSearch} from './client.mjs';
const root=new URL('../../standard/wasmc-lib-search/0.4.0/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('lib.json',root)));
const bytes=fs.readFileSync(new URL('artifact.wasm',root));
const pin={artifact_sha256:manifest.artifact.sha256,index_sha256:'8513e628605e8ec05d76729a46fd7dc4427d64a83276368568ae05a0b9070eab',wit_package:manifest.wit.package};
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
  ['telemetry',false,/^wasmc:system-telemetry@0\.0\.1$/],
  ['csv',false,/^wasmc:csv@0\.0\.1$/],
  ['equi-join',false,/wasmc:data-relational@0\.0\.2\/relational#equi-join$/],
  ['parquet',false,/wasmc:data-interchange@0\.0\.1/],
  ['base64',false,/wasmc:std@1\.4\.0/],
  ['json pointer',false,/wasmc:json@0\.0\.1\/document#select$/],
  ['gzip',false,/^wasmc:compression@0\.0\.1/],
  ['http1',false,/^wasmc:http1-server@0\.0\.1/],
  ['router policy',false,/^wasmc:router-policy@0\.0\.1/],
  ['wasmc:lib-search@0.4.0',false,/^wasmc:lib-search@0\.4\.0$/],
];
for(const [text,include_historical,identity] of feedback){
  const page=lib.search({text,include_historical},0,64);
  assert.ok(page.ok?.some(hit=>identity.test(hit.identity)),`feedback search missed: ${text}`);
}
console.log(JSON.stringify({accepted:true,status:'admitted-v0.0.18-product-candidate',snapshot:lib.snapshot(),hits:results.ok,client_checks:7,feedback_queries:feedback.length}));
