import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verify} from './resident-combined-product-v1.mjs';
const [root,catalogSha,oldSha,receiptSha,witPath,witSha,commit]=process.argv.slice(2);assert.ok(commit);
const temp=await mkdtemp(join(tmpdir(),'wasmc-combined-'));
try{
 const moved=join(temp,'product');await cp(root,moved,{recursive:true,mode:constants.COPYFILE_FICLONE});
 const args={root:moved,catalogSha,oldSha,receiptSha,witPath,witSha,commit};assert.equal((await verify(args)).accepted,true);
 await assert.rejects(verify({...args,catalogSha:'0'.repeat(64)}));
 const old=join(moved,'proof/old-product/catalog/libs-current-v2.json'),oldBytes=await readFile(old);await writeFile(old,Buffer.concat([oldBytes,Buffer.from('x')]));await assert.rejects(verify(args));await writeFile(old,oldBytes);
 const file=join(moved,'current-libs/wasmc-json/0.2.1/artifact.wasm'),data=await readFile(file);await writeFile(file,Buffer.concat([data,Buffer.from('x')]));await assert.rejects(verify(args));
 console.log(JSON.stringify({relocated_product_verified:true,rejections:['catalog pin','embedded old product','JSON artifact']}));
}finally{await rm(temp,{recursive:true,force:true});}
