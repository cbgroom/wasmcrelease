import assert from 'node:assert/strict';
import {CoreCaller,bool,u32,list,option,record,result,string} from './current-core-value-codec-v3.mjs';
export function currentIndexEntries(index){
  assert.equal(index.schema,'wasmc.current-lib-search-index/v2');
  return index.packages.flatMap(p=>{const{apis,...base}=p,identity=p.package_id+'@'+p.version;
    return [{...base,identity,kind:'package'},...apis.map(api=>({...base,identity:identity+'/'+api.route,
      kind:'api',wit_route:p.wit_route+'/'+api.route,description:api.description}))];});
}
const errors=['invalid-index','index-too-large','invalid-query','invalid-limit'];
const binding=record({manifest_sha256:string,receipt_sha256:string,artifact_kind:string,
  artifact_path:option(string),artifact_sha256:option(string),component_sha256:option(string)});
const hit=record({identity:string,package_id:string,version:string,profile:string,target:string,
  kind:string,wit_route:string,source_path:string,wit_sha256:string,description:string,delivery:option(binding)});
const summary=record({entry_count:u32,package_count:u32,api_count:u32,bound_package_count:u32,
  registry_sha256:string,index_sha256:string});
const query=record({text:string,package_id:option(string),profile:option(string),bound_only:bool});
export class CurrentSearchCaller {
  constructor(indexBytes,artifact,abiBytes){
    assert.ok(indexBytes.length<=2097152&&artifact.length<=16777216&&abiBytes.length<=1048576);
    this.text=new TextDecoder('utf-8',{fatal:true}).decode(indexBytes);
    this.caller=new CoreCaller(new WebAssembly.Module(artifact),JSON.parse(new TextDecoder().decode(abiBytes)));
  }
  snapshot(){return this.caller.call('snapshot',[string],[this.text],result(summary,errors));}
  lookup(identity){assert.ok(typeof identity==='string'&&identity.length<=4096);
    return this.caller.call('lookup',[string,string],[this.text,identity],result(option(hit),errors));}
  search(selection,offset=0,limit=64){
    assert.ok(Number.isInteger(offset)&&offset>=0&&offset<=4294967295);
    assert.ok(Number.isInteger(limit)&&limit>0&&limit<=64);
    assert.ok(typeof selection.text==='string'&&new TextEncoder().encode(selection.text).length<=4096);
    for(const name of ['package_id','profile'])assert.ok(selection[name]===null||typeof selection[name]==='string'&&selection[name].length<=128);
    assert.equal(typeof selection.bound_only,'boolean');
    return this.caller.call('search',[string,query,u32,u32],[this.text,selection,offset,limit],result(list(hit),errors));
  }
}
