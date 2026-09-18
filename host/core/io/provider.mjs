// Trusted checked ABI glue only; data allocation/storage remains in CoreLib.
export async function createCoreBytesProvider(bytes,domain=19) {
  const module=new WebAssembly.Module(bytes);
  if(WebAssembly.Module.imports(module).length)throw -7;
  const e=new WebAssembly.Instance(module,{}).exports;
  if(e.provider_domain_init(domain,7)!==0)throw -8;
  const type=e.type_bytes();if(type===0n)throw -8;
  const live=new Set(),callers=new WeakSet();let allocationCalls=0;
  return {
    count:()=>live.size,
    memoryBytes:()=>e.memory.buffer.byteLength,
    allocationCalls:()=>allocationCalls, // Trusted conformance diagnostic only.
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
      if(!Array.isArray(data))throw -5;
      const length=data.length;if(!Number.isInteger(length)||length<0||length>16)throw -5;
      const snapshot=new Uint8Array(length);
      for(let i=0;i<length;i++){const byte=data[i];if(!Number.isInteger(byte)||byte<0||byte>255)throw -5;snapshot[i]=byte;}
      allocationCalls++;
      const reference=e.bytes_builder_new(type);if(reference===0n)throw -8;live.add(reference);
      const release=()=>{if(!live.has(reference))throw -1;if(e.object_drop(reference,type)!==0)throw -8;live.delete(reference);};
      try {
        for(let offset=0;offset<length;offset+=8) {
          const count=Math.min(8,length-offset);let packed=0n;
          for(let i=0;i<count;i++)packed|=BigInt(snapshot[offset+i])<<BigInt(8*i);
          if(e.bytes_builder_push_u64_le(reference,type,BigInt.asIntN(64,packed),count)!==0)throw -8;
        }
        if(e.bytes_builder_finish(reference,type)!==0)throw -8;
      }catch(primary){try{release();}catch{throw {primary,retained_owner:true};}throw primary;}
      return {run(caller,fail=0){if(!live.has(reference))throw -1;if(!callers.has(caller))throw -4;return caller.run(reference,fail);},release,
        staleRejected(){return (e.bytes_len(reference,type)>>32n)!==0n;}};
    }
  };
}
