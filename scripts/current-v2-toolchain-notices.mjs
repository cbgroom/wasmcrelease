#!/usr/bin/env node
// Copy only public license documents, never compiler/provider implementation.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,lstatSync,readdirSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination='admission/current-v2-next/toolchain-notices';
const hash=b=>createHash('sha256').update(b).digest('hex');
const version='1.96.0',host='aarch64-apple-darwin';
const archiveUrl=`https://static.rust-lang.org/dist/2026-05-28/rustc-${version}-${host}.tar.xz`;
const archiveSha='1bb7b0bad1d2a42fc4173ede6dd460de2774fc1858a8369329d3e081e4e3426c';
const names=['COPYRIGHT-library.html','COPYRIGHT.html'];
// Independently pinned after verifying the complete official distribution archive.
const materialPins=[
  {sha256:'21dde0bf222fb29c952bf139bed07eebbc134683d50bdabe509255e2d13d1488',bytes:14830,uncompressed_sha256:'78c163fcec50e64bfd85fedb850c273595602fafa2b41f30f75d4e410b80ee83',uncompressed_bytes:425651},
  {sha256:'f2af1e8e437cba95c5efe850ed8f494d0bea171709afeadf2c0ccc156f0f0b59',bytes:429924,uncompressed_sha256:'139ebc62da648fa8dfea9d11ca6919ac417e8bfaffa08795341a414097a1fe24',uncompressed_bytes:15404403},
];
const scope='Conservative Rust compiler/library copyright documents. Tools themselves are not distributed. No target-reachability or legal opinion claim.';
const manifestPaths=[
  ...['http1','host-clock','owned-algorithms','resource-counter'].map(x=>`admission/current-v2-next/packages/wasmc-${x}/${x==='owned-algorithms'?'0.1.0':'0.0.1'}/lib.json`),
  'admission/current-v2-data-core/packages/wasmc-data-core/0.0.1/lib.json',
];
function builtToolchain(){
  const rows=manifestPaths.map(path=>({path,manifest_sha256:hash(readFileSync(join(root,path))),toolchain:JSON.parse(readFileSync(join(root,path))).build.toolchain}));
  for(const row of rows)assert.deepEqual(row.toolchain,rows[0].toolchain,'package toolchains differ');
  return {packages:rows.map(({path,manifest_sha256})=>({path,manifest_sha256})),toolchain:rows[0].toolchain};
}
export function validateToolchainNotices(value,base=root){
  assert.deepEqual(Object.keys(value).sort(),['schema','build','distribution','official_archive_verified','installed_notices_match_distribution','materials','scope','full_transitive_license_audit','release_qualified'].sort());
  assert.equal(value.schema,'wasmc.current-v2-toolchain-notices/v1');
  assert.deepEqual(value.build,builtToolchain());
  assert.deepEqual(value.distribution,{url:archiveUrl,sha256:archiveSha});
  assert.equal(value.official_archive_verified,true);assert.equal(value.installed_notices_match_distribution,true);
  assert.equal(value.full_transitive_license_audit,false);assert.equal(value.release_qualified,false);
  assert.equal(value.scope,scope);
  assert.equal(value.materials.length,names.length);
  assert.deepEqual(readdirSync(join(base,destination)).sort(),[...names.map(x=>x+'.gz'),'receipt.json'].sort(),'unexpected toolchain notice inventory');
  const receiptFile=join(base,destination,'receipt.json');assert(lstatSync(receiptFile).isFile()&&!lstatSync(receiptFile).isSymbolicLink(),'linked toolchain receipt');
  assert.deepEqual(JSON.parse(readFileSync(receiptFile)),value,'receipt file drift');
  for(let i=0;i<names.length;i++){
    const row=value.materials[i];assert.equal(row.path,`${destination}/${names[i]}.gz`);
    assert.deepEqual(Object.keys(row).sort(),['path','sha256','bytes','uncompressed_sha256','uncompressed_bytes','archive_member','installed_matches_official'].sort());
    for(const [key,expected]of Object.entries(materialPins[i]))assert.equal(row[key],expected,'independently pinned toolchain material drift');
    const path=join(base,row.path);assert(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink());
    for(let parent=dirname(path);parent!==dirname(resolve(base));parent=dirname(parent))assert(lstatSync(parent).isDirectory()&&!lstatSync(parent).isSymbolicLink());
    const bytes=readFileSync(path);assert.equal(hash(bytes),row.sha256);assert.equal(bytes.length,row.bytes);
    const content=gunzipSync(bytes,{maxOutputLength:32*1024*1024});assert.equal(hash(content),row.uncompressed_sha256);assert.equal(content.length,row.uncompressed_bytes);
    assert.equal(row.archive_member,`rustc-${version}-${host}/rustc/share/doc/rust/${names[i]}`);
    assert.equal(row.installed_matches_official,true);
  }
  return {accepted:true,packages:value.build.packages.length,official_toolchain_notice_files:names.length,full_transitive_license_audit:false,release_qualified:false};
}
async function capture(){
  const build=builtToolchain();
  for(const [tool,key] of [['rustc','rustc_version_verbose_sha256'],['cargo','cargo_version_verbose_sha256']]){
    // Producer fingerprint hashes trimmed UTF-8 version output, not its terminal newline.
    const output=execFileSync(tool,[`+${version}`,'--version','--verbose'],{encoding:'utf8'}).trim();assert.equal(hash(output),build.toolchain[key],'active toolchain is not the exact package builder');
  }
  const sysroot=execFileSync('rustc',[`+${version}`,'--print','sysroot'],{encoding:'utf8'}).trim();
  const response=await fetch(archiveUrl,{signal:AbortSignal.timeout(180000)});assert.equal(response.status,200);
  const archive=Buffer.from(await response.arrayBuffer());assert.equal(hash(archive),archiveSha,'official distribution digest drift');
  const members=execFileSync('tar',['-tJf','-'],{input:archive,encoding:'utf8',maxBuffer:32*1024*1024}).trim().split('\n');
  const materials=[];mkdirSync(join(root,destination),{recursive:true});
  for(const name of names){
    const candidates=members.filter(x=>x.endsWith('/'+name));
    assert.equal(candidates.length,1,`official compiler distribution is missing ${name}`);
    const member=candidates[0];
    const content=execFileSync('tar',['-xOJf','-',member],{input:archive,maxBuffer:32*1024*1024});
    assert.deepEqual(content,readFileSync(join(sysroot,'share/doc/rust',name)),'installed toolchain notice differs from official archive');
    const bytes=gzipSync(content,{level:9});const path=`${destination}/${name}.gz`;writeFileSync(join(root,path),bytes);
    materials.push({path,sha256:hash(bytes),bytes:bytes.length,uncompressed_sha256:hash(content),uncompressed_bytes:content.length,archive_member:member,installed_matches_official:true});
  }
  const value={schema:'wasmc.current-v2-toolchain-notices/v1',build,distribution:{url:archiveUrl,sha256:archiveSha},official_archive_verified:true,installed_notices_match_distribution:true,materials,
    scope,full_transitive_license_audit:false,release_qualified:false};
  writeFileSync(join(root,destination,'receipt.json'),JSON.stringify(value,null,2)+'\n');validateToolchainNotices(value);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);assert(args.length===0||(args.length===1&&args[0]==='--capture'));
  if(args.length)await capture();
  console.log(JSON.stringify(validateToolchainNotices(JSON.parse(readFileSync(join(root,destination,'receipt.json'))))));
}
