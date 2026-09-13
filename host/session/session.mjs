// Trusted JS embedding SDK candidate. Opaque objects never expose registry IDs.
// No Core ABI or production platform acceptance is implied by this module.
export class HostError extends Error {
  constructor(category) {super(category); this.category = category;}
}
const fail = category => {throw new HostError(category);};
const codes = new Map([[-1,'invalid-resource'],[-2,'permission-denied'],[-3,'limit'],
  [-4,'busy'],[-5,'bounds'],[-6,'cancelled'],[-7,'unsupported']]);
const category = error => error instanceof HostError ? error.category : codes.get(error) ?? 'external-failure';
const ticket = () => Object.freeze(Object.create(null));

export class HostSession {
  #endpoints = new Map(); #windows = new Map(); #operations = new Map();
  #grants = new Map(); #root; #rootClosing=false; #revoked = false; #wake = new Set(); #sources;
  constructor(grants, sources = {}) {
    if(!Array.isArray(grants) || grants.length > 4) fail('limit');
    const backends = new Set();
    for(const grant of grants) {
      if(!/^[a-z][a-z0-9-]{0,31}$/.test(grant.name) || this.#grants.has(grant.name)
          || !['file','stream','datagram','listener'].includes(grant.kind)
          || !grant.backend || backends.has(grant.backend)
          || typeof grant.backend.release !== 'function'
          || (grant.read && typeof grant.backend[grant.kind==='listener'?'accept':'read'] !== 'function')
          || (grant.write && grant.kind!=='listener' && typeof grant.backend.write !== 'function')
          || typeof grant.read !== 'boolean' || typeof grant.write !== 'boolean') fail('bounds');
      backends.add(grant.backend);
      this.#grants.set(grant.name,{...grant});
    }
    this.#sources = {clockRead:typeof sources.clockRead==='function'?sources.clockRead.bind(sources):null,
      entropyFill:typeof sources.entropyFill==='function'?sources.entropyFill.bind(sources):null}; this.#root = ticket();
  }
  get root() {return this.#root;}
  #admit() {if(this.#revoked) fail('permission-denied');}
  #get(map, resource) {const row = map.get(resource); if(!row) fail('invalid-resource'); return row;}
  #idle(row) {if(row.pins || row.closing) fail('busy'); if(row.stopped) fail('invalid-resource');}
  describe(resource) {
    this.#admit();
    if(resource === this.#root) return [...this.#grants].map(([name,g]) => Object.freeze({name,kind:g.kind,read:g.read,write:g.write}));
    const e = this.#get(this.#endpoints,resource); this.#idle(e);
    return Object.freeze({kind:e.kind,read:e.read,write:e.write});
  }
  open(root, name, {read = true, write = false} = {}) {
    this.#admit(); if(root !== this.#root) fail('invalid-resource');
    if(typeof read !== 'boolean' || typeof write !== 'boolean') fail('bounds');
    const grant = this.#grants.get(name); if(!grant) fail('permission-denied');
    if((read && !grant.read) || (write && !grant.write)) fail('permission-denied');
    if(this.#endpoints.size >= 4) fail('limit');
    const ref = ticket();
    this.#endpoints.set(ref,{...grant,read,write,pins:0,closing:false,stopped:false});
    this.#grants.delete(name); return ref;
  }
  window_acquire(capacity) {
    this.#admit();
    if(!Number.isInteger(capacity) || capacity < 0 || capacity > 16) fail('bounds');
    if(this.#windows.size >= 4) fail('limit');
    const ref = ticket(); this.#windows.set(ref,{bytes:new Uint8Array(capacity),valid:0,pins:0,committed:false}); return ref;
  }
  #snapshot(bytes, capacity) {
    if(!Array.isArray(bytes)) fail('bounds');
    const length = bytes.length;
    if(!Number.isInteger(length) || length > capacity) fail('bounds');
    const copy = new Uint8Array(length);
    for(let i=0;i<length;i++) {const byte=bytes[i]; if(!Number.isInteger(byte) || byte<0 || byte>255) fail('bounds'); copy[i]=byte;}
    return copy;
  }
  window_commit(window, bytes, validBytes) {
    this.#admit(); const w=this.#get(this.#windows,window); this.#idle(w);
    const copy=this.#snapshot(bytes,w.bytes.length);
    if(!Number.isInteger(validBytes) || validBytes<0 || validBytes>copy.length) fail('bounds');
    this.#admit(); this.#get(this.#windows,window); this.#idle(w); // Getter reentry cannot mutate a newly pinned/retired window.
    w.bytes.fill(0); w.bytes.set(copy); w.valid=validBytes; w.committed=true;
  }
  copy_out(window) {
    this.#admit(); const w=this.#get(this.#windows,window); this.#idle(w);
    return Array.from(w.bytes.subarray(0,w.valid)); // Required SDK copy helper, not a new external mechanism.
  }
  #submit(endpoint, window, issue, stop, effectUnknown, ownedEndpoint=null) {
    this.#admit();
    const e=endpoint ? this.#get(this.#endpoints,endpoint) : null;
    const w=window ? this.#get(this.#windows,window) : null;
    if(e) this.#idle(e); if(w) this.#idle(w);
    if(this.#operations.size>=4) fail('limit'); // Includes undelivered terminal and quarantined records.
    const ref=ticket(), o={endpoint,window,e,w,pending:true,suppressed:false,stopFailed:false,
      backendSettled:false,result:null,resultTaken:false,ownedEndpoint,retirementStarted:false,stopAck:Promise.resolve(),stop,pinsReleased:false,closing:false};
    this.#operations.set(ref,o); if(e)e.pins++; if(w)w.pins++;
    o.settled = (async()=>{
      let result;
      try {result = await issue();}
      catch(error) {result={status:category(error),outcome:effectUnknown?'unknown':'no-payload'};}
      o.backendSettled=true;
      await o.stopAck;
      if(!o.stopFailed) {
        if(!o.pinsReleased) {if(e)e.pins--;if(w)w.pins--;o.pinsReleased=true;}
      }
      if(o.suppressed && w) {w.bytes.fill(0);w.valid=0;w.committed=false;}
      o.result=Object.freeze(o.suppressed ? {status:'cancelled',outcome:effectUnknown?'unknown':'no-payload'} : result);
      o.pending=false;
      for(const wake of [...this.#wake]) wake();
    })();
    // issue is trusted backend code; all completion errors stay owned/observable.
    return ref;
  }
  read(endpoint, window, {offset=0,length=16}={}) {
    const e=this.#get(this.#endpoints,endpoint),w=this.#get(this.#windows,window);
    if(e.kind==='listener') fail('unsupported');
    if(!e.read) fail('permission-denied');
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(length)||length<0||length>w.bytes.length||offset+length>64) fail('bounds');
    if(e.kind!=='file' && offset!==0) fail('unsupported');
    const stop=e.kind!=='file' && typeof e.backend.terminateRead==='function' ? ()=>e.backend.terminateRead() : null;
    return this.#submit(endpoint,window,async()=>{
      w.bytes.fill(0); w.valid=0; w.committed=false;
      const bytes=e.kind==='file' ? await e.backend.read(offset,length) : await e.backend.read(length);
      const copy=this.#snapshot(bytes,length);
      if(!this.#revoked) {w.bytes.set(copy);w.valid=copy.length;}
      return {status:'ok',transferred:copy.length,eof:e.kind!=='datagram' && copy.length===0};
    },stop,false);
  }
  write(endpoint, window, {offset=0}={}) {
    const e=this.#get(this.#endpoints,endpoint),w=this.#get(this.#windows,window);
    if(e.kind==='listener') fail('unsupported');
    if(!e.write) fail('permission-denied'); if(!w.committed) fail('bounds');
    if(!Number.isSafeInteger(offset)||offset<0||offset+w.valid>64) fail('bounds');
    if(e.kind!=='file' && offset!==0) fail('unsupported');
    const bytes=Array.from(w.bytes.subarray(0,w.valid));
    return this.#submit(endpoint,window,async()=>{
      const count=e.kind==='file' ? await e.backend.write(offset,bytes) : await e.backend.write(bytes);
      if(!Number.isInteger(count)||count<0||count>bytes.length) fail('external-failure');
      return {status:'ok',transferred:count};
    },null,true);
  }
  invoke(endpoint, operation) {
    const e=this.#get(this.#endpoints,endpoint);
    if(operation==='finish-write') {
      if(e.kind!=='stream'||typeof e.backend.finishWrite!=='function')fail('unsupported');
      if(!e.write)fail('permission-denied');
      return this.#submit(endpoint,null,async()=>{await e.backend.finishWrite();return {status:'ok',writeFinished:true};},null,true);
    }
    if(operation==='accept') {
      this.#admit();this.#idle(e);
      if(e.kind!=='listener'||typeof e.backend.accept!=='function') fail('unsupported');
      if(!e.read) fail('permission-denied');
      if(this.#endpoints.size>=4||this.#operations.size>=4) fail('limit');
      // Reserve before issuing accept. The token remains private to its owned
      // operation; passive receipts never expose or duplicate the connection.
      const child=ticket(),row={kind:'stream',read:e.read,write:e.write,backend:null,pins:0,closing:false,stopped:true};
      this.#endpoints.set(child,row);
      const stop=typeof e.backend.terminateAccept==='function'?()=>e.backend.terminateAccept():null;
      try {return this.#submit(endpoint,null,async()=>{
        row.backend=await e.backend.accept();
        return {status:'ok',kind:'endpoint'};
      },stop,false,child);} catch(error) {this.#endpoints.delete(child);throw error;}
    }
    if(operation!=='storage-sync'||e.kind!=='file'||typeof e.backend.invokeSync!=='function') fail('unsupported');
    if(!e.write) fail('permission-denied');
    return this.#submit(endpoint,null,async()=>{await e.backend.invokeSync();return {status:'ok',durability:'sync-acknowledged'};},null,true);
  }
  cancel(operation) {
    const o=this.#get(this.#operations,operation);
    if(!o.pending) return 'already-terminal';
    if(o.suppressed) return 'accepted';
    o.suppressed=true;
    if(o.stop && !o.backendSettled) {
      o.e.stopped=true;
      try {o.stopAck=Promise.resolve(o.stop()).catch(()=>{o.stopFailed=true;});}
      catch {o.stopFailed=true;}
    }
    return 'accepted';
  }
  async wait(operations,{timeoutMs=1000}={}) {
    if(!Array.isArray(operations)||!operations.length||operations.length>4||new Set(operations).size!==operations.length
        ||!Number.isFinite(timeoutMs)||timeoutMs<0||timeoutMs>30000) fail('bounds');
    const rows=operations.map(ref=>this.#get(this.#operations,ref));
    const collect=()=>rows.flatMap((o,index)=>!o.pending ? [Object.freeze({operation:operations[index],result:o.result,quarantined:o.stopFailed})] : []);
    let result=collect(); if(result.length||timeoutMs===0) return result;
    if(this.#wake.size>=4) fail('limit');
    return await new Promise(resolve=>{
      let timer;
      const finish=()=>{this.#wake.delete(wake);clearTimeout(timer);resolve(collect());};
      const wake=()=>{if(collect().length)finish();};
      this.#wake.add(wake);timer=setTimeout(finish,timeoutMs);wake();
    });
  }
  take_result(operation) {
    const o=this.#get(this.#operations,operation);
    if(o.pending||o.closing) fail('busy');
    if(o.retirementStarted) fail('invalid-resource');
    if(o.resultTaken) fail('already-terminal');
    if(o.ownedEndpoint)this.#admit(); // Revocation cannot grant a completed but unclaimed connection.
    // Claim before reporting a terminal error too: observing an error cannot
    // make a second claim possible. Quarantine ownership is still retained.
    o.resultTaken=true;
    if(o.result.status!=='ok') fail(o.result.status);
    if(o.ownedEndpoint) {
      const endpoint=o.ownedEndpoint,row=this.#get(this.#endpoints,endpoint);
      row.stopped=false;o.ownedEndpoint=null;
      return Object.freeze({status:'ok',kind:'endpoint',endpoint});
    }
    return o.result;
  }
  clock_read(kind) {
    this.#admit(); if(!['monotonic','wall'].includes(kind)) fail('unsupported');
    if(typeof this.#sources.clockRead!=='function') fail('permission-denied');
    const value=this.#sources.clockRead(kind);
    if(typeof value!=='bigint'||value<0n||value>0xffffffffffffffffn) fail('external-failure');return value;
  }
  entropy_fill(window,length) {
    const w=this.#get(this.#windows,window);
    if(typeof this.#sources.entropyFill!=='function') fail('permission-denied');
    if(!Number.isInteger(length)||length<0||length>w.bytes.length) fail('bounds');
    return this.#submit(null,window,async()=>{
      const bytes=new Uint8Array(length); await this.#sources.entropyFill(bytes);
      w.bytes.fill(0);w.bytes.set(bytes);w.valid=length;
      return {status:'ok',transferred:length};
    },null,false);
  }
  revoke() {this.#revoked=true;for(const [ref,o] of this.#operations)if(o.pending)this.cancel(ref);for(const w of this.#windows.values())if(!w.pins){w.bytes.fill(0);w.valid=0;}}
  async release(resource) {
    if(this.#root && resource===this.#root) {
      if(this.#rootClosing)fail('busy');this.#rootClosing=true;this.revoke();
      try {
        for(const [name,g] of this.#grants) {await g.backend.release();this.#grants.delete(name);}
        this.#root=null;return;
      } finally {this.#rootClosing=false;}
    }
    if(this.#operations.has(resource)) {
      const o=this.#get(this.#operations,resource);if(o.pending||o.closing)fail('busy');
      if(o.stopFailed||o.ownedEndpoint) {
        if(!o.backendSettled)fail('busy');
        // Cleanup-only retirement after actual backend settlement; failed close retains every pin and record.
        o.closing=true;o.retirementStarted=true;
        try {
          if(o.ownedEndpoint) {
            const child=this.#get(this.#endpoints,o.ownedEndpoint);
            if(child.backend)await child.backend.release();
            this.#endpoints.delete(o.ownedEndpoint);o.ownedEndpoint=null;
          }
          if(o.stopFailed) {
            await o.e.backend.release();
            this.#endpoints.delete(o.endpoint);o.e.pins--;if(o.w)o.w.pins--;o.pinsReleased=true;
          }
        } finally {o.closing=false;}
      }
      this.#operations.delete(resource);return;
    }
    if(this.#windows.has(resource)) {
      const w=this.#get(this.#windows,resource);this.#idle(w);w.bytes.fill(0);this.#windows.delete(resource);return;
    }
    const e=this.#get(this.#endpoints,resource);
    if(e.pins||e.closing)fail('busy');e.closing=true;e.stopped=true;
    try {await e.backend.release();this.#endpoints.delete(resource);} finally {e.closing=false;}
  }
  counts() {return Object.freeze({endpoints:this.#endpoints.size,unopened_grants:this.#grants.size,
    windows:this.#windows.size,operations:this.#operations.size,waiters:this.#wake.size,
    window_bytes:[...this.#windows.values()].reduce((sum,w)=>sum+w.bytes.length,0)});}
}
