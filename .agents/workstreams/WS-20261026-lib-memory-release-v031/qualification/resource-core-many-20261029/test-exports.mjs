import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [file,countText,pin]=process.argv.slice(2), count=Number(countText), bytes=readFileSync(file);
assert.equal(createHash('sha256').update(bytes).digest('hex'),pin);
const module=new WebAssembly.Module(bytes), imports={};
for(const row of WebAssembly.Module.imports(module)){assert.equal(row.kind,'function');(imports[row.module]??={})[row.name]=()=>0;}
const instance=new WebAssembly.Instance(module,imports);
for(let i=0;i<count;i++){const n=`extra_${String(i).padStart(3,'0')}`;assert.equal(instance.exports[n](),i);}
console.log(JSON.stringify({accepted:true,artifact_sha256:pin,extra_exports_called:count,provider:'stubbed and unused by synthetic extra exports',scope:'generated extra Core exports, not full Std provider conformance'}));
