import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
// Independently read back from the immutable official standalone release tags.
// These inventories authorize exact notice bytes only, never directory ignores.
const releases=[
 ['wasmc-json','0.0.7','635c2954dbccaa10dfd7629649f68be88ebf412083c4f43acd4af15f157aabb2',12],
 ['wasmc-text','0.0.1','8e56534cf7705c74bf93707875681b2ae5225502bd8e8a056436a3822328ea54',6]
];
export async function collectStandaloneReleaseNotices(read){
 const notices=new Map();
 for(const [id,version,pin,count] of releases){
  const prefix=`lib-releases/${id}/${version}`,raw=await read(prefix+'/manifest.json');
  assert.equal(hash(raw),pin,'immutable standalone inventory drift');
  const m=JSON.parse(raw);assert.equal(m.schema,id==='wasmc-json'?'wasmc.standalone-lib-bundle-inventory/v1':'wasmc.complete-lib-bundle/v1');if(id==='wasmc-json'){assert.equal(m.id,id);assert.equal(m.version,version);}
  const rows=m.files.filter(r=>/^(?:root\/)?licenses\/DEPENDENCY-NOTICES-[0-9]{3}\.txt$/.test(r.path));assert.equal(rows.length,count);
  for(const row of rows){
   const path=prefix+'/'+row.path,bytes=await read(path);assert.equal(bytes.length,row.bytes,'standalone notice size');assert.equal(hash(bytes),row.sha256,'standalone notice digest');
   notices.set(path,{bytes:row.bytes,sha256:row.sha256,immutable_manifest_sha256:pin});
  }
 }
 return notices;
}
