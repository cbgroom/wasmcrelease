// Finite generated-Cargo profile auditor, not a general TOML parser.
// Normalize exactly one independently expected path literal; preserve every
// other byte so a formatting or extra-field change cannot disappear in a hash.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {realpathSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex');
const id=/^[A-Za-z_][A-Za-z0-9_-]*$/;
export function auditGeneratedManifest(bytes,workspace,expected){
  assert(Buffer.isBuffer(bytes)&&bytes.length<=1024*1024,'manifest input bound');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  assert(Buffer.from(text).equals(bytes),'noncanonical manifest encoding');
  const base=resolve(workspace);assert.equal(realpathSync(base),base,'linked manifest workspace');
  assert(id.test(expected.dependency_alias)&&id.test(expected.dependency_package),'invalid expected dependency identity');
  assert.match(expected.upstream_crate_dir,/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/,'unsafe upstream crate path');
  assert.match(expected.version,/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/,'invalid expected version');
  const upstream=join(base,expected.upstream_crate_dir);
  assert.equal(realpathSync(upstream),upstream,'linked upstream dependency');assert(lstatSync(upstream).isDirectory());
  const sections={};let section=null;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    const header=line.match(/^\[([a-z.]+)\]$/);
    if(header){section=header[1];assert(['package','lib','dependencies','profile.release','workspace'].includes(section),'unknown Cargo section');assert(!Object.hasOwn(sections,section),'duplicate Cargo section');sections[section]={};continue;}
    assert(section,'Cargo field outside a section');
    const field=line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.+)$/);assert(field,'unsupported Cargo field syntax');
    assert(!Object.hasOwn(sections[section],field[1]),'duplicate Cargo field');sections[section][field[1]]=field[2];
  }
  const string=value=>{const match=value?.match(/^"([^"\\\r\n\x00-\x1f]*)"$/);assert(match,'unsupported quoted Cargo value');return match[1];};
  assert.deepEqual(Object.keys(sections).sort(),['dependencies','lib','package','profile.release','workspace']);
  assert.deepEqual(Object.keys(sections.package).sort(),['edition','name','version']);
  assert.equal(string(sections.package.name),'wasmc-lib-adapter');assert.equal(string(sections.package.version),expected.version);assert.equal(string(sections.package.edition),'2024');
  assert.deepEqual(Object.keys(sections.lib),['crate-type']);assert.match(sections.lib['crate-type'],/^\[\s*"cdylib"\s*\]$/);
  assert.deepEqual(Object.keys(sections['profile.release']),['panic']);assert.equal(string(sections['profile.release'].panic),'abort');
  assert.deepEqual(Object.keys(sections.workspace),[]);
  assert.deepEqual(Object.keys(sections.dependencies),[expected.dependency_alias]);
  const inline=sections.dependencies[expected.dependency_alias].match(/^\{\s*(.*?)\s*\}$/);assert(inline,'unsupported dependency table');
  const dependency={};
  for(const part of inline[1].split(',')){
    const field=part.trim().match(/^(package|path)\s*=\s*(.+)$/);assert(field,'unknown dependency field');
    assert(!Object.hasOwn(dependency,field[1]),'duplicate dependency field');dependency[field[1]]=string(field[2]);
  }
  assert.deepEqual(Object.keys(dependency).sort(),['package','path']);
  assert.equal(dependency.package,expected.dependency_package,'dependency package drift');assert.equal(dependency.path,upstream,'dependency path drift');
  const literal=JSON.stringify(upstream),position=text.indexOf(literal);
  assert(position>=0&&text.indexOf(literal,position+literal.length)===-1,'ambiguous dependency path literal');
  const normalizedPath='workspace/'+expected.upstream_crate_dir;
  const scrubbed=text.slice(0,position)+JSON.stringify(normalizedPath)+text.slice(position+literal.length);
  const model={package_name:'wasmc-lib-adapter',version:expected.version,edition:'2024',crate_type:'cdylib',panic:'abort',
    dependency_alias:expected.dependency_alias,dependency_package:expected.dependency_package,dependency_path:normalizedPath,isolated_workspace:true};
  return {schema:'wasmc.generated-cargo-manifest-profile/v1',raw_bytes:bytes.length,raw_sha256:sha(bytes),
    path_scrubbed_sha256:sha(Buffer.from(scrubbed)),semantic_sha256:sha(Buffer.from(JSON.stringify(model))),model,
    expected_contract_checked:true,only_one_expected_path_literal_normalized:true,general_TOML_supported:false,
    full_transitive_license_audit:false,release_qualified:false};
}
