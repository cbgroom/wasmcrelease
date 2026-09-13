// Test-only loopback allowlist. Never a production filesystem/network grant.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {compile} from '../../current/wasmc.mjs';
const root=new URL('../../',import.meta.url);
const guest=await compile(await readFile(new URL('host/lib-e2e/guest.wasmc',root),'utf8'));
const kernelGuest=await compile(await readFile(new URL('host/v0/guest.wasmc',root),'utf8'));
const files=new Set(['host/browser/index.html','host/browser/probe.mjs','host/v0/reference.mjs','host/tcp/resident-app.mjs','host/tcp/read-window.mjs','host/tcp/write-window.mjs','host/tcp/stop-fence.mjs','host/tcp/supervisor.mjs','host/completion/scoped-guard.mjs','host/completion/guard.mjs','libs/wasmc-owned-algorithms/artifact.wasm']);
const server=createServer(async(req,res)=>{
  const path=(req.url??'').slice(1);
  if(req.method!=='GET'||(path!=='fixture/guest.wasm'&&path!=='fixture/kernel.wasm'&&!files.has(path))){res.writeHead(404);res.end();return;}
  try{
    const bytes=path==='fixture/guest.wasm'?guest:path==='fixture/kernel.wasm'?kernelGuest:await readFile(fileURLToPath(new URL(path,root)));
    res.writeHead(200,{'content-type':path.endsWith('.mjs')?'text/javascript':path.endsWith('.html')?'text/html':'application/wasm','cache-control':'no-store'});res.end(bytes);
  }catch{res.writeHead(500);res.end();}
});
server.listen(0,'127.0.0.1',()=>console.log(`http://127.0.0.1:${server.address().port}/host/browser/index.html`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
