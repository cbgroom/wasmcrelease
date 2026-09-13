// Trusted already-bound IPv4 loopback socket + fixed peer; no guest addresses.
export class PreauthorizedDatagram {
  #socket;#peer;#writable;#busy=false;#stopped=false;#closing=false;
  #queue=[];#error=0;#wake;#closed;#closeSeen=false;
  constructor(socket,peer,writable=true) {
    if(peer?.address!=='127.0.0.1'||!Number.isInteger(peer.port)||peer.port<1||peer.port>65535||typeof writable!=='boolean')throw -5;
    const local=socket.address();if(local.address!=='127.0.0.1'||!local.port)throw -5;
    this.#socket=socket;this.#peer={address:peer.address,port:peer.port};this.#writable=writable;
    this.#closed=new Promise(resolve=>socket.once('close',()=>{this.#closeSeen=true;this.#wake?.();resolve();}));
    socket.on('error',()=>{this.#error||=-8;this.#wake?.();});
    socket.on('message',(bytes,from)=>{
      if(this.#stopped||this.#error)return;
      if(this.#queue.length>=2){this.#error=-3;this.#wake?.();return;}
      const error=from.address!==this.#peer.address||from.port!==this.#peer.port?-2:bytes.length>16?-5:0;
      this.#queue.push(error?{error}:{bytes:Array.from(bytes)});this.#wake?.();
    });
  }
  #check(){if(!this.#socket)throw -1;if(this.#busy)throw -4;if(this.#stopped||this.#closeSeen)throw -1;if(this.#error)throw this.#error;}
  async read() {
    this.#check();this.#busy=true;
    try {
      return await new Promise((resolve,reject)=>{
        this.#wake=()=>{
          if(this.#stopped||this.#closeSeen||this.#error){this.#wake=undefined;reject(this.#error||-8);return;}
          const message=this.#queue.shift();if(!message)return;
          this.#wake=undefined;
          if(message.error)reject(message.error);else resolve(message.bytes);
        };this.#wake();
      });
    } finally {this.#wake=undefined;this.#busy=false;}
  }
  async write(data) {
    if(!Array.isArray(data))throw -5;
    const length=data.length;if(!Number.isInteger(length)||length<0||length>16)throw -5;
    const bytes=new Uint8Array(length);
    for(let i=0;i<bytes.length;i++){const value=data[i];if(!Number.isInteger(value)||value<0||value>255)throw -5;bytes[i]=value;}
    this.#check();if(!this.#writable)throw -2;this.#busy=true;
    try {await new Promise((resolve,reject)=>this.#socket.send(bytes,this.#peer.port,this.#peer.address,error=>error?reject(-9):resolve()));return bytes.length;}
    catch{throw -9;}finally{this.#busy=false;}
  }
  #close(){if(!this.#closing&&!this.#closeSeen){this.#closing=true;try{this.#socket.close();}catch(error){this.#closing=false;throw error;}}return this.#closed;}
  terminateRead(){if(!this.#socket)throw -1;this.#stopped=true;return this.#close();}
  async release(){if(!this.#socket)throw -1;if(this.#busy)throw -4;this.#stopped=true;this.#busy=true;try{await this.#close();this.#socket=null;this.#queue=[];return 0;}finally{this.#busy=false;}}
}
