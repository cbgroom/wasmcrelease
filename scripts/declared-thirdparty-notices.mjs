import {parseCatalog,sha256} from './lib-catalog.mjs';
const fail=s=>{throw Error(`declared third-party notice: ${s}`);};
const safe=p=>typeof p==='string'&&p&&!p.startsWith('/')&&!p.includes('\\')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
// The caller supplies a separately reviewed policy/catalog pin, never a digest
// inferred from the package being exempted. Byte identity is not legal approval.
export async function collectDeclaredThirdPartyNotices(catalogBytes,policy,read) {
  const raw=JSON.parse(catalogBytes),catalog=parseCatalog(catalogBytes,{release_tag:raw.release_tag,release_commit:policy.package_authority_commit});
  const result=new Map();let pinned=false;
  for(const row of catalog.packages){
    const files=new Map(row.files.map(f=>[f.path,f]));
    const exact=async p=>{const f=files.get(p);if(!f)fail('catalog file missing');const b=await read(p);if(!(b instanceof Uint8Array)||b.length!==f.bytes||sha256(b)!==f.sha256)fail('catalog identity drift');return Buffer.from(b);};
    const m=JSON.parse(await exact(row.root+'/lib.json'));
    if(m.id!==row.id||m.version!==row.version)fail('manifest identity');
    if(m.license==null)continue; // legacy omission grants no exemption
    if(!pinned){if(!digest(policy.thirdparty_notice_catalog_sha256)||sha256(catalogBytes)!==policy.thirdparty_notice_catalog_sha256)fail('independent reviewed catalog digest required');pinned=true;}
    const l=m.license;
    if(m.schema!=='wasmc.lib/v2'||l.schema!=='wasmc.lib-license/v1'||l.identifier!=='WAsmC-Research-Only-Non-Commercial-1.0'||!Array.isArray(l.files)||l.files.length<1||l.files.length>32||l.files[0].path!=='LICENSE')fail('explicit research snapshot required');
    const paths=new Set();let total=0;
    for(const f of l.files){
      if(!safe(f.path)||paths.has(f.path)||!digest(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>262144)fail('license file identity/bound');paths.add(f.path);total+=f.bytes;
      const p=row.root+'/'+f.path,b=await exact(p);if(b.length!==f.bytes||sha256(b)!==f.sha256||b.includes(0)||!Buffer.from(b.toString('utf8')).equals(b))fail('license snapshot identity/text');
      if(f.path==='LICENSE'){if(!b.toString('utf8').startsWith('WAsmC Research-Only Non-Commercial License 1.0\n')||!b.includes(Buffer.from('solely for Non-Commercial Research'))||/^MIT License$/m.test(b.toString('utf8')))fail('first-party license is not research-only');}
      else if(/^licenses\/DEPENDENCY-NOTICES-[0-9]{3}\.txt$/.test(f.path)){if(result.has(p))fail('ambiguous notice');result.set(p,{bytes:b.length,sha256:sha256(b),manifest_sha256:sha256(await exact(row.root+'/lib.json')),catalog_sha256:sha256(catalogBytes)});}
    }
    if(total>2097152)fail('total license budget');
  }
  return result;
}
export function isExactDeclaredNotice(relative,bytes,notices){const pin=notices.get(relative);return !!pin&&bytes.length===pin.bytes&&sha256(bytes)===pin.sha256;}
