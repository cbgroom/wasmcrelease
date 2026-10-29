#!/usr/bin/env python3
"""Check exact Q0 inputs for a single resident successor, without granting admission."""
import argparse, hashlib, json, pathlib, tomllib
if not __debug__: raise RuntimeError('verification requires assertions enabled')

def sha(data): return hashlib.sha256(data).hexdigest()
def read(path): return pathlib.Path(path).read_bytes()
def main():
    p=argparse.ArgumentParser()
    for name in ('old-receipt','old-sha256','old-source','new-receipt','new-sha256','new-source','producer','out'):
        p.add_argument('--'+name, required=True)
    a=p.parse_args()
    old_bytes,new_bytes=read(a.old_receipt),read(a.new_receipt)
    assert sha(old_bytes)==a.old_sha256 and sha(new_bytes)==a.new_sha256, 'receipt identity'
    old,new=json.loads(old_bytes),json.loads(new_bytes)
    assert old['accepted'] is True and new['accepted'] is True
    assert old['producer']['sha256']==new['producer']['sha256']==sha(read(a.producer)), 'producer identity'
    assert old['toolchain']==new['toolchain'] and old['generator_digests']==new['generator_digests'], 'toolchain or generator drift'
    assert len(old['rows'])==43 and len(new['rows'])==1 and new['rows'][0]['id']=='mcpgit-resident-memory'
    assert len({row['id'] for row in old['rows']})==43 and new['rows'][0]['version']=='0.2.1'
    aroot,broot=pathlib.Path(a.old_source),pathlib.Path(a.new_source)
    before,after=old['source_digests'],new['source_digests']
    assert set(before)==set(after), 'source inventory differs'
    for path,pin in before.items(): assert sha(read(aroot/path))==pin, 'old source identity: '+path
    for path,pin in after.items(): assert sha(read(broot/path))==pin, 'new source identity: '+path
    expected={'libspec/Cargo.lock','libspec/rust-policy.json','libspec/mcpgit-resident-memory/lib.json','libspec/mcpgit-resident-memory/lib.wit','libspec/mcpgit-resident-memory/delta.rs'}
    changed={k for k in before if before[k]!=after[k]};assert changed==expected, 'unexpected source change'
    policy0=json.loads(read(aroot/'libspec/rust-policy.json'));policy1=json.loads(read(broot/'libspec/rust-policy.json'))
    assert policy1['dependencies'].pop('bincode')=='"=1.3.3"' and policy0==policy1, 'policy not additive'
    spec0=json.loads(read(aroot/'libspec/mcpgit-resident-memory/lib.json'));spec1=json.loads(read(broot/'libspec/mcpgit-resident-memory/lib.json'))
    assert spec0['version']=='0.2.0' and spec1['version']=='0.2.1'
    spec1['version']=spec0['version'];spec1['dependencies'].remove('bincode');assert spec0==spec1, 'unrelated resident spec drift'
    wit0=read(aroot/'libspec/mcpgit-resident-memory/lib.wit');wit1=read(broot/'libspec/mcpgit-resident-memory/lib.wit')
    assert wit0.replace(b'package mcpgit:resident-memory@0.2.0;',b'package mcpgit:resident-memory@0.2.1;',1)==wit1, 'WIT drift beyond version'
    d0=read(aroot/'libspec/mcpgit-resident-memory/delta.rs');d1=read(broot/'libspec/mcpgit-resident-memory/delta.rs')
    assert d0.replace(b'serde_json::to_vec(collection).map_err',b'bincode::serialize(collection).map_err').replace(b'serde_json::from_slice(bytes).map_err',b'bincode::deserialize(bytes).map_err')==d1, 'unexpected delta source change'
    l0=tomllib.loads(read(aroot/'libspec/Cargo.lock').decode());l1=tomllib.loads(read(broot/'libspec/Cargo.lock').decode())
    assert l0['version']==l1['version']
    excluded={'mcpgit_resident_memory_refresh_v2','bincode'}
    def other(lock):
        rows=[x for x in lock['package'] if x['name'] not in excluded]
        result={(x['name'],x['version']):x for x in rows}
        assert len(result)==len(rows), 'ambiguous Cargo package identity'
        return result
    assert other(l0)==other(l1), 'other Cargo packages changed'
    assert not any(x['name']=='bincode' for x in l0['package'])
    bn=[x for x in l1['package'] if x['name']=='bincode'];assert len(bn)==1 and bn[0]['version']=='1.3.3'
    old_ids={r['id'] for r in old['rows']};assert 'mcpgit-resident-memory' in old_ids
    result={'schema':'wasmc.resident-cohort-delta-proof/v1','accepted':True,'old_receipt_sha256':a.old_sha256,'new_receipt_sha256':a.new_sha256,'producer_sha256':old['producer']['sha256'],'source_inputs':len(before),'changed_inputs':sorted(changed),'unchanged_other_package_sources':len(old_ids)-1,'unchanged_nonresident_lock_entries':len(other(l0)),'added_external_dependency':'bincode@1.3.3','scope':'exact input comparison only; no automatic receipt rebinding, Search index, whole-product admission, CI or formal release'}
    with pathlib.Path(a.out).open('x') as output: output.write(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
if __name__=='__main__': main()
