import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,realpathSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {auditGeneratedManifest} from './current-v2-generated-manifest-profile.mjs';
const temp=mkdtempSync(join(realpathSync(tmpdir()),'wasmc-manifest-profile-test-'));let rejected=0;
try{
  const expected={version:'1.2.3',dependency_alias:'upstream',dependency_package:'fixture-package',upstream_crate_dir:'adapter'};
  const make=workspace=>`[package]\nname = "wasmc-lib-adapter"\nversion = "1.2.3"\nedition = "2024"\n\n[lib]\ncrate-type = ["cdylib"]\n\n[dependencies]\nupstream = { package = "fixture-package", path = "${join(workspace,'adapter')}" }\n\n[profile.release]\npanic = "abort"\n\n[workspace]\n`;
  const workspaces=['first','second'].map(p=>join(temp,p));for(const w of workspaces)mkdirSync(join(w,'adapter'),{recursive:true});
  const [first,second]=workspaces.map(w=>auditGeneratedManifest(Buffer.from(make(w)),w,expected));
  assert.notEqual(first.raw_sha256,second.raw_sha256);assert.equal(first.path_scrubbed_sha256,second.path_scrubbed_sha256);assert.equal(first.semantic_sha256,second.semantic_sha256);
  const original=make(workspaces[0]);
  const reject=(text,contract=expected)=>{assert.throws(()=>auditGeneratedManifest(Buffer.from(text),workspaces[0],contract));rejected++;};
  for(const text of [
    original.replace('edition = "2024"','edition = "2021"'),original.replace('panic = "abort"','panic = "unwind"'),
    original.replace('["cdylib"]','["rlib"]'),original.replace('version = "1.2.3"','version = "1.2.4"'),
    original.replace('name = "wasmc-lib-adapter"','name = "other"'),original.replace('package = "fixture-package"','package = "other"'),
    original.replace('upstream =','other ='),original.replace(join(workspaces[0],'adapter'),join(workspaces[1],'adapter')),
    original.replace('edition = "2024"','edition = "2024"\nbuild = "build.rs"'),original+'[features]\nextra=[]\n',
    original+'[patch.crates-io]\nother = "1"\n',original.replace('[workspace]','[workspace]\nmembers = ["other"]'),
    original.replace('panic = "abort"','panic = "abort"\npanic = "abort"'),original.replace('[lib]','[package]\n\n[lib]'),
    original.replace('path =','version = "1", path ='),original.replace('path =','package = "fixture-package", path ='),
    original.replace('edition =','"edition" ='),original.replace('[package]','[package] # extra'),
    original.replace('version = "1.2.3"','version = "1.2.3" # comment'),original+'[target.unreviewed]\n',
  ])reject(text);
  reject(original,{...expected,upstream_crate_dir:'../adapter'});
  reject(original,{...expected,dependency_alias:'bad.alias'});
  assert.throws(()=>auditGeneratedManifest(Buffer.from([0xff]),workspaces[0],expected));rejected++;
  const changedFormat=auditGeneratedManifest(Buffer.from(original.replace('edition =','edition  =')),workspaces[0],expected);
  assert.equal(changedFormat.semantic_sha256,first.semantic_sha256);assert.notEqual(changedFormat.path_scrubbed_sha256,first.path_scrubbed_sha256);
  const linked=join(workspaces[0],'linked');symlinkSync(join(workspaces[0],'adapter'),linked);
  reject(original.replace(join(workspaces[0],'adapter'),linked),{...expected,upstream_crate_dir:'linked'});
  assert.equal(rejected,24);
  console.log(JSON.stringify({accepted:true,negative_controls:rejected,complete_finite_profile_checked:true,
    independent_path_scrubbed_bytes_equal:true,format_drift_not_hidden:true,fixture_only:true,release_qualified:false}));
}finally{rmSync(temp,{recursive:true,force:true});}
