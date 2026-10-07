// Real standard-tool tests, separate from source-only orchestration fixtures.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyWitClosure } from './lib-wit-closure-v2.mjs';
import { sha } from './lib-refresh-cache-v2.mjs';

const argv=process.argv.slice(2);
assert.ok(argv.length===4&&argv[0]==='--tool'&&argv[2]==='--sha256',
  'usage: test-lib-wit-closure-v2.mjs --tool ABSOLUTE_WASM_TOOLS --sha256 SHA256');
const tool={path:argv[1],sha256:argv[3]};
assert.ok(isAbsolute(tool.path));assert.equal(sha(await readFile(tool.path)),tool.sha256);
const source=Buffer.from('package example:root@1.0.0; interface api { use example:base/types@1.0.0.{item}; read: func(value:item)->u32; } world app {export api;}');
const dependency={id:'base',bytes:Buffer.from('package example:base@1.0.0; interface types {record item {name:string,}}')};
const work=await mkdtemp(join(tmpdir(),'wit-closure-tests-'));
const results=[];
const check=async(name,action)=>{await action();results.push({name,pass:true});};
try {
  await mkdir(join(work,'source/deps/base'),{recursive:true});
  await writeFile(join(work,'source/root.wit'),source);
  await writeFile(join(work,'source/deps/base/root.wit'),dependency.bytes);
  const generated=spawnSync(tool.path,['component','wit',join(work,'source'),'--no-docs'],{timeout:30000});
  assert.equal(generated.status,0,generated.stderr?.toString());const delivered=generated.stdout;
  const simple=Buffer.from('package example:simple@1.0.0;interface api {read:func()->u32;}world app{export api;}');
  await check('exact bytes require no alternate decoder',async()=>assert.equal((await verifyWitClosure(simple,[],simple,null)).mode,'exact-bytes'));
  await check('standard dependency flattening is semantically exact',async()=>{
    const r=await verifyWitClosure(source,[dependency],delivered,tool);
    assert.notEqual(r.authored_sha256,r.delivered_sha256);assert.equal(r.normalized_sha256,sha(delivered));
  });
  await check('formatting differences use the pinned parser',async()=>assert.equal((await verifyWitClosure(simple,[],Buffer.from(simple.toString().replaceAll(';',';\n')),tool)).mode,'standard-tool-normalization'));
  await check('no normalization tool is inferred',async()=>assert.rejects(()=>verifyWitClosure(source,[dependency],delivered,null),/explicit/));
  await check('tool independent pin mismatch rejects',async()=>assert.rejects(()=>verifyWitClosure(source,[dependency],delivered,{...tool,sha256:'0'.repeat(64)}),/pin/));
  await check('missing dependency rejects',async()=>assert.rejects(()=>verifyWitClosure(source,[],delivered,tool),/normalization rejected/));
  await check('duplicate dependency rejects',async()=>assert.rejects(()=>verifyWitClosure(source,[dependency,dependency],delivered,tool),/duplicate/));
  await check('dependency path escape rejects',async()=>assert.rejects(()=>verifyWitClosure(source,[{...dependency,id:'../escape'}],delivered,tool)));
  await check('changed transitive record type rejects',async()=>assert.rejects(()=>verifyWitClosure(source,[{...dependency,bytes:Buffer.from(dependency.bytes.toString().replace('name:string','name:u64'))}],delivered,tool),/differ/));
  await check('changed exported return type rejects',async()=>assert.rejects(()=>verifyWitClosure(source,[dependency],Buffer.from(delivered.toString().replace('-> u32','-> u64')),tool),/differ/));
  await check('extra Host authority rejects',async()=>assert.rejects(()=>verifyWitClosure(source,[dependency],Buffer.from(delivered.toString().replace('world app {','world app { import clock: func()->u64;')),tool),/differ/));
  await check('malformed generated WIT rejects',async()=>assert.rejects(()=>verifyWitClosure(source,[dependency],Buffer.from('not WIT'),tool),/normalization rejected/));
  await check('unflattened dependency document cannot claim self-contained delivery',async()=>assert.rejects(()=>verifyWitClosure(source,[dependency],source,tool),/normalization rejected/));
  console.log(JSON.stringify({schema:'wasmc.wit-closure-real-tool-tests/v1',accepted:true,tool,cases:results,
    scope:'full WIT normalization and rejection; not runtime or release admission'}));
} finally {await rm(work,{recursive:true,force:true});}
