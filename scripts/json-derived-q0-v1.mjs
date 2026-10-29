import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventory,sha,digest,verifyRoot} from './lib-refresh-cache-v2.mjs';
export async function verify({capsule,receiptSha,witPath,witSha}) {
 const bytes=await readFile(join(capsule,'receipt.json'));assert.equal(sha(bytes),receiptSha);
 const receipt=JSON.parse(bytes);assert.equal(receipt.schema,'wasmc.derived-json-lineage-receipt/v1');assert.equal(receipt.public_admission,false);
 const parent=join(capsule,'parent'),source=join(capsule,'source'),parentSource=join(parent,'source'),root=join(capsule,'root');
 const before=await inventory(parentSource),after=await inventory(source);
 assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
 const changes=['libspec/wasmc-json/lib.json','libspec/wasmc-json/lib.wit'];
 for(const [path,pin] of Object.entries(before))if(!changes.includes(path))assert.deepEqual(after[path],pin,path);
 const spec=JSON.parse(await readFile(join(parentSource,changes[0])));assert.equal(spec.version,'0.2.3');spec.version='0.2.4';
 assert.deepEqual(JSON.parse(await readFile(join(source,changes[0]))),spec);
 assert.deepEqual(await readFile(join(source,changes[1])),await readFile(join(root,'lib.wit')));
 const verified=await verifyRoot(root,'wasmc-json','0.2.4','value');
 const row={id:'wasmc-json',version:'0.2.4',profile:'value',manifest_sha256:verified.manifest_sha256,root_inventory_sha256:digest(verified.files)};
 assert.deepEqual(receipt.rows,[row]);assert.equal(receipt.parent_receipt_sha256,'ed77a0cc1fd4ee50673aa0921ef8b046ce62bcb23972e8792315d9571b78ccd8');
 assert.equal(witSha,'40c3d0e890e86cc86ef186fe3e504cd62d03da90fe0a1fc81b6588d078bd0a65');
 const producer=process.env.WASMC_DERIVED_PRODUCER;assert.ok(producer,'explicit producer path required');
 const lineage=fileURLToPath(new URL('./json-derived-lineage-v1.mjs',import.meta.url));
 assert.equal(sha(await readFile(join(capsule,'lib.build.json'))),receipt.build_input_sha256);
 const tmp=await mkdtemp(join(tmpdir(),'wasmc-derived-json-'));
 try {const text=execFileSync(process.execPath,[lineage,parent,root,producer,witPath,join(tmp,'run'),join(capsule,'lib.build.json')],{encoding:'utf8',timeout:180000,maxBuffer:1048576});const result=JSON.parse(text);assert.equal(result.accepted,true);assert.equal(result.manifest_sha256,row.manifest_sha256);assert.equal(result.inventory_sha256,row.root_inventory_sha256);}
 finally {await rm(tmp,{recursive:true,force:true});}
 return {schema:'wasmc.derived-json-lineage/v1',accepted:true,public_admission:false,formal_q0:false};
}
