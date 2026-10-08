import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,readdir,chmod,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve,dirname} from 'node:path';
const targets={
  'x86_64-unknown-linux-gnu':['linux','x64'],'aarch64-unknown-linux-gnu':['linux','arm64'],
  'x86_64-apple-darwin':['darwin','x64'],'aarch64-apple-darwin':['darwin','arm64'],
  'x86_64-pc-windows-msvc':['win32','x64'],'aarch64-pc-windows-msvc':['win32','arm64'],
};
const compilerDigest='d2efa131dc65bbcd797512cf9628e329c137283b9817976d93dbc782d4b64661';
const profileName='wasmc-cli-aot-v1';
const hash=b=>createHash('sha256').update(b).digest('hex');
const licensePin={path:'LICENSE',bytes:3823,sha256:'7bca2d5818178e0bc14546700d39bf113d15139b1c3b6d1e62f621d4a276d6e3'};
const noticeManifestPin={path:'licenses/dependency-notices-v3.json',sha256:'cdc27945bedaf6efe19ecf284384904dae0f1fc137fb989f2fec12bb65cda06b'};
const noticePins=[
  {path:'licenses/DEPENDENCY-NOTICES-001.txt',bytes:245760,sha256:'66302f6dd71da97391ab2270d29b10e67bdbac6d7eb782bed043c2ff596ec5cc'},
  {path:'licenses/DEPENDENCY-NOTICES-002.txt',bytes:245760,sha256:'0065cf38006c9a66a6c3ee9cbaf8db10422b1e5301d3c1d5132b7855e71f18ea'},
  {path:'licenses/DEPENDENCY-NOTICES-003.txt',bytes:245760,sha256:'201dbac93dff17177b6379ee630b9658b4cec9cb9d46ce3982b3da87c4b740c8'},
  {path:'licenses/DEPENDENCY-NOTICES-004.txt',bytes:245760,sha256:'c439e1a409b6f23d5797cec339403a0ffce97e9fcf2ae91d6a923c36d619bb76'},
  {path:'licenses/DEPENDENCY-NOTICES-005.txt',bytes:245760,sha256:'04118f32afc6b2ce0fbfd559c56a78614016ab00167be2425c8c778fc7b064fe'},
  {path:'licenses/DEPENDENCY-NOTICES-006.txt',bytes:8357,sha256:'aa6000805f56d3c6009ffa09dbe224083cf2e63e2498e1939deefe6ca7c43d9a'},
];
function command(program,args) {
  const r=spawnSync(program,args,{encoding:'utf8',timeout:180000});
  if(r.status!==0)throw Error(program+' failed: '+r.stderr);
  return r.stdout.trim();
}
async function inventory(directory,prefix='') {
  const stat=await lstat(directory);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('linked package directory');
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=prefix?prefix+'/'+entry.name:entry.name;
    if(entry.isSymbolicLink())throw Error('linked package input');
    if(entry.isDirectory()){if(path!=='licenses')throw Error('unexpected package directory');result.push(...await inventory(join(directory,entry.name),path));}
    else if(entry.isFile())result.push(path);
    else throw Error('non-regular package input');
  }
  return result.sort();
}
async function verifyLicense(directory) {
  const raw=await readFile(join(directory,noticeManifestPin.path));
  if(hash(raw)!==noticeManifestPin.sha256)throw Error('independent notice manifest identity');
  const m=JSON.parse(raw);assert.equal(m.schema,'wasmc.release-notices-input/v1');assert.deepEqual(m.files,noticePins);
  for(const pin of [licensePin,...noticePins]) {
    const b=await readFile(join(directory,pin.path));
    if(b.length!==pin.bytes||hash(b)!==pin.sha256)throw Error('independent license snapshot identity');
  }
}
export async function verify(directory,source,target) {
  const profile=targets[target];
  if(!profile||profile[0]!==process.platform||profile[1]!==process.arch)throw Error('native target mismatch');
  const binary=process.platform==='win32'?'wasmc.exe':'wasmc';
  const files=[binary,'README.md','Cargo.lock',licensePin.path,noticeManifestPin.path,...noticePins.map(p=>p.path)].sort();
  assert.deepEqual(await inventory(directory),[...files,'manifest.json'].sort(),'package inventory mismatch');
  const manifest=JSON.parse(await readFile(join(directory,'manifest.json')));
  if(!/^[a-f0-9]{40}$/.test(source)||manifest.schema!=='wasmc-native-package/v3'||
    manifest.source!==source||manifest.target!==target||manifest.profile!==profileName||
    manifest.compiler_sha256!==compilerDigest||manifest.compiler_authority!=='portable-core-wasm'||
    manifest.run_backend!=='wasmi'||manifest.native_build_backend!=='wasmtime-aot'||manifest.stable!==false||
    JSON.stringify(Object.keys(manifest.files).sort())!==JSON.stringify(files))throw Error('package identity mismatch');
  for(const file of files) {
    const bytes=await readFile(join(directory,file));
    if(manifest.files[file].sha256!==hash(bytes)||manifest.files[file].bytes!==bytes.length)throw Error('package digest mismatch: '+file);
  }
  await verifyLicense(directory);
  await chmod(join(directory,binary),0o755);
  return resolve(directory,binary);
}
const [mode,directory,target,source]=process.argv.slice(2);
if(mode==='build') {
  const profile=targets[target];
  if(!profile||profile[0]!==process.platform||profile[1]!==process.arch)throw Error('not a native build');
  if(hash(await readFile('current/wasmc_compiler.wasm'))!==compilerDigest)throw Error('compiler drift');
  if(command('git',['rev-parse','HEAD'])!==source)throw Error('source mismatch');
  const tree=command('cargo',['+1.96.0','tree','--locked','--manifest-path','sdk/wasmc-native-compiler/Cargo.toml']);
  if(!/wasmi v2\.0\.0/.test(tree)||!/wasmtime v49\.0\.2/.test(tree))throw Error('runtime dependency identity mismatch');
  await verifyLicense('.');
  const binary=process.platform==='win32'?'wasmc.exe':'wasmc';
  await mkdir(directory,{recursive:false});
  await copyFile('sdk/wasmc-native-compiler/target/release/'+binary,join(directory,binary));
  for(const file of ['README.md','Cargo.lock'])await copyFile('sdk/wasmc-native-compiler/'+file,join(directory,file));
  for(const pin of [licensePin,noticeManifestPin,...noticePins]) {
    await mkdir(dirname(join(directory,pin.path)),{recursive:true});
    await copyFile(pin.path,join(directory,pin.path));
  }
  const files={};
  for(const file of await inventory(directory)){const b=await readFile(join(directory,file));files[file]={bytes:b.length,sha256:hash(b)};}
  await writeFile(join(directory,'manifest.json'),JSON.stringify({
    schema:'wasmc-native-package/v3',source,target,profile:profileName,compiler_sha256:compilerDigest,
    compiler_authority:'portable-core-wasm',run_backend:'wasmi',native_build_backend:'wasmtime-aot',
    stable:false,toolchain:command('rustc',['+1.96.0','-Vv']),files
  },null,2)+'\n');
}
if(mode==='build'||mode==='verify') {
  const binary=await verify(directory,source,target);
  const receipt=JSON.parse(command(process.execPath,['scripts/test-native-compiler.mjs',binary]));
  if(!receipt.accepted||receipt.byte_parity_cases!==5||receipt.wasmi_run_cases!==4||
    receipt.native_execution_cases!==4||receipt.no_clobber_cases!==9)throw Error('invalid behavior receipt');
  console.log(JSON.stringify({accepted:true,source,target,profile:profileName,license_snapshots:7,original_notice_manifest_bound:true,...receipt}));
}
