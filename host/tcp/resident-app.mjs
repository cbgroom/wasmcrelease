// Reviewed fixture only: exclusive resident guest/Lib and private marshalling slab.
export async function createResidentApp(libBytes,appBytes) {
  const {instance:lib}=await WebAssembly.instantiate(libBytes,{}),e=lib.exports;
  const ptr=e.cabi_realloc(0,0,4,64);let length=0,calls=0,poisoned=false,closed=false,busy=false;
  let app;
  try {
    ({instance:app}=await WebAssembly.instantiate(appBytes,{transport:{sum_window(n){
      if(n!==length) throw Error('length drift');
      calls++;return e['sum-s32'](ptr,n);
    }}}));
  } catch(error) {e.cabi_realloc(ptr,64,4,0);throw error;}
  return {
    call(bytes,fail=0) {
      if(closed||poisoned||busy) throw -8;
      busy=true;
      try {
        if(!Array.isArray(bytes)||!Number.isInteger(fail)||fail<0||fail>1)throw -5;
        const size=bytes.length;
        if(!Number.isInteger(size)||size<0||size>16)throw -5;
        const snapshot=new Array(size);
        for(let i=0;i<size;i++) {
          const value=bytes[i];if(!Number.isInteger(value)||value<0||value>255)throw -5;
          snapshot[i]=value;
        }
        // No external iteration/getters after validation or provider mutation.
        poisoned=true;length=size;
        const view=new DataView(e.memory.buffer);
        for(let i=0;i<size;i++)view.setInt32(ptr+4*i,snapshot[i],true);
        const result=app.exports.run(length,fail);poisoned=false;return result;
      }finally{busy=false;}
    },
    libCalls:()=>calls,
    release() {if(closed) throw -1;if(busy)throw -4;closed=true;e.cabi_realloc(ptr,64,4,0);}
  };
}
