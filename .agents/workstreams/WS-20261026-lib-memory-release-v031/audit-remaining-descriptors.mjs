import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='current-libs/';
const rows=[['wasmc-system-ios-app-contacts','0.0.1'],['wasmc-system-ios-app-lifecycle','0.0.1'],['wasmc-system-ios-app-surface-control','0.0.3'],['wasmc-system-ios-background-audio','0.0.1'],['wasmc-system-ios-background-transfer','0.0.1'],['wasmc-system-ios-deferred-work','0.0.1'],['wasmc-system-ios-local-notification','0.0.1'],['wasmc-system-ios-network-path','0.0.1'],['wasmc-system-ios-websocket','0.0.1']];
const sha=b=>createHash('sha256').update(b).digest('hex');
function scan(x,p='',found=[]){if(x && typeof x==='object')for(const [k,v] of Object.entries(x)){const q=p+'/'+k;if(/limit|max|capacity|budget/i.test(k))found.push(q);scan(v,q,found)}return found}
const descriptors=rows.map(([id,version])=>{const path=`${base}${id}/${version}/lib.json`,bytes=readFileSync(path),manifest=JSON.parse(bytes);assert.equal(manifest.id,id);assert.equal(manifest.version,version);return {id,version,path,sha256:sha(bytes),capacity_named_keys:scan(manifest)}});
const witPath=base+'wasmc-router-policy/0.0.2/lib.wit',wit=readFileSync(witPath);assert.match(wit.toString(),/route:\s*func\(\s*method:\s*u32,\s*path:\s*u32,\s*body-class:\s*u32,\s*request-count:\s*u32,\s*\)\s*->\s*decision/s);assert.match(wit.toString(),/record decision\s*\{\s*status:\s*u32,\s*upstream:\s*u32,\s*%flags:\s*u32,\s*\}/s);
const sdkPath=base+'wasmc-router-policy/0.0.2/bindings/rust-core/src/lib.rs',sdk=readFileSync(sdkPath);assert.match(sdk.toString(),/bytes:16\*1024\*1024,nodes:1024\*1024,depth:0/);
console.log(JSON.stringify({schema:'wasmc.remaining-descriptor-scan/v1',descriptors,router:{wit_path:witPath,wit_sha256:sha(wit),sdk_path:sdkPath,sdk_sha256:sha(sdk),route_signature:'four u32 to three u32',sdk_fixed_budget_present:true},scope:'Manifest key-name scan and exact router WIT shape only; no assertion about provider source, physical devices, aggregate memory, installer, or release.'},null,2));
