import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const input=process.argv[2];assert.ok(input && path.isAbsolute(input));
const catalog=JSON.parse(fs.readFileSync(path.join(input,'catalog/libs-current-v2.json')));
const changes=[];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const row of catalog.packages){
  assert.match(row.id,/^[a-z0-9-]+$/);assert.match(row.version,/^\d+\.\d+\.\d+$/);
  assert.equal(row.root,`current-libs/${row.id}/${row.version}`);
  if(fs.existsSync(row.root))continue;
  const source=path.join(input,row.root);assert.ok(fs.statSync(source).isDirectory());
  for(const pin of row.files){assert.ok(pin.path.startsWith(row.root+'/'));const b=fs.readFileSync(path.join(input,pin.path));assert.equal(b.length,pin.bytes);assert.equal(digest(b),pin.sha256);}
  const specs=['lib.json','lib.wit'].map(name=>{const p=`libspec/${row.id}/${name}`;const b=fs.readFileSync(path.join(input,p));return {path:p,sha256:digest(b),bytes:b.length,previous_sha256:fs.existsSync(p)?digest(fs.readFileSync(p)):null}});
  changes.push({id:row.id,version:row.version,root:row.root,files:row.files.length,specs});
}
assert.equal(changes.length,27,'expected the qualified 27 successor roots');
for(const row of changes){assert.ok(!fs.existsSync(row.root));fs.mkdirSync(path.dirname(row.root),{recursive:true});fs.cpSync(path.join(input,row.root),row.root,{recursive:true,errorOnExist:true,force:false});for(const s of row.specs){fs.mkdirSync(path.dirname(s.path),{recursive:true});fs.writeFileSync(s.path,fs.readFileSync(path.join(input,s.path)));}}
console.log(JSON.stringify({schema:'wasmc.authority-roots-staging/v1',fixture_catalog_sha256:digest(fs.readFileSync(path.join(input,'catalog/libs-current-v2.json'))),scope:'new versioned roots and current source specs only; catalog remains unbound, no release',roots:changes},null,2));
