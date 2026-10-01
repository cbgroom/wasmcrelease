import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,renameSync,symlinkSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {archiveFiles,auditRegistryCrate,captureCargoRouting} from './current-v2-registry-source-witness.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function archive(rows){
  const parts=[];for(const [name,content,type='0']of rows){
    const data=Buffer.from(content),header=Buffer.alloc(512);
    header.write(name,0,100);header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);
    header.write(data.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);
    header.fill(32,148,156);header.write(type,156);header.write('ustar\0',257);header.write('00',263);
    const checksum=header.reduce((n,b)=>n+b,0);header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148);
    parts.push(header,data,Buffer.alloc((512-data.length%512)%512));
  }return gzipSync(Buffer.concat([...parts,Buffer.alloc(1024)]));
}
const temp=realpathSync(mkdtempSync(join(tmpdir(),'wasmc-registry-source-')));let negatives=0;
try{
  const cache=join(temp,'cache'),source=join(temp,'source'),base=join(source,'fixture-1.0.0');
  mkdirSync(cache);mkdirSync(join(base,'src'),{recursive:true});
  const inputs={'Cargo.toml':'[package]\nname="fixture"\n','src/lib.rs':'pub fn fixture() {}','build.rs':'fn main() {}','LICENSE':'fixture license'};
  const bytes=archive(Object.entries(inputs).map(([p,b])=>['fixture-1.0.0/'+p,b]));
  const path=join(cache,'fixture-1.0.0.crate');writeFileSync(path,bytes);
  for(const [p,b]of Object.entries(inputs))writeFileSync(join(base,p),b);
  writeFileSync(join(base,'.cargo-ok'),'{"v":1}');
  const crate={name:'fixture',version:'1.0.0',checksum:sha(bytes)};
  const before=auditRegistryCrate(crate,cache,source);assert.equal(before.source_files,4);
  const reject=fn=>{assert.throws(fn);negatives++;};
  for(const [p,b]of Object.entries(inputs)){
    writeFileSync(join(base,p),b+' modified');reject(()=>auditRegistryCrate(crate,cache,source));writeFileSync(join(base,p),b);
  }
  const lost=join(base,'src/lib.rs'),saved=join(temp,'saved');renameSync(lost,saved);
  reject(()=>auditRegistryCrate(crate,cache,source));symlinkSync(saved,lost);
  reject(()=>auditRegistryCrate(crate,cache,source));rmSync(lost);renameSync(saved,lost);
  const extra=join(base,'extra');writeFileSync(extra,'extra');reject(()=>auditRegistryCrate(crate,cache,source));rmSync(extra);
  mkdirSync(extra);reject(()=>auditRegistryCrate(crate,cache,source));rmdirSync(extra);
  writeFileSync(join(base,'.cargo-ok'),'changed');reject(()=>auditRegistryCrate(crate,cache,source));writeFileSync(join(base,'.cargo-ok'),'{"v":1}');
  writeFileSync(path,Buffer.concat([bytes,Buffer.from([1])]));reject(()=>auditRegistryCrate(crate,cache,source));writeFileSync(path,bytes);
  const alias=join(temp,'linked-source');symlinkSync(source,alias);reject(()=>auditRegistryCrate(crate,cache,alias));
  renameSync(path,saved);symlinkSync(saved,path);reject(()=>auditRegistryCrate(crate,cache,source));rmSync(path);renameSync(saved,path);
  for(const name of ['fixture-1.0.0/../outside','outside/file','fixture-1.0.0//file','fixture-1.0.0/./file','fixture-1.0.0/back\\slash'])
    reject(()=>archiveFiles(archive([[name,'bad']]),'fixture-1.0.0'));
  for(const type of ['1','2','3','5','x'])reject(()=>archiveFiles(archive([['fixture-1.0.0/file','',type]]),'fixture-1.0.0'));
  reject(()=>archiveFiles(archive([['fixture-1.0.0/file','a'],['fixture-1.0.0/file','b']]),'fixture-1.0.0'));
  const long='fixture-1.0.0/src/'+'a'.repeat(150);
  assert.equal(Object.keys(archiveFiles(archive([['././@LongLink',long+'\0','L'],['short','long body']]),'fixture-1.0.0'))[0],long.slice(14));
  assert.deepEqual(auditRegistryCrate(crate,cache,source),before);
  const home=join(temp,'cargo-home'),workspace=join(temp,'workspace');mkdirSync(home);mkdirSync(workspace);
  const config=join(home,'config.toml');writeFileSync(config,'[build]\nrustc-wrapper = "sccache"\n');
  assert(captureCargoRouting(home,workspace).configs['cargo-home/config.toml']);
  for(const text of ['[source.crates-io]\nreplace-with="other"','[registries.other]\nindex="other"',
    '[registry]\ndefault="other"','[patch.crates-io]\n','paths=["elsewhere"]','[env]\nCARGO_SOURCE_CRATES_IO_REPLACE_WITH="other"',
    '["source"."crates-io"]\nreplace-with="other"','"paths"=["elsewhere"]','source.crates-io.replace-with="other"']){
    writeFileSync(config,text);reject(()=>captureCargoRouting(home,workspace));
  }
  rmSync(config);mkdirSync(join(workspace,'.cargo'));writeFileSync(join(workspace,'.cargo/config'),'[source.other]\n');
  reject(()=>captureCargoRouting(home,workspace));rmSync(join(workspace,'.cargo/config'));
  const key='CARGO_SOURCE_WASMC_FIXTURE',previous=process.env[key];process.env[key]='fixture';
  try{reject(()=>captureCargoRouting(home,workspace));}finally{if(previous===undefined)delete process.env[key];else process.env[key]=previous;}
  const nested=join(workspace,'crate');mkdirSync(join(nested,'.cargo'),{recursive:true});
  writeFileSync(join(nested,'Cargo.toml'),'[package]\nname="fixture"\nversion="1.0.0"\n');
  const nestedConfig=join(nested,'.cargo/config.toml');writeFileSync(nestedConfig,'[source.crates-io]\nreplace-with="other"');
  reject(()=>captureCargoRouting(home,workspace));
  writeFileSync(nestedConfig,'[build]\nrustc-wrapper = "sccache"\n');
  assert(captureCargoRouting(home,workspace).configs['workspace-nested/crate/config.toml']);
  mkdirSync(join(nested,'target/.cargo'),{recursive:true});writeFileSync(join(nested,'target/.cargo/config.toml'),'unreviewed build output');
  captureCargoRouting(home,workspace); // Cargo crate output is not a retained input.
  mkdirSync(join(nested,'src/target/.cargo'),{recursive:true});writeFileSync(join(nested,'src/target/.cargo/config.toml'),'unreviewed source config');
  reject(()=>captureCargoRouting(home,workspace)); // A source directory named target is still input.
  console.log(JSON.stringify({accepted:true,negative_controls:negatives,source_body_not_emitted:true,
    current_snapshot_only:true,historical_builds_attested:false,release_qualified:false}));
}finally{rmSync(temp,{recursive:true});} // Exact owned fixture only.
