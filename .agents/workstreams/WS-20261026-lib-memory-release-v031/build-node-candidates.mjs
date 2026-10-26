import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {buildNative} from '../../../scripts/lib-refresh-native-v2.mjs';
import {attachReleaseLicense,sha,verifyRoot} from '../../../scripts/lib-refresh-cache-v2.mjs';
const own=resolve('.agents/workstreams/WS-20261026-lib-memory-release-v031');
const license=await readFile('LICENSE'),input=JSON.parse(await readFile(join(own,'producer/inputs/notices/additional-notices.json')));
const notices=await Promise.all(input.files.map(async pin=>({path:pin.path,sha256:pin.sha256,content:await readFile(pin.path.endsWith('007.txt')?join(own,'producer/inputs/notices/DEPENDENCY-NOTICES-007.txt'):pin.path)})));
const builder=await readFile('scripts/lib-refresh-native-v2.mjs'),logBase='/Users/youxianshi/.local/state/wasmc-maintenance/20261026-lib-memory-json-32/node-candidate-recovery-logs';const roots=[];
for(const id of ['wasmc-system-file-prototype','wasmc-system-network-prototype']){
 const logs=join(logBase,id);await mkdir(logs,{recursive:true});
 const source=join(own,'native-node',id),spec=JSON.parse(await readFile(join(source,'lib.json'))),root=join(own,'candidate-roots',id,spec.version),files=['lib.wit',...spec.native.files];
 const payloads=Object.fromEntries(await Promise.all(files.map(async p=>[p,await readFile(join(source,p))])));await mkdir(root,{recursive:true});
 const status=await buildNative(spec,payloads,root,{repo:process.cwd(),env:process.env,logs,producerSha:sha(builder),nativeToolchain:{platform:process.platform,arch:process.arch,node:process.version}});
 await attachReleaseLicense(root,license,sha(license),notices);const verified=await verifyRoot(root,id,spec.version,'native');
 roots.push({id,version:spec.version,status,source_manifest_sha256:sha(await readFile(join(source,'lib.json'))),manifest_sha256:verified.manifest_sha256,artifact_sha256:verified.manifest.artifact.sha256,host_executor_sha256:sha(await readFile('host/runtime/lib-boundary/reference.mjs'))});
}
await writeFile(join(own,'qualification/node-candidate-build.json'),JSON.stringify({accepted:true,roots,current_catalog:false,formal_release:false},null,2)+'\n');console.log(JSON.stringify({accepted:true,roots}));
