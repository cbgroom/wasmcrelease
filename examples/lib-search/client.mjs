// Typed Node/Bun/Deno view. Canonical pointers and post-return remain private.
import {createHash} from 'node:crypto';
export function instantiateLibSearch(bytes,{artifact_sha256,index_sha256,wit_package='wasmc:lib-search@0.1.0'}) {
  if(!/^[0-9a-f]{64}$/.test(artifact_sha256)||!/^[0-9a-f]{64}$/.test(index_sha256))throw Error('exact digests required');
  const wit=/^wasmc:lib-search@(\d+\.\d+\.\d+)$/.exec(wit_package);
  if(!wit)throw Error('exact LibSearch WIT package required');
  if(createHash('sha256').update(bytes).digest('hex')!==artifact_sha256)throw Error('Lib artifact digest mismatch');
  const module=new WebAssembly.Module(bytes);
  if(WebAssembly.Module.imports(module).length)throw Error('unexpected Lib authority');
  const api=new WebAssembly.Instance(module).exports;
  const prefix=`wasmc:lib-search/catalog@${wit[1]}#`;
  const u32=p=>new DataView(api.memory.buffer).getUint32(p,true);
  const string=p=>new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(api.memory.buffer,u32(p),u32(p+4)));
  const hit=p=>Object.fromEntries(['identity','signature','skill_path','wit_path','artifact_path'].map((key,i)=>[key,string(p+i*8)]));
  const invoke=(name,args,decode)=>{const ptr=api[prefix+name](...args);try{return decode(ptr);}finally{api['cabi_post_'+prefix+name](ptr);}};
  const input=value=>{if(typeof value!=='string')throw TypeError('WIT string required');const data=new TextEncoder().encode(value);const ptr=api.cabi_realloc(0,0,1,data.length);new Uint8Array(api.memory.buffer,ptr,data.length).set(data);return [ptr,data.length];};
  const integer=n=>{if(!Number.isInteger(n)||n<0||n>0xffffffff)throw TypeError('WIT u32 required');};
  const snapshot=()=>invoke('snapshot',[],p=>({format_version:u32(p),entry_count:u32(p+4),index_sha256:string(p+8)}));
  if(snapshot().index_sha256!==index_sha256)throw Error('Lib index digest mismatch');
  return Object.freeze({snapshot,
    search(query,offset,limit){
      integer(offset);integer(limit);
      if(typeof query?.include_historical!=='boolean'||typeof query?.text!=='string')throw TypeError('WIT query required');
      if(query.text.length>256||new TextEncoder().encode(query.text).length>256)return {error:'invalid-query'};
      return invoke('search',[...input(query.text),+query.include_historical,offset,limit],p=>{
        if(u32(p)!==0){const code=new DataView(api.memory.buffer).getUint8(p+4);if(code>1)throw Error('invalid search error');return {error:code===0?'invalid-query':'invalid-limit'};}
        const base=u32(p+4),count=u32(p+8);if(count>64)throw Error('invalid result bound');
        return {ok:Array.from({length:count},(_,i)=>hit(base+i*40))};
      });
    },
    lookup(identity){if(typeof identity!=='string')throw TypeError('WIT string required');if(identity.length>4096)return null;return invoke('lookup',input(identity),p=>new DataView(api.memory.buffer).getUint8(p)===0?null:hit(p+4));}
  });
}
