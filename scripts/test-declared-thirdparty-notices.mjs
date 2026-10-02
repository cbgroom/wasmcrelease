import assert from 'node:assert/strict';
import {sha256} from './lib-catalog.mjs';
import {collectDeclaredThirdPartyNotices,isExactDeclaredNotice} from './declared-thirdparty-notices.mjs';
function fixture(){
 const files=new Map(),root='current-libs/test/1.0.0',put=(p,b)=>{b=Buffer.from(b);files.set(p,b);return {path:p,bytes:b.length,sha256:sha256(b)};};
 const license=Buffer.from('WAsmC Research-Only Non-Commercial License 1.0\nsolely for Non-Commercial Research\n'),notice=Buffer.from('MIT'+' License\nOriginal third-party text.\n');
 const manifest={schema:'wasmc.lib/v2',id:'test',version:'1.0.0',license:{schema:'wasmc.lib-license/v1',identifier:'WAsmC-Research-Only-Non-Commercial-1.0',files:[{path:'LICENSE',bytes:license.length,sha256:sha256(license)},{path:'licenses/DEPENDENCY-NOTICES-001.txt',bytes:notice.length,sha256:sha256(notice)}]}};
 for(const [p,b]of [['LICENSE',license],['licenses/DEPENDENCY-NOTICES-001.txt',notice],['artifact.wasm','wasm'],['lib.wit','wit'],['lib.json',JSON.stringify(manifest)]])put(root+'/'+p,b);
 const row={id:'test',version:'1.0.0',root,wit_package:'test:test@1.0.0',wit_sha256:sha256(files.get(root+'/lib.wit')),artifact_sha256:sha256(files.get(root+'/artifact.wasm')),keywords:[],historical:false,files:[]};
 const catalog={schema:'wasmc.public-lib-catalog/v1',release_tag:'future-test',release_commit:'a'.repeat(40),packages:[row]},policy={package_authority_commit:catalog.release_commit};
 const refresh=()=>{row.files=[...files].map(([path,b])=>({path,bytes:b.length,sha256:sha256(b)}));const raw=Buffer.from(JSON.stringify(catalog));policy.thirdparty_notice_catalog_sha256=sha256(raw);return raw;};
 const json=p=>JSON.parse(files.get(p)),write=(p,v)=>files.set(p,Buffer.from(JSON.stringify(v))),read=p=>{if(!files.has(p))throw Error('missing');return files.get(p);};
 const raw=refresh();return {files,root,manifest,catalog,policy,refresh,json,write,read,raw};
}
const f=fixture(),notices=await collectDeclaredThirdPartyNotices(f.raw,f.policy,f.read),p=f.root+'/licenses/DEPENDENCY-NOTICES-001.txt';
assert.equal(notices.size,1);assert.equal(isExactDeclaredNotice(p,f.files.get(p),notices),true);
assert.equal(isExactDeclaredNotice(f.root+'/LICENSE',f.files.get(f.root+'/LICENSE'),notices),false);
assert.equal(isExactDeclaredNotice('undeclared/NOTICE.txt',f.files.get(p),notices),false);
assert.equal(isExactDeclaredNotice(p,Buffer.from('changed'),notices),false);
let negatives=3;
async function reject(mutate,refresh=false){const t=fixture();mutate(t);const raw=refresh?t.refresh():t.raw;await assert.rejects(()=>collectDeclaredThirdPartyNotices(raw,t.policy,t.read));negatives++;}
await reject(t=>delete t.policy.thirdparty_notice_catalog_sha256);
await reject(t=>t.policy.thirdparty_notice_catalog_sha256='0'.repeat(64));
await reject(t=>t.policy.package_authority_commit='b'.repeat(40));
await reject(t=>t.files.set(t.root+'/LICENSE',Buffer.from('MIT'+' License\n')));
await reject(t=>t.files.set(t.root+'/licenses/DEPENDENCY-NOTICES-001.txt',Buffer.from('changed')));
await reject(t=>t.files.delete(t.root+'/licenses/DEPENDENCY-NOTICES-001.txt'));
await reject(t=>{const m=t.json(t.root+'/lib.json');m.license.files[1].sha256='0'.repeat(64);t.write(t.root+'/lib.json',m);});
await reject(t=>{const m=t.json(t.root+'/lib.json');m.license.files[1].path='../NOTICE';t.write(t.root+'/lib.json',m);},true);
await reject(t=>{const m=t.json(t.root+'/lib.json');m.license.files[1].bytes=262145;t.write(t.root+'/lib.json',m);},true);
await reject(t=>{const m=t.json(t.root+'/lib.json');m.license.files.push(m.license.files[1]);t.write(t.root+'/lib.json',m);},true);
await reject(t=>{const m=t.json(t.root+'/lib.json');m.license.identifier='MIT';t.write(t.root+'/lib.json',m);},true);
// Even self-rehashed catalog/package edits reject the independent original pin.
await reject(t=>{t.catalog.packages[0].keywords=['rewritten'];t.raw=Buffer.from(JSON.stringify(t.catalog));});
const legacy=fixture(),m=legacy.json(legacy.root+'/lib.json');delete m.license;legacy.write(legacy.root+'/lib.json',m);const legacyRaw=legacy.refresh();delete legacy.policy.thirdparty_notice_catalog_sha256;
assert.equal((await collectDeclaredThirdPartyNotices(legacyRaw,legacy.policy,legacy.read)).size,0);
console.log(JSON.stringify({accepted:true,declared_notice_files:1,negative_controls:negatives,legacy_exemptions:0,legal_compatibility:false}));
