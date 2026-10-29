import json, random, sys
from pathlib import Path

out=Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=True)
rng=random.Random(20261030)
cases=[]
enc=lambda v:json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'))
for n in range(300):
    doc={'a/b':{'~tag':n},'bucket':[n,n+1,n+2],'marker':n}
    initial=enc(doc); actions=[]
    for j in range(12):
        action=rng.randrange(5)
        value=rng.randrange(-100000,100000)
        if action==0:
            doc['a/b']['~tag']=value; actions.append(('Set','/a~1b/~0tag',enc(value)))
        elif action==1:
            doc['bucket'].append(value); actions.append(('Set','/bucket/-',enc(value)))
        elif action==2 and doc['bucket']:
            k=rng.randrange(len(doc['bucket'])); doc['bucket'][k]=value; actions.append(('Set',f'/bucket/{k}',enc(value)))
        elif action==3 and doc['bucket']:
            k=rng.randrange(len(doc['bucket'])); doc['bucket'].pop(k); actions.append(('Remove',f'/bucket/{k}',''))
        else:
            key='k'+str(rng.randrange(8)); doc[key]=value; actions.append(('Set','/'+key,enc(value)))
    cases.append({'input':initial,'edits':actions,'expected':enc(doc)})
(out/'fixtures.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
def rust(s):
    assert '"#' not in s
    return 'r#"'+s+'"#'
lines=['use wasmc::json::document::{edit_bytes, Edit, EditKind};', '#[unsafe(no_mangle)] pub extern "C" fn run() -> u32 {']
for case in cases:
    lines.append('let edits=vec!['+','.join('Edit {kind:EditKind::'+kind+',path:'+rust(path)+'.into(),value_json:'+rust(value)+'.into()}' for kind,path,value in case['edits'])+'];')
    lines.append('assert_eq!(edit_bytes('+rust(case['input'])+'.as_bytes(),&edits).unwrap(),'+rust(case['expected'])+'.as_bytes());')
lines.extend(['let bad=vec![Edit{kind:EditKind::Set,path:"/x".into(),value_json:"2".into()},Edit{kind:EditKind::Remove,path:"/missing".into(),value_json:"".into()}];', 'assert!(edit_bytes(br#"{\"x\":1}"#,&bad).is_err());', 'assert_eq!(edit_bytes(br#"{\"x\":1}"#,&[]).unwrap(),br#"{\"x\":1}"#);', '300','}'])
(out/'guest-app.rs').write_text('\n'.join(lines)+'\n')
