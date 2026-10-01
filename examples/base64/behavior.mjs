import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// Shared oracle for frozen packages and fresh current-v2 installs. Raw Core
// behavior is not an ordinary WAsmC App compile/link qualification.
export function exerciseBase64(providerBytes,libBytes){
  assert.equal(sha(providerBytes),'f54a892aff9068e5c79464029423a2e8f753ddb44010af9ac34a5c9efce2069c');
  assert.equal(sha(libBytes),'f8a8ce447f776a47680e02e19ea3a69827edbbc46e01985803ce3d3df51178d7');
  const providerModule=new WebAssembly.Module(providerBytes);
  assert.deepEqual(WebAssembly.Module.imports(providerModule),[]);
  const provider=new WebAssembly.Instance(providerModule,{});
  assert.equal(provider.exports.provider_domain_init(127,7),0);
  const libModule=new WebAssembly.Module(libBytes),imports=WebAssembly.Module.imports(libModule);
  assert(imports.length>0);
  assert(imports.every(row=>row.module==='wasmc:lib/wasmc.lib_managed_object_heap@4.8.0'));
  const lib=new WebAssembly.Instance(libModule,{'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0':provider.exports});
  assert.equal(lib.exports.std_init(),0);
  const makeBuffer=bytes=>{
    const handle=lib.exports.std_bytes_new();
    for(const byte of bytes)assert.equal(lib.exports.std_bytes_push(handle,byte),0);
    return handle;
  };
  const readBuffer=handle=>Uint8Array.from({length:Number(lib.exports.std_bytes_len(handle))},(_,index)=>{
    const option=lib.exports.std_bytes_byte_at(handle,index);
    assert.equal(option>>32n,1n);return Number(option&0xffn);
  });
  const handles=[];
  const buffer=bytes=>{const handle=makeBuffer(bytes);handles.push(handle);return handle;};
  let positiveCalls=0;
  try{
    for(const text of ['','abc','hello world']){
      const input=buffer(new TextEncoder().encode(text)),encoded=buffer([]),decoded=buffer([]);
      assert.equal(lib.exports.std_base64_try_encode_standard(input,encoded),1n);
      assert.equal(new TextDecoder().decode(readBuffer(encoded)),Buffer.from(text).toString('base64'));
      assert.equal(lib.exports.std_base64_try_decode_standard(encoded,decoded),1n);
      assert.equal(new TextDecoder().decode(readBuffer(decoded)),text);
      positiveCalls+=2;
    }
  }finally{for(const handle of handles.reverse())assert.equal(lib.exports.std_bytes_drop(handle),0);}
  return {accepted:true,scope:'raw-core-base64-behavior',package:'wasmc:std@1.4.0',apis:['wasmc:std@1.4.0/base64#try-encode-standard','wasmc:std@1.4.0/base64#try-decode-standard'],artifact_sha256:sha(libBytes),provider_sha256:sha(providerBytes),import_module:'wasmc:lib/wasmc.lib_managed_object_heap@4.8.0',positive_calls:positiveCalls,dropped_buffers:handles.length,ordinary_app_qualified:false,input_utf8:'abc',encoded_utf8:'YWJj',decoded_utf8:'abc'};
}
