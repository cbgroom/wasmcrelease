// Retain each Root's originally declared notices, with no synthetic common list.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {currentProductPaths,currentProductReader,hash} from './current-lib-release-v3.mjs';
import {collectMixedDeclaredNotices} from './current-license-policy-mixed-v1.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),read=currentProductReader(root),paths=currentProductPaths(root);
const catalog=read('catalog/libs-current-v2.json'),policy=JSON.parse(read('catalog/current-mixed-license-policy-v1.json'));
const get=async p=>read(p),notices=await collectMixedDeclaredNotices(catalog,policy,get,paths);
assert.ok(notices.size>0);assert.ok([...notices.keys()].some(p=>p.startsWith('current-libs/')));
assert.ok([...notices.keys()].some(p=>p.startsWith('admission/mixed-product-inputs-v1/old/')));
assert.ok([...notices.keys()].some(p=>p.startsWith('admission/mixed-product-inputs-v1/candidate/')));
await assert.rejects(collectMixedDeclaredNotices(catalog,{...policy,catalog_sha256:'0'.repeat(64)},get,paths));
const target=[...notices.keys()].find(p=>p.startsWith('current-libs/'));
await assert.rejects(collectMixedDeclaredNotices(catalog,policy,async p=>p===target?Buffer.concat([read(p),Buffer.from('x')]):read(p),paths));
console.log(JSON.stringify({accepted:true,schema:'wasmc.mixed-notices-ci-check/v1',catalog_sha256:hash(catalog),notices:notices.size,controls:2,public_admission:false}));
