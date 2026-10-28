import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {collectFrozenV030Notices} from '../../../../scripts/frozen-v030-notices-v1.mjs';
const root=resolve(process.argv[2]??''),invPath='catalog/frozen-v030-notices-v1.json';
const inventory=await readFile(invPath),value=JSON.parse(inventory),paths=value.files.map(r=>r.path);
const read=path=>path===invPath?readFile(invPath):readFile(join(root,path));
const result=await collectFrozenV030Notices(read,paths);assert.equal(result.size,324);
assert.equal((await collectFrozenV030Notices(read,[])).size,0);
const target=paths[0];await assert.rejects(collectFrozenV030Notices(async path=>{
 const b=await read(path);if(path!==target)return b;const changed=Buffer.from(b);changed[0]^=1;return changed;
},paths));
await assert.rejects(collectFrozenV030Notices(async path=>path===invPath?Buffer.from('invalid'):read(path),paths));
const fake='admission/unknown/licenses/DEPENDENCY-NOTICES-001.txt';assert.equal((await collectFrozenV030Notices(read,[fake])).has(fake),false);
console.log(JSON.stringify({accepted:true,frozen_exact_paths:result.size,altered_file_rejected:true,altered_inventory_rejected:true,unknown_path_not_classified:true,formal_release:false}));
