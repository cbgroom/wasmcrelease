import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createCanonicalHostCompiler} from './current/canonical-host.mjs';
const root=process.argv[2],f=root+'/examples/current/string-support-v2/',read=p=>fs.readFileSync(p),sha=b=>createHash('sha256').update(b).digest('hex');
const tuple=n=>Object.fromEntries([['wit','lib.wit'],['executionAbi','execution-abi.json'],['providerContract','provider-contract.json'],['binding','binding.json']].map(([k,p])=>[k,read(f+'host/'+n+'/'+p)]));
const input={source:read(f+'source.wasmc').toString(),activation:read(f+'activation.json'),entry:tuple('entry'),operations:tuple('operations'),libCore:read(root+'/current-libs/wasmc-text/0.0.2/artifact.wasm'),libWit:read(root+'/current-libs/wasmc-text/0.0.2/lib.wit'),template:read(f+'cold/canonical-template.json')};
const compiler=await createCanonicalHostCompiler(read(root+'/current/wasmc_compiler.wasm'));try{
let invalid=JSON.parse(input.entry.binding);invalid.entrypoint_bridge.field_inputs.find(x=>JSON.stringify(x.field_path)==='[5]').maximum_bytes=16777217;
await assert.rejects(compiler.compile({...input,entry:{...input.entry,binding:Buffer.from(JSON.stringify(invalid))}}));
const result=await compiler.compile(input);assert.equal(result.modules.size,8);fs.writeFileSync(f+'modules/frame',result.frame);fs.writeFileSync(f+'modules/descriptor.json',JSON.stringify(result.descriptor,null,2)+'\n');for(const [name,bytes] of result.modules)fs.writeFileSync(f+'modules/'+name,bytes);
console.log(JSON.stringify({compiler:sha(read(root+'/current/wasmc_compiler.wasm')),frame:sha(result.frame),modules:result.modules.size,typed_guard_rejected:true}));
}finally{compiler.dispose()}
