import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateCandidate} from '../../../../scripts/release-candidate.mjs';
const candidate=JSON.parse(readFileSync('channels/candidates/0.0.30.json'));
const rows=new Map(candidate.product_files.map(r=>[r.path,r]));
const commit='ca6e36ab5f7617894ed595e98ac0ee39eee0008e';let fallback=0;
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=path=>{
  const row=rows.get(path);if(!row)throw Error('not inventoried: '+path);
  let bytes;try{bytes=readFileSync(path);}catch{}
  if(!bytes||bytes.length!==row.bytes||hash(bytes)!==row.sha256){
    fallback++;bytes=execFileSync('git',['show',`${commit}:${path}`],{maxBuffer:64*1024*1024});
  }
  return bytes;
};
const result=validateCandidate(candidate,read);
console.log(JSON.stringify({accepted:result,version:candidate.version,product_files:rows.size,fallback,commit}));
