import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { cp,mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verify } from './resident-portable-q0-v1.mjs';
const [capsule,receiptSha,witPath,witSha]=process.argv.slice(2);assert.ok(capsule&&receiptSha&&witPath&&witSha);
const temp=await mkdtemp(join(tmpdir(),'wasmc-portable-q0-'));
try{
 const copy=join(temp,'moved-capsule');await cp(capsule,copy,{recursive:true,mode:constants.COPYFILE_FICLONE});
 const args={capsule:copy,receiptSha,witPath,witSha};const good=await verify(args);assert.equal(good.accepted,true);
 await assert.rejects(verify({...args,receiptSha:'0'.repeat(64)}));
 const source=join(copy,'source/libspec/mcpgit-resident-memory/delta.rs'),original=await readFile(source);
 await writeFile(source,Buffer.concat([original,Buffer.from('\n// tamper\n')]));await assert.rejects(verify(args),/source/);await writeFile(source,original);
 const ext=join(copy,'external/237710d4c9dd8eb7fead2c9c433be493a878f547d1093812feff43d18abe5896'),license=await readFile(ext);
 await writeFile(ext,Buffer.concat([license,Buffer.from('x')]));await assert.rejects(verify(args));await writeFile(ext,license);
 const artifact=join(copy,'root/artifact.wasm'),wasm=await readFile(artifact);await writeFile(artifact,Buffer.concat([wasm,Buffer.from('x')]));await assert.rejects(verify(args));
 console.log(JSON.stringify({relocated_copy_verified:true,rejections:['receipt pin','source bytes','external license bytes','Root artifact bytes']}));
} finally {await rm(temp,{recursive:true,force:true});}
