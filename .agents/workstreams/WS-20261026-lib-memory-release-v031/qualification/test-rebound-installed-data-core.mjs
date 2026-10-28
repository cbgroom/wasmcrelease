import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CoreCaller, bool, enumeration, f64, i64, u64, u8, u32, list, option, record, result, string, variant} from '../../../../scripts/current-core-value-codec-v3.mjs';
const [root, expected] = process.argv.slice(2);
const wasm = readFileSync(`${root}/artifact.wasm`), abi = JSON.parse(readFileSync(`${root}/core-abi.json`));
assert.equal(createHash('sha256').update(wasm).digest('hex'), expected); assert.equal(abi.artifact_sha256, expected);
const c = new CoreCaller(new WebAssembly.Module(wasm), abi);
const dtype = enumeration(['boolean', 'int64', 'uint64', 'float64', 'utf8', 'binary']);
const field = record({name:string,data_type:dtype,nullable:bool});
const column = variant(Object.fromEntries([['boolean',bool],['int64',i64],['uint64',u64],['float64',f64],
  ['utf8',string],['binary',list(u8)]].map(([name,type]) => [name,list(option(type))])));
const batch = record({rows:u32,fields:list(field),columns:list(column)});
const errors = ['column-count-mismatch','row-count-mismatch','type-mismatch','nullability-violation',
  'empty-field-name','duplicate-field-name','index-out-of-bounds','invalid-layout'];
for (const text of ['small','雪🦀','x'.repeat(3 * 1024 * 1024 + 17),'fresh']) {
  const value = {rows:1,fields:[{name:'value',data_type:'utf8',nullable:false}],columns:[{tag:'utf8',value:[text]}]};
  assert.deepEqual(c.call('validate',[batch],[value],result(u32,errors)),{tag:'ok',value:1});
  assert.deepEqual(c.call('take',[batch,list(u32)],[value,[0]],result(batch,errors)),{tag:'ok',value});
  assert.deepEqual(c.call('take',[batch,list(u32)],[value,[1]],result(batch,errors)),{tag:'err',value:'index-out-of-bounds'});
}
console.log(JSON.stringify({accepted:true,artifact_sha256:expected,same_instance:true,utf8_bytes:3*1024*1024+17,
  cases:['small','unicode','large','fresh','invalid-index'],formal_release:false}));
