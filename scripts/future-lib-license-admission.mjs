// Structural future-candidate guard, not a legal or dependency-usage oracle.
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=message=>{throw Error(`future Lib license admission: ${message}`);};
const safe=p=>typeof p==='string'&&p.length>0&&!p.startsWith('/')&&!p.includes('\\')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
// Original all18 denominator. Migration counts/edits cannot silently shrink it.
export const all18Targets=Object.freeze(['mcpgit-resident-memory','wasmc-compression','wasmc-csv','wasmc-data-compute','wasmc-data-core','wasmc-data-expr','wasmc-data-interchange','wasmc-data-profile','wasmc-data-relational','wasmc-host-clock','wasmc-http1','wasmc-json','wasmc-lib-search','wasmc-owned-algorithms','wasmc-resource-counter','wasmc-router-policy','wasmc-std','wasmc-system-telemetry']);
export const needsFutureLibLicenseGate=version=>!/^0\.0\.(?:[0-9]|1[0-9]|20)$/.test(version);
export function validateFutureLibLicenses(candidate,read) {
  const files=candidate.product_files;
  if(!Array.isArray(files)||files.length>10000)fail('bounded product inventory required');
  const inventory=new Map();
  for(const f of files){if(!safe(f.path)||inventory.has(f.path)||!digest(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<=0)fail('product identity required');inventory.set(f.path,f);}
  const exact=p=>{const f=inventory.get(p);if(!f)fail(`product file missing: ${p}`);const b=read(p);if(!(b instanceof Uint8Array)||b.length!==f.bytes||sha(b)!==f.sha256)fail(`product identity drift: ${p}`);return b;};
  const catalogPath='catalog/libs-current-v2.json',catalog=JSON.parse(exact(catalogPath));
  if(catalog.schema!=='wasmc.public-lib-catalog/v1'||!Array.isArray(catalog.packages)||catalog.packages.length!==18)fail('all18 selected roots required');
  const ids=catalog.packages.map(p=>p.id).sort();if(JSON.stringify(ids)!==JSON.stringify(all18Targets))fail('all18 target identities required');
  const roots=new Set(),rows=[];
  for(const row of [...catalog.packages].sort((a,b)=>a.id.localeCompare(b.id))){
    if(!safe(row.root)||roots.has(row.root)||!/^\d+\.\d+\.\d+$/.test(row.version))fail('unique exact root/version required');roots.add(row.root);
    const manifestPath=`${row.root}/lib.json`,raw=exact(manifestPath),m=JSON.parse(raw);
    if(m.schema!=='wasmc.lib/v2'||m.id!==row.id||m.version!==row.version||!Array.isArray(row.files))fail('selected v2 manifest required');
    const catalogFiles=new Map();for(const f of row.files){if(!safe(f.path)||!f.path.startsWith(row.root+'/')||catalogFiles.has(f.path))fail('catalog file inventory required');catalogFiles.set(f.path,f);}
    const bound=p=>{const b=exact(p),f=catalogFiles.get(p);if(!f||f.bytes!==b.length||f.sha256!==sha(b))fail(`catalog identity missing/drift: ${p}`);return b;};bound(manifestPath);
    const license=m.license;
    if(license?.schema!=='wasmc.lib-license/v1'||typeof license.identifier!=='string'||!license.identifier.trim()||license.identifier.length>128||!Array.isArray(license.files)||license.files.length<1||license.files.length>32)fail(`explicit snapshot required: ${row.id}`);
    let total=0;const paths=new Set();
    for(const f of license.files){if(!safe(f.path)||paths.has(f.path)||!digest(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>262144)fail('license file bound/identity required');paths.add(f.path);total+=f.bytes;const b=bound(`${row.root}/${f.path}`);if(b.length!==f.bytes||sha(b)!==f.sha256)fail('license snapshot drift');if(Buffer.from(b).includes(0)||!Buffer.from(Buffer.from(b).toString('utf8')).equals(Buffer.from(b)))fail('license UTF-8 text required');}
    if(total>2097152||license.files[0].path!=='LICENSE')fail('bounded root LICENSE first required');
    const cargoPath=`${row.root}/bindings/rust/Cargo.toml`;
    const sdks=[m.bindings?.rust_core,m.bindings?.rust_component].filter(sdk=>sdk!=null);
    const hasSdk=sdks.length>0||inventory.has(cargoPath)||catalogFiles.has(cargoPath);
    if(hasSdk){
      const b=bound(cargoPath),cargo=Buffer.from(b).toString('utf8');
      for(const sdk of sdks)if(sdk.cargo_toml?.path!=='bindings/rust/Cargo.toml'||sdk.cargo_toml.sha256!==sha(b))fail(`Rust SDK manifest identity required: ${row.id}`);
      if(!/^license-file\s*=\s*"\.\.\/\.\.\/LICENSE"\s*$/m.test(cargo)||/^license\s*=/m.test(cargo))fail(`Rust SDK LICENSE binding required: ${row.id}`);
    }
    rows.push({id:row.id,version:row.version,root:row.root,manifest_sha256:sha(raw),license_sha256:sha(bound(`${row.root}/LICENSE`)),license_files:license.files.length,license_bytes:total,rust_sdk_license_bound:hasSdk});
  }
  return {schema:'wasmc.future-lib-license-admission/v1',catalog:{path:catalogPath,sha256:sha(exact(catalogPath))},targets:rows,all18_explicit_snapshots:true,legal_compatibility:false,dependency_notice_completeness:false,runtime_qualification:false};
}
