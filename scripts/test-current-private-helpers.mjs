import assert from 'node:assert/strict';
import {compile} from '../current/wasmc.mjs';

const source=(body,helpers='')=>`package test:public_helpers; interface api { run: func() -> u32 { ${body} } } world app { export api; } ${helpers}`;
let calls=0;
async function check(body,helpers,expected){
  const bytes=await compile(source(body,helpers));
  const module=new WebAssembly.Module(bytes);
  assert.deepEqual(WebAssembly.Module.imports(module),[]);
  assert.ok(WebAssembly.Module.exports(module).every(row=>!row.name.startsWith('helper')&&row.name!=='factorial'));
  const instance=new WebAssembly.Instance(module,{});
  for(let i=0;i<3;i++){assert.equal(instance.exports.run()>>>0,expected);calls++;}
  return bytes;
}
const cases=[
 ['return helper_next(41);','fn helper_next(x: u32) -> u32 { return x + 1; }',42],
 ['let x: u32 = helper_a(4); return helper_b(x) + helper_a(2);','fn helper_a(x: u32) -> u32 { return helper_b(x) + 1; } fn helper_b(x: u32) -> u32 { return x * 3; }',46],
 ['return helper_a(helper_b(4)) + 2;','fn helper_a(x: u32) -> u32 { return x + 3; } fn helper_b(x: u32) -> u32 { return x * 2; }',13],
 ['return helper_sum(10);','fn helper_sum(n: u32) -> u32 { let mut i: u32 = 0; let mut total: u32 = 0; while (i < n) { i = i + 1; if (i == 3) { continue; } if (i == 8) { break; } total = total + i; } return total; }',25],
 ['return factorial(6);','fn factorial(n: u32) -> u32 { if (n == 0) { return 1; } return n * factorial(n - 1); }',720],
 ['return helper_long(7);',`fn helper_long(a: u32) -> u32 { return a + ${Array(2098).fill('1').join('+')}; }`,2105]
];
for(const type of ['s8','u8','s16','u16','s32','u32','i64','u64','f32','f64','bool']){
  const value=type==='bool'?'true':'1';
  cases.push([`return if (helper_identity(${value}) == ${value}) { 42 } else { 0 };`,`fn helper_identity(x: ${type}) -> ${type} { return x; }`,42]);
}
for(const expression of ['if (false && helper_trap(x) == 1) { 0 } else { 42 }','if (true || helper_trap(x) == 1) { 42 } else { 0 }','if (false) { helper_trap(x) } else { 42 }']){
  cases.push(['return helper_guard(0);',`fn helper_guard(x: u32) -> u32 { return ${expression}; } fn helper_trap(x: u32) -> u32 { return 1 / x; }`,42]);
}
const healthy=await check('return 7;','',7);
for(const row of cases)await check(...row);
const selected=await compile(source('return helper_trap(0);','fn helper_trap(x: u32) -> u32 { return 1 / x; }'));
const trapped=new WebAssembly.Instance(new WebAssembly.Module(selected),{});
assert.throws(()=>trapped.exports.run(),WebAssembly.RuntimeError);
const invalid=[
 source('return helper(1, 2);','fn helper(x: u32) -> u32 { return x; }'),
 source('return helper(true);','fn helper(x: u32) -> u32 { return x; }'),
 source('return helper(1);','fn helper(x: u32) -> bool { return true; }'),
 source('return absent(1);'),
 'package test:order; fn helper(x: u32) -> u32 { return x; } interface api { run: func() -> u32 { return helper(1); } } world app { export api; }'
];
for(const text of invalid){
  let rejected=false;
  try{await compile(text);}catch(error){
    assert.ok(!(error instanceof WebAssembly.RuntimeError),'compiler trapped instead of rejecting source');
    assert.doesNotMatch(String(error),/unreachable|stack exhausted|call stack/i);
    rejected=true;
  }
  assert.ok(rejected,'invalid helper source accepted');
}
assert.deepEqual(await check('return 7;','',7),healthy);
console.log(JSON.stringify({accepted:true,source_cases:cases.length,guest_calls:calls,repeats_per_instance:3,basic_scalar_types:11,long_helper_terms:2098,invalid_sources_rejected:invalid.length,selected_guest_trap:true,healthy_after_rejections:true,imports:0,real_MCP_acceptance:false}));
