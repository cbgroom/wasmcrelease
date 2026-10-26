"""Generate selected four-file successors from the unchanged cohort Rust policy/lock."""
from pathlib import Path
import sys,json,tomllib,re,hashlib
own=Path(__file__).resolve().parent
out=Path(sys.argv[1]).resolve(); assert not out.exists(), 'fresh workspace required'
policy=json.loads((own/'inputs/cohort-rust-policy.json').read_text())
lock=(own/'inputs/cohort.Cargo.lock').read_text()
sections=re.split(r'(?=\[\[package\]\])',lock)[1:]
packages={}
for section in sections:
    p=tomllib.loads(section)['package'][0];packages[(p['name'],p['version'])]=(p,section)
selected=['wasmc-compression','wasmc-lib-search','wasmc-http1','wasmc-http1-client','wasmc-system-telemetry','wasmc-data-interchange','wasmc-data-relational']
original={name:name.replace('-','_')+'_refresh_v2' for name in selected}
queue=[]; roots=[]; inputs={}
for name in selected:
    source=own/'libspec'/name;spec=json.loads((source/'lib.json').read_text());crate=out/'crates'/name
    (crate/'src').mkdir(parents=True);(crate/'wit').mkdir()
    for n in ['delta.rs','adapter.rs']:(crate/'src'/n).write_bytes((source/n).read_bytes())
    (crate/'wit/lib.wit').write_bytes((source/'lib.wit').read_bytes())
    for dep in spec.get('wit_dependencies',[]):
        folder=crate/'wit/deps'/dep;folder.mkdir(parents=True);(folder/'lib.wit').write_bytes((own/'inputs/wit-deps'/f'{dep}.wit').read_bytes())
    shared=spec.get('shared_modules',[])
    for module in shared:(crate/'src'/f'{module.replace("-","_")}.rs').write_bytes((own/'inputs/shared'/f'{module}.rs').read_bytes())
    extra=('generate_all,' if spec.get('wit_dependencies') else '')
    mods=''.join('mod '+m.replace('-','_')+';\n' for m in shared)
    (crate/'src/lib.rs').write_text('#[cfg(target_arch="wasm32")]\nwit_bindgen::generate!({path:"wit",world:'+json.dumps(spec['world'])+','+extra+'});\n'+mods+'mod delta;\n#[cfg(target_arch="wasm32")] mod adapter;\n#[cfg(target_arch="wasm32")] use adapter::Adapter;\n#[cfg(target_arch="wasm32")] export!(Adapter);\n')
    dependency_keys=set(spec['dependencies'])
    for module in shared:dependency_keys.update(policy['shared_modules'][module].get('dependencies',[]))
    deps=['wit-bindgen = '+policy['wit_bindgen']]+[k+' = '+policy['dependencies'][k] for k in sorted(dependency_keys)]
    (crate/'Cargo.toml').write_text('[package]\nname = '+json.dumps(spec['crate'])+'\nversion = '+json.dumps(spec['version'])+'\nedition = "2021"\npublish = false\n[lib]\ncrate-type = ["cdylib","rlib"]\n[dependencies]\n'+'\n'.join(deps)+'\n')
    key=next(k for k in packages if k[0]==original[name]);row,raw=packages[key]
    queue+=row.get('dependencies',[])
    roots.append(raw.replace('name = "'+row['name']+'"','name = "'+spec['crate']+'"',1).replace('version = "'+row['version']+'"','version = "'+spec['version']+'"',1))
    inputs[name]={n:hashlib.sha256((source/n).read_bytes()).hexdigest() for n in ['lib.json','lib.wit','delta.rs','adapter.rs']}
    for module in shared:inputs[name]['shared/'+module]=hashlib.sha256((own/'inputs/shared'/f'{module}.rs').read_bytes()).hexdigest()
    for dep in spec.get('wit_dependencies',[]):inputs[name]['wit-deps/'+dep]=hashlib.sha256((own/'inputs/wit-deps'/f'{dep}.wit').read_bytes()).hexdigest()
seen=set()
while queue:
    dep=queue.pop();parts=dep.split();keys=[k for k in packages if k[0]==parts[0] and (len(parts)<2 or k[1]==parts[1])];assert len(keys)==1,(dep,keys)
    key=keys[0]
    if key in seen:continue
    seen.add(key);queue+=packages[key][0].get('dependencies',[])
# Cargo drops version qualifiers when closure selection leaves only one version.
# Keep exact package versions/checksums; normalize only unambiguous dependency references.
from collections import Counter
counts=Counter(k[0] for k in seen)
body=''.join(packages[k][1] for k in sorted(seen))+''.join(roots)
body=re.sub(r'(?m)^ \"([^\"]+) ([^\"]+)\",$',lambda m:' \"'+m[1]+'\",' if counts[m[1]]==1 else m[0],body)
(out/'Cargo.lock').write_text('# Generated dependency closure of the exact committed cohort lock.\nversion = 4\n\n'+body)
(out/'Cargo.toml').write_text('[workspace]\nresolver="2"\nmembers='+json.dumps(['crates/'+n for n in selected])+'\n[profile.release]\nopt-level="z"\nlto=true\ncodegen-units=1\npanic="abort"\nstrip="symbols"\n')
(out/'source-receipt.json').write_text(json.dumps({'schema':'wasmc.lib-memory-materialization/v1','generated':True,'inputs':inputs,'policy_sha256':hashlib.sha256((own/'inputs/cohort-rust-policy.json').read_bytes()).hexdigest(),'cohort_lock_sha256':hashlib.sha256(lock.encode()).hexdigest(),'lock_sha256':hashlib.sha256((out/'Cargo.lock').read_bytes()).hexdigest()},indent=2)+'\n')
print(json.dumps({'out':str(out),'packages':selected,'dependency_packages':len(seen)}))
