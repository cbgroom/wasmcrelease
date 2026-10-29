import subprocess,json,pathlib
p=pathlib.Path('.'); tests=['scripts/test-current-compiler.mjs','scripts/test-canonical-host-sdk-v031.mjs','scripts/test-canonical-host-import-demand-v031.mjs','scripts/test-canonical-checked-results-v031.mjs','scripts/test-current-string-support-v031.mjs','examples/current/standard.mjs'];results=[]
for test in tests:
 for runtime in ['node','bun','deno']:
  argv=[runtime]+(['run','--allow-read','--allow-write','--allow-run','--allow-env'] if runtime=='deno' else [])+[test]
  r=subprocess.run(argv,capture_output=True,text=True,timeout=180);name=test.replace('/','_').replace('.mjs','')+'-'+runtime+'.log';(p/name).write_text(r.stdout+r.stderr);results.append({'test':test,'runtime':runtime,'exit':r.returncode,'log':name,'last_line':(r.stdout+r.stderr).strip().splitlines()[-1:]});print(test,runtime,r.returncode,flush=True)
(p/'integration-matrix.json').write_text(json.dumps({'formal_release':False,'source_custody':False,'results':results},indent=2)+'\n');print('passed',sum(x['exit']==0 for x in results),'of',len(results),flush=True)
