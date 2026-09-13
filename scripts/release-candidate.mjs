// Offline product-identity gate. This does not publish, sign or grant authority.
import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const safe=p=>typeof p==='string'&&p.split('/').every(x=>x&&x!=='.'&&x!=='..')&&!p.includes('\\')&&!p.startsWith('/');
export function validateCandidate(candidate,read) {
  if(candidate.schema!=='wasmc.release-product-candidate/v1'||!/^\d+\.\d+\.\d+$/.test(candidate.version))throw Error('candidate schema/version rejected');
  for(const key of ['compiler_source_authority','lib_source_authority'])if(!/^[0-9a-f]{40}$/.test(candidate[key]))throw Error('exact private source authority required');
  const rows=candidate.product_files;
  if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('product inventory rejected');
  let previous='';
  for(const row of rows) {
    if(!safe(row.path)||row.path<=previous||!Number.isSafeInteger(row.bytes)||row.bytes<=0||!/^[0-9a-f]{64}$/.test(row.sha256))throw Error('product row rejected');
    const bytes=read(row.path);if(bytes.length!==row.bytes||hash(bytes)!==row.sha256)throw Error('product drift rejected');previous=row.path;
  }
  if(candidate.product_set_sha256!==hash(JSON.stringify(rows)))throw Error('product set identity rejected');
  return true;
}
export function validateTransition(previous,next,candidate) {
  if(next.schema!=='wasmc.release-stage/v1'||next.version!==candidate.version||next.product_set_sha256!==candidate.product_set_sha256||!/^[0-9a-f]{40}$/.test(next.product_candidate_commit))throw Error('stage identity rejected');
  const suffix=next.stage==='prod'?'':next.stage==='dev'?'-dev.':next.stage==='main'?'-main.':null;
  if(suffix===null||!(suffix===''?next.tag===`v${next.version}`:new RegExp(`^v${next.version.replaceAll('.','\\.')}${suffix.replace('.','\\.')}[1-9][0-9]*$`).test(next.tag)))throw Error('stage tag rejected');
  if(next.stage==='dev'){if(previous!==null)throw Error('dev must begin a new candidate');return true;}
  if(!previous||previous.version!==next.version||previous.product_set_sha256!==next.product_set_sha256||previous.product_candidate_commit!==next.product_candidate_commit||previous.stage!==(next.stage==='main'?'dev':'main'))throw Error('promotion cannot rebuild or skip stages');
  if(next.qualification?.accepted!==true||next.qualification?.lib_search_result!=='success'||next.qualification?.full_consumer_result!=='success'||next.qualification?.tested_product_set_sha256!==candidate.product_set_sha256||!/^[0-9a-f]{40}$/.test(next.qualification?.tested_source_commit))throw Error('exact successful qualification required');
  return true;
}
function walk(directory) {
  return readdirSync(resolve(root,directory)).sort().flatMap(name=>{
    if(['target','.DS_Store'].includes(name))return [];
    const path=`${directory}/${name}`,s=lstatSync(resolve(root,path));
    if(s.isSymbolicLink())throw Error('product symlink rejected');
    return s.isDirectory()?walk(path):[path];
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [command,path,source,version]=process.argv.slice(2);
  const read=p=>readFileSync(resolve(root,p));
  if(command==='create') {
    if(!/^[0-9a-f]{40}$/.test(source))throw Error('exact Lib source required');
    const paths=[...['current','standard','sdk','runtime'].flatMap(walk),'examples/lib-search/client.mjs','scripts/wasmc-lib.mjs','skills/wasmc-lib/SKILL.md'];
    const rows=paths.sort().map(path=>{const b=read(path);return {path,bytes:b.length,sha256:hash(b)};});
    const candidate={schema:'wasmc.release-product-candidate/v1',version,compiler_source_authority:'e69abb73f667f3810b0c40937fd1a1e2d04d4255',lib_source_authority:source,product_files:rows,product_set_sha256:hash(JSON.stringify(rows))};
    validateCandidate(candidate,read);writeFileSync(path,JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});
  } else if(command==='verify') {
    const candidate=JSON.parse(readFileSync(path));validateCandidate(candidate,read);
    console.log(JSON.stringify({accepted:true,products:candidate.product_files.length,product_set_sha256:candidate.product_set_sha256}));
  } else throw Error('usage: release-candidate.mjs create FILE LIB_SOURCE VERSION | verify FILE');
}
