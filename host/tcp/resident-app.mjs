// Reviewed fixture only: exclusive resident guest/Lib and private marshalling slab.
export async function createResidentApp(libBytes,appBytes) {
  const {instance:lib}=await WebAssembly.instantiate(libBytes,{}),e=lib.exports;
  const ptr=e.cabi_realloc(0,0,4,64);let length=0,calls=0,poisoned=false,closed=false;
  let app;
  try {
    ({instance:app}=await WebAssembly.instantiate(appBytes,{transport:{sum_window(n){
      if(n!==length) throw Error('length drift');
      calls++;return e['sum-s32'](ptr,n);
    }}}));
  } catch(error) {e.cabi_realloc(ptr,64,4,0);throw error;}
  return {
    call(bytes,fail=0) {
      if(closed||poisoned) throw -8;
      if(!Array.isArray(bytes)||bytes.length>16||Array.from(bytes).some(b=>!Number.isInteger(b)||b<0||b>255)||!Number.isInteger(fail)||fail<0||fail>1) throw -5;
      poisoned=true;length=bytes.length;
      const view=new DataView(e.memory.buffer);bytes.forEach((b,i)=>view.setInt32(ptr+4*i,b,true));
      const result=app.exports.run(length,fail);poisoned=false;return result;
    },
    libCalls:()=>calls,
    release() {if(closed) throw -1;closed=true;e.cabi_realloc(ptr,64,4,0);}
  };
}
