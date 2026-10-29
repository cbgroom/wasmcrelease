// Compile the downloaded Core SDK sources directly; no Cargo project or
// network dependency resolution enters this caller-side qualification.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha} from './lib-refresh-cache-v2.mjs';

export async function qualifyNetworkRustSdk({catalogPath,catalogSha,installPath,installSha,networkRoot,previousParent,out,rustc,rustcVersion}) {
  for(const p of [catalogPath,installPath,networkRoot,previousParent,out,rustc])assert.ok(isAbsolute(p));
  for(const p of [catalogSha,installSha])assert.match(p,/^[0-9a-f]{64}$/);
  const catalogBytes=await readFile(catalogPath),installBytes=await readFile(installPath);
  assert.equal(sha(catalogBytes),catalogSha);assert.equal(sha(installBytes),installSha);
  const catalog=JSON.parse(catalogBytes),installed=JSON.parse(installBytes);
  assert.equal(installed.schema,'wasmc.mixed-network-cohort-install/v1');assert.equal(installed.accepted,true);
  assert.equal(installed.catalog_sha256,catalogSha);assert.equal(installed.artifact_commit,catalog.package_authority_commit);
  assert.equal(installed.rows.length,catalog.packages.length);assert.equal(new Set(installed.rows.map(r=>r.id)).size,installed.rows.length);
  const version=await new Promise((ok,fail)=>{const p=spawn(rustc,['--version'],{stdio:['ignore','pipe','pipe']});let s='',err='';p.stdout.on('data',b=>s+=b);p.stderr.on('data',b=>err+=b);p.on('error',fail);p.on('close',n=>n===0?ok(s.trim()):fail(Error(err)));});
  assert.equal(version,rustcVersion,'Rust compiler identity');
  const selected=[],otherEditions=[],component=[];
  for(const row of catalog.packages){const i=installed.rows.find(x=>x.id===row.id);assert.ok(i?.accepted);
    assert.equal(i.version,row.version);assert.equal(i.manifest_sha256,row.manifest_sha256);
    const dst=i.reused?join(previousParent,`mixed-network-installed-${row.id}-20261029`):join(networkRoot,'packages',row.id);
    const root=join(dst,row.root),manifestBytes=await readFile(join(root,'lib.json'));assert.equal(sha(manifestBytes),row.manifest_sha256);
    const manifest=JSON.parse(manifestBytes);
    for(const [kind,binding] of Object.entries(manifest.bindings??{})){
      if(!binding.cargo_toml)continue;
      const cargo=await readFile(join(root,binding.cargo_toml.path));assert.equal(sha(cargo),binding.cargo_toml.sha256);
      const match=/^edition\s*=\s*"(\d+)"\s*$/m.exec(cargo.toString('utf8'));assert.ok(match,'SDK edition required');
      const entry={id:row.id,version:row.version,kind,edition:match[1],manifest_sha256:row.manifest_sha256};
      if(kind==='rust_component'){component.push(entry);continue;}
      if(kind!=='rust_core')continue;
      if(match[1]!=='2024'){otherEditions.push(entry);continue;}
      const source=join(root,binding.source.path),bytes=await readFile(source);assert.equal(sha(bytes),binding.source.sha256);
      selected.push({...entry,source,source_sha256:binding.source.sha256});
    }
  }
  assert.ok(selected.length>0);await mkdir(out);const queue=[...selected],results=[];
  async function worker(){for(;;){const row=queue.shift();if(!row)return;
    const destination=join(out,'lib'+row.id.replaceAll('-','_')+'.rlib');
    const run=await new Promise((ok,fail)=>{const p=spawn(rustc,['--edition=2024','--target','wasm32-unknown-unknown','--crate-name','sdk',
      '--crate-type','rlib','-C','opt-level=2','-Awarnings',row.source,'-o',destination],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
      p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',fail);p.on('close',code=>ok({code,stdout,stderr}));});
    assert.equal(sha(await readFile(row.source)),row.source_sha256,'SDK changed during compilation');
    const result={id:row.id,version:row.version,source_sha256:row.source_sha256,accepted:run.code===0,exit_code:run.code,
      rlib_sha256:run.code===0?sha(await readFile(destination)):null,stderr:run.stderr};results.push(result);
    await writeFile(join(out,row.id+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  }}
  await Promise.all([worker(),worker()]);results.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const receipt={schema:'wasmc.network-rust-sdk-2024/v1',accepted:results.length===selected.length&&results.every(r=>r.accepted),
    catalog_sha256:catalogSha,install_receipt_sha256:installSha,artifact_commit:catalog.package_authority_commit,
    rustc_version:version,target:'wasm32-unknown-unknown',rust_core_2024:results,other_core_editions:otherEditions,
    component_manifest_editions:component,scope:'Rust 2024 Core SDK compilation from anonymous installed Roots; Component SDK declarations only; no execution, device or formal release.',formal_release:false};
  await writeFile(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [catalogPath,catalogSha,installPath,installSha,networkRoot,previousParent,out,rustc,rustcVersion]=process.argv.slice(2);
  qualifyNetworkRustSdk({catalogPath,catalogSha,installPath,installSha,networkRoot,previousParent,out,rustc,rustcVersion})
    .then(r=>{console.log(JSON.stringify({accepted:r.accepted,compiled:r.rust_core_2024.length,other_editions:r.other_core_editions.length,component_manifests:r.component_manifest_editions.length}));if(!r.accepted)process.exitCode=1;})
    .catch(e=>{console.error(e);process.exitCode=1;});
}
