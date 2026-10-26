// Check a resource Core plan against the selected WIT, actual Core ABI and its
// exact provider bytes. This does not establish build provenance or publication.
import assert from 'node:assert/strict';
import {sha} from './lib-refresh-cache-v2.mjs';
import {witModel,selectedWitRoutes} from './current-wit-routes-v3.mjs';
const sorted=x=>[...x].sort();
export function verifyCurrentResourcePlan({manifest,planBytes,witBytes,coreBytes,abi,providerBytes}) {
  const plan=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(planBytes));
  assert.equal(plan.schema,'wasmc-fastapi-typed-resource-set-binding-plan/v1');
  assert.equal(sha(planBytes),manifest.typed_resource_plan.sha256);
  assert.equal(sha(planBytes),manifest.bindings.rust_core.plan_sha256);
  assert.equal(sha(coreBytes),manifest.artifact.sha256);
  assert.equal(plan.input.package.artifact_sha256,manifest.artifact.sha256);
  assert.equal(plan.input.public_facade.sha256,sha(witBytes));
  const model=witModel(witBytes),routes=selectedWitRoutes(model,manifest.wit.world,new Map([[model.identity,model],...model.dependencies]));
  assert.equal(plan.input.public_facade.package,model.identity);
  assert.equal(plan.input.public_facade.world,manifest.wit.world);
  assert.deepEqual(plan.deferred_public_functions,[]);
  const namespaces=new Map(plan.namespaces.map(x=>[x.id,x.name]));
  assert.equal(namespaces.size,plan.namespaces.length);
  const mapped=plan.bindings.map(b=>{
    assert.equal(b.public_kind,'freestanding');assert.ok(b.public_function.startsWith('[freestanding]'));
    assert.ok(namespaces.has(b.namespace_id));
    return model.identity+'/'+namespaces.get(b.namespace_id)+'#'+b.public_function.slice('[freestanding]'.length);
  });
  assert.equal(new Set(mapped).size,mapped.length);
  assert.deepEqual(sorted(mapped),sorted(routes.routes.keys()),'selected WIT and resource plan routes');
  const core=new WebAssembly.Module(coreBytes),exports=WebAssembly.Module.exports(core),imports=WebAssembly.Module.imports(core);
  assert.deepEqual(exports.map(({name,kind})=>({name,kind})),abi.exports.map(({name,kind})=>({name,kind})));
  assert.deepEqual(imports,abi.imports.map(({module,name,kind})=>({module,name,kind})));
  assert.equal(abi.artifact_sha256,sha(coreBytes));
  for(const b of [...plan.bindings,...plan.lifecycles]){
    const e=abi.exports.find(x=>x.name===b.core_binding);assert.ok(e&&e.kind==='function','resource Core binding exists');
    assert.deepEqual(e.params,b.core_params);assert.deepEqual(e.results,b.core_results);
  }
  assert.equal(plan.input.package.dependencies.length,1);
  const dep=plan.input.package.dependencies[0];assert.equal(sha(providerBytes),dep.artifact_sha256);
  const provider=new WebAssembly.Module(providerBytes),provided=new Set(WebAssembly.Module.exports(provider).filter(x=>x.kind==='function').map(x=>x.name));
  assert.deepEqual(sorted(imports.map(x=>{assert.equal(x.module,dep.module);assert.equal(x.kind,'function');assert.ok(provided.has(x.name));return x.name;})),sorted(dep.imports.map(x=>x.name)));
  for(const d of dep.imports){const a=abi.imports.find(x=>x.module===dep.module&&x.name===d.name);assert.ok(a);assert.deepEqual(a.params,d.core_params);assert.deepEqual(a.results,d.core_results);}
  return {accepted:true,routes:mapped.length,lifecycles:plan.lifecycles.length,imports:imports.length,provider_sha256:sha(providerBytes),fresh_build:false,formal_release:false};
}
