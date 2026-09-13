import { ScopedCompletionGuard } from './scoped-guard.mjs';
const [mode,identity,oldWindow,oldOperation]=process.argv.slice(2);
const g=mode.startsWith('fresh-')?ScopedCompletionGuard.fresh():new ScopedCompletionGuard(identity),window=g.acquire(1),operation=g.submit(window);
if(mode==='create'||mode==='fresh-create') console.log(JSON.stringify({window,operation}));
else {
  const foreign=[];
  for(const attempt of [()=>g.submit(oldWindow),()=>g.read(oldWindow),()=>g.release(oldWindow),()=>g.poll(oldOperation),()=>g.cancel(oldOperation),()=>g.complete(oldOperation,[9])]) {
    try {attempt();foreign.push(0);}catch(error){foreign.push(error);}
  }
  const live=g.counts();g.complete(operation,[7]);const bytes=g.read(window);g.release(operation);g.release(window);
  console.log(JSON.stringify({window,operation,foreign,live,bytes,final:g.counts()}));
}
