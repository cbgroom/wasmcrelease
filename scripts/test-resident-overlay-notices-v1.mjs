import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectResidentOverlayNotices} from './current-license-policy-resident-overlay-v1.mjs';
const [root,catalogSha,oldSha,receiptSha,witPath,witSha,commit]=process.argv.slice(2);assert.ok(commit);
const temp=await mkdtemp(join(tmpdir(),'wasmc-notices-'));
try{
 const copy=join(temp,'product');await cp(root,copy,{recursive:true,mode:constants.COPYFILE_FICLONE});
 const args={root:copy,catalogSha,oldSha,receiptSha,witPath,witSha,commit},items=await collectResidentOverlayNotices(args);
 const p='current-libs/mcpgit-resident-memory/0.2.1/licenses/bincode-1.3.3-MIT.txt';assert.ok(items.has(p));
 assert.ok([...items.keys()].some(x=>x.startsWith('proof/old-product/admission/mixed-product-inputs-v1/old/')));
 assert.ok([...items.keys()].some(x=>x.startsWith('proof/old-product/admission/mixed-product-inputs-v1/candidate/')));
 await assert.rejects(collectResidentOverlayNotices({...args,catalogSha:'0'.repeat(64)}));
 const notice=join(copy,p),bytes=await readFile(notice);await writeFile(notice,Buffer.concat([bytes,Buffer.from('x')]));await assert.rejects(collectResidentOverlayNotices(args));
 console.log(JSON.stringify({accepted:true,declared_notice_paths:items.size,resident_bincode_notice:true,old_proofs_retained:true,controls:['wrong catalog pin','modified selected notice'],legal_compatibility:false,public_admission:false}));
}finally{await rm(temp,{recursive:true,force:true});}
