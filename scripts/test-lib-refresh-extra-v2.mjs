import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generatedLib, selectedRun } from './generated-lib-v2.mjs';
import { atomicJson } from './lib-refresh-cache-v2.mjs';
import { CoreCaller, u8, u16, u32, s32, bool, string, list, record, variant, option, enumeration, result, unit } from './lib-refresh-test-abi-v2.mjs';

const runRoot = selectedRun(), cases = [], packages = [];
const bytes = text => [...new TextEncoder().encode(text)];
const ok = value => ({ tag: 'ok', value }), err = value => ({ tag: 'err', value });
async function load(id) {
  const input = await generatedLib(id, runRoot);
  const module = new WebAssembly.Module(await readFile(input.artifact));
  const abi = JSON.parse(await readFile(join(input.root, 'core-abi.json')));
  const caller = new CoreCaller(module, abi);
  packages.push({ id, artifact_sha256: input.row.artifact_sha256, apis: [] });
  return (name, types, values, output) => {
    const row = packages.at(-1); if (!row.apis.includes(name)) row.apis.push(name);
    return caller.call(name, types, values, output);
  };
}
async function check(name, fn) {
  try { await fn(); cases.push({ name, pass: true }); }
  catch (e) { cases.push({ name, pass: false, error: e.stack }); }
}

const route = await load('wasmc-router-policy');
const decision = record({ status: u32, upstream: u32, flags: u32 });
await check('router-1152-inputs', () => {
  let count = 0;
  for (let m = 0; m < 4; m++) for (let p = 0; p < 8; p++) for (let b = 0; b < 4; b++)
    for (const n of [0, 1, 2, 98, 99, 100, 101, 0x7fffffff, 0xffffffff]) {
      const expected = n >= 100 ? [429, 0, 0] : m === 0
        ? ({0:[200,0,0],1:[204,1,2],3:[403,0,0],4:[301,2,1],5:[418,0,0]}[p] ?? [404,0,0])
        : m === 1 && p === 2 && b === 1 ? [201,1,3] : [404,0,0];
      assert.deepEqual(route('route', [u32,u32,u32,u32], [m,p,b,n], decision),
        Object.fromEntries(['status','upstream','flags'].map((key,i)=>[key,expected[i]])));
      count++;
    }
  assert.equal(count, 1152);
});

const auth = await load('wasmc-app-authorization-policy');
const caps = enumeration(['camera','microphone','location-when-in-use','motion','notifications','photos-read-write','contacts','calendar','reminders','speech-recognition']);
const states = enumeration(['not-required','unavailable','not-determined','denied','restricted','authorized','limited','provisional','ephemeral','unknown']);
const plans = enumeration(['no-request','request','wait-for-in-flight-request','open-settings','fail-closed']);
const authDecision = record({ capability:caps, state:states, attempt_count:u32, request_in_flight:bool, plan:plans });
const status = variant({ok:unit,err:s32}), requestId = variant({ok:u32,err:s32});
await check('authorization-state-machine-and-stale-completion', () => {
  const initial = auth('snapshot', [], [], list(authDecision));
  assert.equal(initial.length, 10); assert.ok(initial.every(v=>v.plan==='fail-closed'));
  assert.deepEqual(auth('begin-request',[caps],['camera'],requestId),err(-13));
  assert.deepEqual(auth('observe',[caps,states],['camera','not-determined'],status),ok({}));
  assert.equal(auth('plan-request',[list(caps)],[['camera']],list(authDecision))[0].plan,'request');
  assert.deepEqual(auth('begin-request',[caps],['camera'],requestId),ok(1));
  assert.deepEqual(auth('begin-request',[caps],['camera'],requestId),err(-16));
  assert.equal(auth('plan-request',[list(caps)],[['camera']],list(authDecision))[0].plan,'wait-for-in-flight-request');
  assert.deepEqual(auth('observe',[caps,states],['camera','authorized'],status),err(-16));
  assert.deepEqual(auth('complete-request',[caps,u32,states],['camera',2,'authorized'],status),err(-22));
  assert.deepEqual(auth('complete-request',[caps,u32,states],['camera',1,'denied'],status),ok({}));
  assert.equal(auth('plan-request',[list(caps)],[['camera']],list(authDecision))[0].plan,'open-settings');
  assert.deepEqual(auth('complete-request',[caps,u32,states],['camera',1,'authorized'],status),err(-22));
});
await check('authorization-all-observed-states', () => {
  const expected=['no-request','fail-closed','request','open-settings','fail-closed','no-request','no-request','no-request','no-request','fail-closed'];
  for(let i=0;i<states.names.length;i++) {
    assert.deepEqual(auth('observe',[caps,states],['microphone',states.names[i]],status),ok({}));
    assert.equal(auth('plan-request',[list(caps)],[['microphone']],list(authDecision))[0].plan,expected[i]);
  }
});

const http = await load('wasmc-http1-client');
const header=record({name:string,value:list(u8)});
const errors=['input-too-large','body-too-large','too-many-headers','invalid-syntax','invalid-version','invalid-method','invalid-target','invalid-status','invalid-header-name','invalid-header-value','host-required','invalid-content-length','conflicting-framing','unsupported-transfer-coding','invalid-chunk','premature-eof','output-too-large'];
const response=record({minor_version:u8,status:u16,headers:list(header),body:list(u8),consumed:u32});
const decode=(text,eof=false,method='GET')=>http('decode-response',[list(u8),string,bool],[bytes(text),method,eof],result(option(response),errors));
await check('http-client-serialize-and-injection-reject',()=>{
  const v=http('serialize-request',[string,string,list(header),list(u8)],['GET','/',[{name:'host',value:bytes('example.com')}],[]],result(list(u8),errors));
  assert.equal(v.tag,'ok');assert.equal(new TextDecoder().decode(Uint8Array.from(v.value)),'GET / HTTP/1.1\r\nhost: example.com\r\n\r\n');
  assert.deepEqual(http('serialize-request',[string,string,list(header),list(u8)],['GET\r\nInjected','/',[],[]],result(list(u8),errors)),err('invalid-method'));
});
await check('http-client-framing-and-truncation',()=>{
  const v=decode('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok');assert.equal(v.tag,'ok');assert.deepEqual(v.value.body,bytes('ok'));
  assert.deepEqual(decode('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\no'),ok(null));
  assert.deepEqual(decode('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\no',true),err('premature-eof'));
  assert.deepEqual(decode('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n'),err('conflicting-framing'));
  const chunked=decode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nok\r\n0\r\n\r\n');assert.equal(chunked.tag,'ok');assert.deepEqual(chunked.value.body,bytes('ok'));
  assert.deepEqual(decode('HTTP/1.1 200 OK\r\n\r\nok',true).value.body,bytes('ok'));
});
const output={schema:'wasmc.lib-refresh-extra-q1/v2',accepted:cases.every(c=>c.pass),engine:process.version+' Node Core',packages,cases,public_admission:false};
await atomicJson(join(runRoot,'extra-q1-receipt.json'),output);console.log(JSON.stringify(output));
if(!output.accepted)process.exitCode=1;
