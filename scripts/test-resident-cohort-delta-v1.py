#!/usr/bin/env python3
import hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile
root=pathlib.Path(os.environ['WASMC_QUALIFICATION_STATE']).resolve()
old=root/'cohort43-wit16-union-evidence-20261029/runs/refresh-qdwi17/refresh-receipt.json'
new=root/'resident-binary-refresh-output-3-20261029/runs/refresh-oOABfT/refresh-receipt.json'
oldsrc=root/'cohort43-wit16-union-stage-20261029';newsrc=root/'resident-binary-stage-20261029'
producer=root/'wasmc-wit16-union-producer-924dc71-20261029'
sha=lambda b:hashlib.sha256(b).hexdigest()
oldhash='22be7ccfd4547c099fc8ae0e901a74741fcc56f886550d31cbfc070e22d7d624'
newhash='f7020cf17a1d337f45b220fbefdf81db2e85b9c264705d31742a241f0f2a7de8'
assert sha(old.read_bytes())==oldhash and sha(new.read_bytes())==newhash
with tempfile.TemporaryDirectory(prefix='resident-proof-') as td:
    tmp=pathlib.Path(td)
    def run(source,receipt,pin,out):
        return subprocess.run([sys.executable,'scripts/verify-resident-cohort-delta-v1.py','--old-receipt',str(old),'--old-sha256',oldhash,'--old-source',str(oldsrc),'--new-receipt',str(receipt),'--new-sha256',pin,'--new-source',str(source),'--producer',str(producer),'--out',str(tmp/out)],capture_output=True,text=True)
    ok=run(newsrc,new,newhash,'ok.json');assert ok.returncode==0,ok.stderr
    assert json.loads((tmp/'ok.json').read_text())['unchanged_other_package_sources']==42
    for case in ['unrelated-source','policy','lock']:
        copy=tmp/case;shutil.copytree(newsrc,copy);receipt=json.loads(new.read_bytes())
        if case=='unrelated-source':
            path='libspec/wasmc-json/delta.rs';p=copy/path;p.write_bytes(p.read_bytes()+b'\n')
        elif case=='policy':
            path='libspec/rust-policy.json';p=copy/path;d=json.loads(p.read_bytes());d['dependencies']['bincode']='"=1.3.2"';p.write_text(json.dumps(d,indent=2)+'\n')
        else:
            path='libspec/Cargo.lock';p=copy/path;s=p.read_text();a='c841b55ecdae098c80dcae9cf767f6f8a0c2cdb3416bbef72181df4d0fe73f14';assert s.count(a)==1;p.write_text(s.replace(a,'0'*64))
        receipt['source_digests'][path]=sha(p.read_bytes())
        rp=tmp/(case+'.json');rp.write_text(json.dumps(receipt)+'\n');pin=sha(rp.read_bytes())
        failure=run(copy,rp,pin,case+'-output.json');assert failure.returncode!=0 and not (tmp/(case+'-output.json')).exists(),case
    bad=run(newsrc,new,'0'*64,'bad-pin.json');assert bad.returncode!=0 and not (tmp/'bad-pin.json').exists()
print(json.dumps({'accepted':True,'controls':4,'scope':'scoped nonresident input equivalence; not release admission'}))
