import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {currentIndex} from '../../../../../scripts/lib-current-index-v2.mjs';
import {CurrentSearchCaller,currentIndexEntries} from '../../../../../scripts/current-lib-search-v3.mjs';
const [source,root,manifestPin,out]=process.argv.slice(2);assert.ok([source,root,out].every(x=>x&&resolve(x)===x));assert.match(manifestPin??'',/^[0-9a-f]{64}$/);assert.ok(!existsSync(out));mkdirSync(out);
const hash=x=>createHash('sha256').update(x).digest('hex'),manifestBytes=readFileSync(join(root,'lib.json')),manifest=JSON.parse(manifestBytes),core=readFileSync(join(root,'artifact.wasm')),abi=readFileSync(join(root,'core-abi.json'));
assert.equal(hash(manifestBytes),manifestPin);assert.equal(manifest.version,'0.6.0');assert.equal(hash(core),manifest.artifact.sha256);assert.equal(hash(abi),manifest.core_abi.sha256);
const outputs=[];
for(const kind of ['count','bytes'])for(const version of ['0.6.0','0.5.0']){
 const target=join(out,kind+'-'+version);cpSync(source,target,{recursive:true,errorOnExist:true,force:false});const witPath=join(target,'libspec/wasmc-lib-search/lib.wit'),specPath=join(target,'libspec/wasmc-lib-search/lib.json');let wit=readFileSync(witPath,'utf8'),spec=JSON.parse(readFileSync(specPath));assert.equal(spec.version,'0.6.0');
 if(kind==='count'){const needle='  snapshot: func(index: string)';assert.equal(wit.split(needle).length,2);wit=wit.replace(needle,Array.from({length:4100},(_,i)=>`  extra-${String(i).padStart(4,'0')}: func() -> u32;\n`).join('')+needle)}else spec.description='x'.repeat(2*1024*1024+1);
 if(version==='0.5.0'){spec.version=version;wit=wit.replace('package wasmc:lib-search@0.6.0;','package wasmc:lib-search@0.5.0;')}
 writeFileSync(witPath,wit);writeFileSync(specPath,JSON.stringify(spec,null,2)+'\n');
 if(version==='0.5.0'){await assert.rejects(currentIndex(target),new RegExp(kind==='count'?'index entry budget':'index byte budget'));outputs.push({kind,version,rejected:true});continue;}
 const generated=await currentIndex(target);const entries=currentIndexEntries(generated.index),caller=new CurrentSearchCaller(generated.bytes,core,abi),snapshot=caller.snapshot();assert.equal(snapshot.tag,'ok');assert.equal(snapshot.value.entry_count,entries.length);assert.equal(snapshot.value.index_sha256,hash(generated.bytes));const last=entries.at(-1);assert.deepEqual(caller.lookup(last.identity),{tag:'ok',value:last});
 if(kind==='count'){assert(entries.length>4096);assert.deepEqual(caller.search({text:'',package_id:null,profile:null,bound_only:false},0,entries.length),{tag:'ok',value:entries})}else assert(generated.bytes.length>2*1024*1024);
 outputs.push({kind,version,entries:entries.length,bytes:generated.bytes.length,index_sha256:hash(generated.bytes)});
}
console.log(JSON.stringify({accepted:true,manifest_sha256:manifestPin,core_sha256:hash(core),outputs,scope:'synthetic source fixtures and installed candidate Search Core; no release'}));
