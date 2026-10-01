#!/usr/bin/env node
// Capture reviewed upstream source evidence; never change generated Lib roots.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=join(root,'admission/current-v2-next/upstream');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const groups=[
  {id:'wasmc-http1',source:'libsrc/wasmc-http1',packageRoot:'admission/current-v2-next/packages/wasmc-http1/0.0.1',
   repository:'https://github.com/seanmonstar/httparse',tag:'v1.10.1',commit:'9f29e79f9832dbd0ae5220acb17c1866745bdecd',
   crates:['httparse'],version:'1.10.1',license:'MIT OR Apache-2.0',crate_licenses:{httparse:'MIT OR Apache-2.0'},
   supported:['HTTP/1.0 and HTTP/1.1 request head parsing via httparse::Request::parse'],
   unsupported:['response parsing API','HTTP/2','TLS','socket I/O','transfer-encoding framing'],
   delta:['owned WIT request fields replace borrowed Rust slices','32 headers, 65536 input/output bytes and 1048576 body bytes','WIT errors normalize httparse errors','content-length framing and response serialization are adapter-owned, not upstream httparse APIs']},
  {id:'wasmc-data-core',source:'libsrc/wasmc-data-core',packageRoot:'admission/current-v2-data-core/packages/wasmc-data-core/0.0.1',
   repository:'https://github.com/apache/arrow-rs',tag:'60.0.0',commit:'ef1fa157977633f0ba21aa921f9ef3d5c669235b',
   crates:['arrow-array','arrow-buffer','arrow-cmp','arrow-data','arrow-schema','arrow-select'],version:'60.0.0',license:'Apache-2.0 AND MIT',
   crate_licenses:{'arrow-array':'Apache-2.0 AND MIT','arrow-buffer':'Apache-2.0','arrow-cmp':'Apache-2.0','arrow-data':'Apache-2.0','arrow-schema':'Apache-2.0','arrow-select':'Apache-2.0'},
   supported:['RecordBatch validation','arrow_select::take with checked indices','Boolean, Int64, UInt64, Float64, Utf8 and Binary columns with nulls'],
   unsupported:['other Arrow data types','Arrow C Data Interface','IPC/Parquet','streaming','public Arrow Rust layouts'],
   delta:['owned WIT snapshots replace Arrow reference-counted arrays','adapter validates field uniqueness, row lengths, types and nullability','zero-column take explicitly preserves selected row count','WIT errors normalize Arrow errors']}
];
const extract=(archive,path)=>execFileSync('tar',['-xzOf','-',path],{input:archive,maxBuffer:16<<20});
const list=archive=>execFileSync('tar',['-tzf','-'],{input:archive,encoding:'utf8',maxBuffer:16<<20}).trim().split('\n');
const lockRows=source=>readFileSync(join(root,source,'Cargo.lock'),'utf8').split('[[package]]').slice(1).map(block=>{
  const get=key=>block.match(new RegExp(`^${key} = "([^"\\n]+)"`,'m'))?.[1];
  return {name:get('name'),version:get('version'),checksum:get('checksum')};
});
const identity=group=>{
  const bytes=readFileSync(join(root,group.packageRoot,'lib.json')),m=JSON.parse(bytes);
  const lock=readFileSync(join(root,group.source,'Cargo.lock'));
  assert.equal(sha(readFileSync(join(root,group.packageRoot,m.artifact.path))),m.artifact.sha256);
  assert.equal(sha(readFileSync(join(root,group.packageRoot,m.component.path))),m.component.sha256);
  assert.equal(m.build.inputs.find(x=>x.kind==='cargo-lock').sha256,sha(lock),'lock differs from actual producer input');
  return {root:group.packageRoot,manifest_sha256:sha(bytes),artifact_sha256:m.artifact.sha256,component_sha256:m.component.sha256,
    cargo_lock_sha256:sha(lock),adapter_sha256:sha(readFileSync(join(root,group.source,'src/lib.rs'))),
    adapter_license:{path:'LICENSE',sha256:sha(readFileSync(join(root,'LICENSE'))),name:'WAsmC Research-Only Non-Commercial License 1.0',upstream_license_override:false}};
};
export function validateUpstreamReceipt(receipt,base=root){
  assert.equal(receipt.schema,'wasmc.current-v2-upstream-review/v1');
  assert.equal(receipt.accepted,true);
  assert.equal(receipt.releases_or_relicenses_upstream,false);
  assert.equal(receipt.full_transitive_license_audit,false);
  assert.equal(receipt.release_qualified,false);
  assert.equal(receipt.groups.length,groups.length);
  for(const group of groups){
    const row=receipt.groups.find(x=>x.id===group.id);assert(row);
    for(const key of ['repository','tag','commit','version','license','crate_licenses','crates','supported','unsupported','delta']) assert.deepEqual(row[key],group[key],key);
    assert.deepEqual(row.identity,identity(group));
    assert.match(row.repository_archive_sha256,/^[a-f0-9]{64}$/);
    assert.equal(row.registry.length,group.crates.length);
    for(const name of group.crates){
      const crate=row.registry.find(x=>x.name===name),locked=lockRows(group.source).find(x=>x.name===name);
      assert(crate);assert.equal(crate.version,group.version);assert.equal(crate.archive_sha256,locked.checksum);
      assert.equal(crate.repository,row.repository);assert.equal(crate.license,group.crate_licenses[name]);
      assert.equal(crate.source_matches_repository_commit,true);assert(crate.rust_source_files>0);
      const expectedNotices=name==='httparse'?['LICENSE-APACHE','LICENSE-MIT']:
        name==='arrow-array'?['LICENSE-MIT','LICENSE.txt','NOTICE.txt']:['LICENSE.txt','NOTICE.txt'];
      assert.deepEqual(crate.notices.map(x=>x.path.split('/').at(-1)).sort(),expectedNotices.sort(),'incomplete upstream notices');
      for(const notice of crate.notices){
        assert.match(notice.path,/^admission\/current-v2-next\/upstream\/notices\/[a-z0-9-]+\/[A-Za-z0-9_.-]+$/);
        const path=join(base,notice.path);assert(lstatSync(path).isFile());assert(!lstatSync(path).isSymbolicLink());
        for(let parent=dirname(path);parent!==dirname(resolve(base));parent=dirname(parent)){
          assert(lstatSync(parent).isDirectory());assert(!lstatSync(parent).isSymbolicLink(),'linked notice directory');
        }
        assert.equal(sha(readFileSync(path)),notice.sha256,'upstream notice drift');
      }
    }
  }
  return {accepted:true,packages:groups.length,upstream_crates:receipt.groups.reduce((n,x)=>n+x.registry.length,0),full_transitive_license_audit:false,release_qualified:false};
}
async function capture(cache){
  const result={schema:'wasmc.current-v2-upstream-review/v1',accepted:true,releases_or_relicenses_upstream:false,
    full_transitive_license_audit:false,release_qualified:false,
    license_scope:'Upstream licenses remain intact. The new WAsmC adapter is governed by repository LICENSE. This review is not a full transitive dependency license audit or legal opinion.',
    groups:[]};
  for(const group of groups){
    const refs=execFileSync('git',['ls-remote',group.repository+'.git',`refs/tags/${group.tag}`,`refs/tags/${group.tag}^{}`],{encoding:'utf8'}).trim().split('\n');
    assert.equal(refs.at(-1).split(/\s/)[0],group.commit,'upstream tag drift');
    const archiveUrl=group.repository.replace('https://github.com/','https://codeload.github.com/')+`/tar.gz/${group.commit}`;
    const response=await fetch(archiveUrl);assert.equal(response.status,200);
    const archive=Buffer.from(await response.arrayBuffer()),repoFiles=list(archive),prefix=repoFiles[0];
    assert(prefix.endsWith('/'));
    const row={...group,identity:identity(group),repository_archive_url:archiveUrl,repository_archive_sha256:sha(archive),registry:[]};
    for(const name of group.crates){
      const locked=lockRows(group.source).find(x=>x.name===name);assert(locked);assert.equal(locked.version,group.version);
      const bytes=readFileSync(join(cache,`${name}-${group.version}.crate`));assert.equal(sha(bytes),locked.checksum,'registry archive checksum mismatch');
      const files=list(bytes),cratePrefix=`${name}-${group.version}/`;
      const cargo=extract(bytes,cratePrefix+'Cargo.toml').toString();
      assert.equal(cargo.match(/^license = "([^"]+)"/m)?.[1],group.crate_licenses[name]);
      assert.equal(cargo.match(/^repository = "([^"]+)"/m)?.[1]?.replace(/\.git$/,''),group.repository);
      const sourceFiles=files.filter(x=>x.startsWith(cratePrefix+'src/')&&x.endsWith('.rs'));
      for(const path of sourceFiles){
        const relative=path.slice(cratePrefix.length),repoPath=prefix+(name==='httparse'?'':name+'/')+relative;
        assert(repoFiles.includes(repoPath),`source missing in pinned repo: ${repoPath}`);
        assert.deepEqual(extract(bytes,path),extract(archive,repoPath),`registry/repository Rust source drift: ${name}/${relative}`);
      }
      const notices=[];
      for(const path of files.filter(x=>/^((LICENSE|NOTICE)[^/]*)$/.test(x.slice(cratePrefix.length)))){
        const noticePath=`admission/current-v2-next/upstream/notices/${name}/${path.slice(cratePrefix.length)}`;
        const content=extract(bytes,path);mkdirSync(dirname(join(root,noticePath)),{recursive:true});writeFileSync(join(root,noticePath),content);
        notices.push({path:noticePath,sha256:sha(content)});
      }
      row.registry.push({name,version:group.version,repository:group.repository,license:group.crate_licenses[name],
        archive_url:`https://static.crates.io/crates/${name}/${name}-${group.version}.crate`,archive_sha256:sha(bytes),
        source_matches_repository_commit:true,rust_source_files:sourceFiles.length,notices});
    }
    result.groups.push(row);
  }
  validateUpstreamReceipt(result);mkdirSync(destination,{recursive:true});writeFileSync(join(destination,'review.json'),JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args[0]==='--capture'){assert.equal(args.length,2);await capture(resolve(args[1]));}
  else assert.equal(args.length,0,'usage: current-v2-upstream-provenance.mjs [--capture CARGO_REGISTRY_CACHE]');
  console.log(JSON.stringify(validateUpstreamReceipt(JSON.parse(readFileSync(join(destination,'review.json'))))));
}
