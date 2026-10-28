// Reuse the previously qualified Text transfer plan only after checking its
// public WIT and named Core exports against the newly installed Root.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';
import {createCanonicalHostCompiler} from '../../../../current/canonical-host.mjs';
const [root,out,compilerPath]=process.argv.slice(2); assert.ok([root,out,compilerPath].every(p=>isAbsolute(p??'')));
const repo=resolve(import.meta.dirname,'../../../..'), f=join(repo,'examples/current/string-support-v2');
const read=p=>readFileSync(p), sha=b=>createHash('sha256').update(b).digest('hex');
const manifestBytes=read(join(root,'lib.json')),manifest=JSON.parse(manifestBytes),wasm=read(join(root,'artifact.wasm'));
assert.equal(manifest.id,'wasmc-text'); assert.equal(manifest.version,'0.0.2'); assert.equal(sha(wasm),manifest.artifact.sha256);
const wit=read(join(root,'lib.wit')),oldTemplate=JSON.parse(read(join(f,'cold/canonical-template.json')));
assert.equal(sha(wit),oldTemplate.wit_sha256);
const oldAbi=JSON.parse(read(join(repo,'.agents/workstreams/WS-20261026-lib-memory-release-v031/candidate-roots/wasmc-text/0.0.2/core-abi.json')));
const newAbi=JSON.parse(read(join(root,'core-abi.json')));assert.equal(newAbi.artifact_sha256,sha(wasm));
const normalize=x=>Object.fromEntries(x.map(({index,...rest})=>[rest.name,rest]));
const a=normalize(oldAbi.exports),b=normalize(newAbi.exports);
for(const [name,signature] of Object.entries(a)) {
  if(name==='__data_end'||name==='__heap_base'||name.startsWith('cabi_realloc_wit_bindgen_')) continue;
  assert.deepEqual(b[name],signature,`Core export changed: ${name}`);
}
assert.deepEqual(oldAbi.imports,newAbi.imports);
const template=Buffer.from(JSON.stringify({...oldTemplate,manifest_sha256:sha(manifestBytes),artifact_sha256:sha(wasm)})+'\n');
const source=read(join(f,'source.wasmc')).toString(),activation=JSON.parse(read(join(f,'activation.json')));
activation.root={manifest_sha256:sha(manifestBytes),artifact_sha256:sha(wasm),wit_sha256:sha(wit),template_sha256:sha(template)};
activation.source_sha256=sha(Buffer.from(source));
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read(join(f,'host',n,p))]));
const compilerBytes=read(compilerPath);
assert.equal(sha(compilerBytes),JSON.parse(read(join(f,'profile.json'))).compiler.sha256,'exact candidate compiler pin');
const compiler=await createCanonicalHostCompiler(compilerBytes); let result;
try{result=await compiler.compile({source,activation:Buffer.from(JSON.stringify(activation)),entry:tuple('entry'),operations:tuple('operations'),libCore:wasm,libWit:wit,template});}finally{compiler.dispose();}
assert.equal(result.modules.size,8); mkdirSync(out);
for(const [name,bytes] of result.modules){const path=join(out,name);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
writeFileSync(join(out,'frame.bin'),result.frame,{flag:'wx'});
writeFileSync(join(out,'template.json'),template,{flag:'wx'});
const receipt={accepted:true,compiler_sha256:sha(compilerBytes),root_manifest_sha256:sha(manifestBytes),artifact_sha256:sha(wasm),wit_sha256:sha(wit),source_sha256:sha(Buffer.from(source)),frame_sha256:sha(result.frame),modules:result.modules.size,template:'prior compatible template rebound after WIT and named export signature checks',installed_fixture:true,execution:false,formal_release:false};
writeFileSync(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
