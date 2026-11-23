// Additive admission is explicit; v1 retains its replacement-only identity set.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sorted=xs=>[...xs].sort();
export const additive=options=>options.schema==='wasmc.current-lib-composition-input/v2';
export function checkCompositionOptions(options,baseIds){
 const keys=['schema','base','reused_ids','replacements',...(additive(options)?['additions']:[])];
 assert.deepEqual(Object.keys(options).sort(),keys.sort(),'closed composition input schema');
 assert.ok(['wasmc.current-lib-composition-input/v1','wasmc.current-lib-composition-input/v2'].includes(options.schema));
 assert.ok(Array.isArray(options.reused_ids)&&Array.isArray(options.replacements));
 assert.deepEqual(options.reused_ids,sorted(new Set(options.reused_ids)));
 const replaced=options.replacements.map(r=>r.id);assert.equal(new Set(replaced).size,replaced.length);
 assert.deepEqual(sorted([...options.reused_ids,...replaced]),baseIds,'exact original cohort partition');
 if(!additive(options)){assert.ok(replaced.length>0);return [...baseIds];}
 assert.ok(Array.isArray(options.additions)&&options.additions.length>0);
 const added=options.additions.map(r=>r.id);assert.deepEqual(added,sorted(new Set(added)),'ordered unique additions');
 assert.ok(added.every(id=>/^[a-z][a-z0-9-]*$/.test(id)&&!baseIds.includes(id)),'addition must be a new identity');
 return sorted([...baseIds,...added]);
}
export const importedSelections=options=>[...options.replacements,...(additive(options)?options.additions:[])];
export function registryProjection(input,baseCatalog,options){
 const original=input.read(baseCatalog.registry.path);
 if(!additive(options))return {bytes:original,pin:baseCatalog.registry};
 const registry=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(original));
 const before=registry.libs.map(r=>r.id).sort();
 assert.deepEqual(before,baseCatalog.packages.map(r=>r.id));
 checkCompositionOptions(options,before);
 registry.libs=[...registry.libs,...options.additions.map(({id})=>({id,source:'libspec/'+id}))].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const bytes=Buffer.from(JSON.stringify(registry,null,2)+'\n');
 return {bytes,pin:{path:baseCatalog.registry.path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}};
}
