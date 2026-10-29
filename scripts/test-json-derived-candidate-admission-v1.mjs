import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {readFile,writeFile,cp,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {qualifyJsonDerivedCandidate} from './json-derived-candidate-admission-v1.mjs';
import {sha} from './lib-refresh-cache-v2.mjs';
const [privateRoot,publicRoot,producerPath,oldProducerPath,witPath,apiProducerPath]=process.argv.slice(2).map(p=>resolve(p));
const args={privateRoot,publicRoot,producerPath,producerSha:'d727656f714398439b63d7716f768fce3580476242989b05ad263ecb9365bc67',witPath,witSha:'40c3d0e890e86cc86ef186fe3e504cd62d03da90fe0a1fc81b6588d078bd0a65',catalogSha:'ac32312f3e06f7ca2b3f8e20d66ecd4914f1ffd10ad45ae1cef4ff06a9628192',oldSha:'355bcc7cf6e006616f9e7938b9c5222d922ef76590e27db633e88c64036816c2',receiptSha:'6b827fc92e3de5b73fe55e7f5112404737bbdc5a2fcba295a6a35849bbc7fb28',commit:'f0166ba76b8613f6decd1ab7c362ca8a9cd90031',version:'0.0.31'};
const pass=await qualifyJsonDerivedCandidate(args);assert.equal(pass.accepted,true);assert.equal(pass.private_derived_verified,true);assert.equal(pass.producer_source_admitted,false);assert.equal(pass.formal_release,false);assert.equal(pass.packages,43);assert.equal(pass.root_files,823);assert.equal(pass.public_notice_paths,448);
assert.ok(pass.public_input_paths.every(p=>!p.startsWith('proof/')&&!p.startsWith('.agents/')&&!p.includes('producer')));
const apiPass=await qualifyJsonDerivedCandidate({...args,producerPath:apiProducerPath,producerSha:'1813308d058e38b511e7ff0011507631be2a828c4d2b5a77e7669f31cf3b25af'});assert.equal(apiPass.private_derived_verified,true);assert.equal(apiPass.catalog_sha256,pass.catalog_sha256);assert.equal(apiPass.producer_source_admitted,false);
const tmp=await mkdtemp(join(tmpdir(),'wasmc-json-derived-preflight-'));
try{
 const changed=join(tmp,'public');await cp(publicRoot,changed,{recursive:true,mode:constants.COPYFILE_FICLONE});const notice=join(changed,'current-libs/wasmc-json/0.2.4/licenses/DEPENDENCY-NOTICES-014.txt');await writeFile(notice,Buffer.concat([await readFile(notice),Buffer.from('\nchanged\n')]));
 const controls=[['wrong producer pin',{producerSha:'0'.repeat(64)}],['old producer with honest pin',{producerPath:oldProducerPath,producerSha:sha(await readFile(oldProducerPath))}],['wrong receipt',{receiptSha:'0'.repeat(64)}],['wrong Git authority',{commit:'0'.repeat(40)}],['altered public notice',{publicRoot:changed}]];
 for(const [label,overrides] of controls){await assert.rejects(qualifyJsonDerivedCandidate({...args,...overrides}),undefined,label);console.log('rejected '+label);}
}finally{await rm(tmp,{recursive:true,force:true});}
console.log(JSON.stringify({accepted:true,private_derived_verified:true,packages:pass.packages,root_files:pass.root_files,public_notice_paths:pass.public_notice_paths,controls:5,api_producer_qualified:true,producer_source_admitted:false,formal_release:false}));
