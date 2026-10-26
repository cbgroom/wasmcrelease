// Generated composition input: the facade imports every actual implementation
// export. The sole dependency is required for all behavior, never an unused row.
import fs from 'node:fs';import cp from 'node:child_process';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const [raw,out,moduleName='rust-implementation',from,to]=process.argv.slice(2);assert(raw&&out&&from&&to&&from!==to);assert(!fs.existsSync(out));fs.mkdirSync(out);
const run=(args)=>{const r=cp.spawnSync('wasm-tools',args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
run(['print',raw,'-o',out+'/input.wat']);const wat=fs.readFileSync(out+'/input.wat','utf8'),functions=new Map();
for(const line of wat.split('\n')){const m=line.match(/^  \(func (\$[^ ]+|\(;\d+;\)) .*?\(type \d+\)(.*)$/);if(!m)continue;const lanes=k=>(m[2].match(new RegExp('\\('+k+' ([^)]*)\\)'))?.[1]??'').split(' ').filter(Boolean);functions.set(m[1].startsWith('(;')?m[1].slice(2,-2):m[1],{params:lanes('param'),results:lanes('result')});}
let imports=[],exports=[],index=0,renamed=0;
for(const m of wat.matchAll(/^  \(export "([^"]+)" \((func|memory|global) ([^)]+)\)\)$/gm)){
 const [,name,kind,id]=m,label='$item'+index++;let type;
 if(kind==='func'){const f=functions.get(id);assert(f,'missing decoded function '+id);type=`(func ${label} ${f.params.length?'(param '+f.params.join(' ')+')':''} ${f.results.length?'(result '+f.results.join(' ')+')':''})`;}
 if(kind==='memory'){const decl=wat.match(/^  \(memory [^\n]+$/m)?.[0],shape=decl?.match(/\(;\d+;\) (\d+(?: \d+)?)/)?.[1];assert(shape,'memory32 shape absent');type=`(memory ${label} ${shape})`;}
 if(kind==='global'){const decl=wat.split('\n').find(l=>l.startsWith('  (global '+(id.startsWith('$')?id+' ':'(;'+id+';) ')));assert(decl,'global absent '+id);const shape=decl.match(/\(;\d+;\) (\(mut [^)]+\)|i32|i64|f32|f64)/)?.[1];assert(shape);type=`(global ${label} ${shape})`;}
 const target=name.includes(from)?name.replaceAll(from,to):name;if(target!==name)renamed++;imports.push(`(import ${JSON.stringify(moduleName)} ${JSON.stringify(name)} ${type})`);exports.push(`(export ${JSON.stringify(target)} (${kind} ${label}))`);
}
assert(renamed>0,'no versioned exports renamed');
fs.writeFileSync(out+'/facade.wat','(module\n'+imports.join('\n')+'\n'+exports.join('\n')+'\n)\n');run(['parse',out+'/facade.wat','-o',out+'/facade.wasm']);run(['validate',out+'/facade.wasm']);
fs.writeFileSync(out+'/receipt.json',JSON.stringify({schema:'wasmc.generated-core-composition-facade/v1',implementation_sha256:crypto.createHash('sha256').update(fs.readFileSync(raw)).digest('hex'),facade_sha256:crypto.createHash('sha256').update(fs.readFileSync(out+'/facade.wasm')).digest('hex'),implementation_required:true,exports:exports.length,renamed_exports:renamed,from,to},null,2)+'\n');
