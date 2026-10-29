// Audit all supplied remote tag refs; never change tags or historical Roots.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedCurrentCatalog,hash,currentProductReader} from './current-lib-release-v3.mjs';

export async function auditTaggedRoots({repo,product,catalogSha,refsPath,refsSha}) {
  for(const p of [repo,product,refsPath])assert.ok(isAbsolute(p));
  for(const h of [catalogSha,refsSha])assert.match(h,/^[0-9a-f]{64}$/);
  const refBytes=await readFile(refsPath);assert.equal(hash(refBytes),refsSha,'independent tag listing pin');
  const lines=refBytes.toString('utf8').trim().split('\n'),refs=[];let previous='';
  for(const line of lines){const m=/^([0-9a-f]{40})\t(refs\/tags\/[A-Za-z0-9._/-]+)$/.exec(line);
    assert.ok(m,'complete supported remote tag record');assert.ok(m[2]>previous,'sorted unique remote refs');previous=m[2];refs.push({oid:m[1],ref:m[2]});}
  const git=(...args)=>execFileSync('git',args,{cwd:repo,maxBuffer:150*1024*1024});
  assert.equal(git('rev-parse','--show-object-format').toString().trim(),'sha1');
  const read=currentProductReader(product),catalogBytes=read('catalog/libs-current-v2.json');
  const catalog=checkedCurrentCatalog(catalogBytes,catalogSha),roots=new Map(),aliases=new Map();
  for(const row of catalog.packages){const files=new Map();
    for(const f of row.files){const data=read(f.path);assert.equal(data.length,f.bytes);assert.equal(hash(data),f.sha256);
      files.set(f.path,createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex'));}
    roots.set(row.root,{id:row.id,files});
    for(const prefix of ['standard','lib-releases'])for(const nested of ['', 'root/'])
      aliases.set(`${prefix}/${row.id}/${row.version}/${nested}lib.json`,row.id);
  }
  let treesWithRoots=0,rootOccurrences=0;const conflicts=[],otherSurface=[],taggedIds=new Set();
  for(const ref of refs){assert.equal(git('rev-parse','--verify',ref.ref).toString().trim(),ref.oid,'local tag differs from remote listing');
    const tree=git('ls-tree','-r','-z',ref.ref,'--','current-libs','standard','lib-releases').toString().split('\0').filter(Boolean);
    const found=new Map();
    for(const line of tree){const m=/^(100644|100755|120000) blob ([0-9a-f]{40})\t(.+)$/.exec(line);assert.ok(m,'supported Git tree entry');
      const path=m[3];if(aliases.has(path))otherSurface.push({ref:ref.ref,path,id:aliases.get(path)});
      for(const [root,entry] of roots){if(path.startsWith(root+'/')){if(!found.has(root))found.set(root,new Map());found.get(root).set(path,m[2]);}}
    }
    if(found.size)treesWithRoots++;
    for(const [root,files] of found){const expected=roots.get(root);rootOccurrences++;taggedIds.add(expected.id);
      if(files.size!==expected.files.size||[...files].some(([p,id])=>expected.files.get(p)!==id))conflicts.push({ref:ref.ref,id:expected.id,root});}
  }
  assert.deepEqual(otherSurface,[],'selected identity found in another historical delivery surface');
  assert.deepEqual(conflicts,[],'selected Root differs from a tagged historical Root');
  return {schema:'wasmc.tagged-root-audit/v1',accepted:true,catalog_sha256:catalogSha,tag_listing_sha256:refsSha,
    tags:refs.length,tags_with_selected_roots:treesWithRoots,root_occurrences:rootOccurrences,
    tagged_ids:[...taggedIds].sort(),untagged_ids:catalog.packages.map(r=>r.id).filter(id=>!taggedIds.has(id)).sort(),conflicts:0,
    other_delivery_surface_hits:0,scope:'Only supplied remote tag refs and exact selected Root identities in the three scanned delivery surfaces; local tag refs match supplied listing.',public_admission:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [repo,product,catalogSha,refsPath,refsSha]=process.argv.slice(2);
  auditTaggedRoots({repo,product,catalogSha,refsPath,refsSha}).then(r=>console.log(JSON.stringify(r)))
    .catch(e=>{console.error(e);process.exitCode=1;});
}
