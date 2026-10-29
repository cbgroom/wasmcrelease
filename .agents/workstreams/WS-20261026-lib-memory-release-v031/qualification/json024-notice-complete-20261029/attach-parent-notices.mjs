import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {readFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {attachReleaseLicense,sha,verifyRoot,inventory,digest} from '../../../../../scripts/lib-refresh-cache-v2.mjs';
const [parent,raw,previous,out]=process.argv.slice(2).map(p=>resolve(p));
const pm=(await verifyRoot(parent,'wasmc-json','0.2.3','value')).manifest,cm=(await verifyRoot(previous,'wasmc-json','0.2.4','value')).manifest;
assert.equal(pm.artifact.sha256,'75e35f9cafcea36407f2d9c9e3e29db411ae8afb3b3ea855b5d6a66272202d0c');
assert.equal(cm.artifact.sha256,'2721005c4f1c91cb058fa3dde601071cb828ff50e4c7b998468db16b54ea7e4e');
const source=pm.license.files.slice(1);assert.equal(source.length,13);const notices=[];
for(const pin of source){const content=await readFile(join(parent,pin.path));assert.equal(sha(content),pin.sha256);notices.push({path:pin.path,sha256:pin.sha256,content});}
const added=cm.license.files.find(x=>x.path==='licenses/DEPENDENCY-NOTICES-007.txt');const b=await readFile(join(previous,added.path));assert.equal(sha(b),added.sha256);notices.push({path:'licenses/DEPENDENCY-NOTICES-014.txt',sha256:sha(b),content:b});
const license=await readFile(join(parent,'LICENSE'));assert.equal(sha(license),pm.license.files[0].sha256);
await cp(raw,out,{recursive:true,mode:constants.COPYFILE_FICLONE,errorOnExist:true,force:false});await attachReleaseLicense(out,license,sha(license),notices);
const root=await verifyRoot(out,'wasmc-json','0.2.4','value');assert.deepEqual(root.manifest.license.files.slice(0,pm.license.files.length),pm.license.files);assert.equal(root.manifest.artifact.sha256,cm.artifact.sha256);
console.log(JSON.stringify({accepted:true,manifest_sha256:root.manifest_sha256,inventory_sha256:digest(await inventory(out)),preserved_parent_license_files:pm.license.files.length,additional_notice_sha256:sha(b),formal_release:false}));
