// Trusted checked ABI glue only; data allocation/storage remains in CoreLib.
export async function createCoreBytesProvider(bytes,domain=19) {
  const module=new WebAssembly.Module(bytes);
  if(WebAssembly.Module.imports(module).length)throw -7;
  const e=new WebAssembly.Instance(module,{}).exports;
  if(e.provider_domain_init(domain,7)!==0)throw -8;
  const type=e.type_bytes();if(type===0n)throw -8;
  const live=new Set(),callers=new WeakSet();
  return {
    count:()=>live.size,
    memoryBytes:()=>e.memory.buffer.byteLength,
    async caller(wasm) {
      const module=new WebAssembly.Module(wasm);
      for(const i of WebAssembly.Module.imports(module))
        if(i.module!=='heap'||!['type_bytes','bytes_len','bytes_byte_at'].includes(i.name)||i.kind!=='function')throw -7;
      const instance=new WebAssembly.Instance(module,{heap:e});let poisoned=false,calls=0;
      const caller={calls:()=>calls,run(reference,fail=0){
        if(poisoned)throw -8;if(!Number.isInteger(fail)||fail<0||fail>1)throw -5;poisoned=true;calls++;
        const value=instance.exports.run(reference,fail);poisoned=false;return value;
      }};callers.add(caller);return caller;
    },
    allocate(data) {
      if(!Array.isArray(data)||data.length>16||Array.from(data).some(b=>!Number.isInteger(b)||b<0||b>255))throw -5;
      const reference=e.bytes_builder_new(type);if(reference===0n)throw -8;live.add(reference);
      const release=()=>{if(!live.has(reference))throw -1;if(e.object_drop(reference,type)!==0)throw -8;live.delete(reference);};
      try {
        for(let offset=0;offset<data.length;offset+=8) {
          const count=Math.min(8,data.length-offset);let packed=0n;
          for(let i=0;i<count;i++)packed|=BigInt(data[offset+i])<<BigInt(8*i);
          if(e.bytes_builder_push_u64_le(reference,type,BigInt.asIntN(64,packed),count)!==0)throw -8;
        }
        if(e.bytes_builder_finish(reference,type)!==0)throw -8;
      }catch(primary){try{release();}catch{throw {primary,retained_owner:true};}throw primary;}
      return {run(caller,fail=0){if(!live.has(reference))throw -1;if(!callers.has(caller))throw -4;return caller.run(reference,fail);},release,
        staleRejected(){return (e.bytes_len(reference,type)>>32n)!==0n;}};
    }
  };
}
