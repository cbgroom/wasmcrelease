import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CoreCaller,bool,enumeration,f64,i64,u64,u8,u32,list,option,record,result,string,variant} from '../../../../../scripts/current-core-value-codec-v3.mjs';
const root=process.argv[2], pin='7ecf281690a297d4bb0646fbd96203e3fa791df6e3f65f12fa35360a47efc3f1';
const raw=readFileSync(`${root}/artifact.wasm`),abi=JSON.parse(readFileSync(`${root}/core-abi.json`));assert.equal(createHash('sha256').update(raw).digest('hex'),pin);assert.equal(abi.artifact_sha256,pin);
const dtype=enumeration(['boolean','int64','uint64','float64','utf8','binary']), field=record({name:string,data_type:dtype,nullable:bool}),column=variant(Object.fromEntries([['boolean',bool],['int64',i64],['uint64',u64],['float64',f64],['utf8',string],['binary',list(u8)]].map(([name,t])=>[name,list(option(t))]))),batch=record({rows:u32,fields:list(field),columns:list(column)}), opts=record({has_header:bool,validate_header:bool,delimiter:u8,batch_rows:u32}),errors=['invalid-options','invalid-data','unsupported-type'];
const caller=new CoreCaller(new WebAssembly.Module(raw),abi),fields=[{name:'value',data_type:'utf8',nullable:false}],options={has_header:false,validate_header:false,delimiter:44,batch_rows:1};
function parse(bytes,o=options){return caller.call('parse',[list(u8),list(field),opts],[bytes,fields,o],result(list(batch),errors));}
for(const n of [8,1048577,16777216,16777217,11]){const input=new Array(n+1).fill(120);input[n]=10;const out=parse(input);assert.equal(out.tag,'ok');assert.equal(out.value.length,1);assert.equal(out.value[0].rows,1);let v=out.value[0].columns[0];assert.equal(v.tag,'utf8');assert.equal(v.value.length,1);assert.equal(v.value[0].length,n);assert.equal(v.value[0],'x'.repeat(n));console.log(`field_bytes=${n} output_equal=true`);}
assert.equal(parse([120,10],{...options,batch_rows:0}).tag,'err');const fresh=parse([111,107,10]);assert.equal(fresh.tag,'ok');assert.equal(fresh.value[0].columns[0].value[0],'ok');console.log('invalid_then_same_instance_recovery=true');
