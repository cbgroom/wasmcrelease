use anyhow::{bail, Context, Result};
use wasmi::{Engine, Instance, Linker, Memory, Module, Store};

struct Core {
    store: Store<()>,
    instance: Instance,
    memory: Option<Memory>,
}

impl Core {
    fn open(path: &str) -> Result<Self> {
        let engine = Engine::default();
        let bytes = std::fs::read(path).with_context(|| format!("read {path}"))?;
        let module = Module::new(&engine, &bytes[..]).with_context(|| format!("compile {path}"))?;
        if let Some(import) = module.imports().next() {
            bail!("pure Lib unexpectedly imports {}.{}", import.module(), import.name());
        }
        let mut store = Store::new(&engine, ());
        let instance = Linker::<()>::new(&engine)
            .instantiate_and_start(&mut store, &module)
            .with_context(|| format!("instantiate {path}"))?;
        let memory = instance.get_memory(&store, "memory");
        Ok(Self { store, instance, memory })
    }

    fn memory(&self) -> Result<Memory> {
        self.memory.ok_or_else(|| anyhow::anyhow!("memory export missing"))
    }

    fn alloc_bytes(&mut self, bytes: &[u8]) -> Result<i32> {
        if bytes.is_empty() {
            return Ok(0);
        }
        let alloc = self
            .instance
            .get_typed_func::<(i32, i32, i32, i32), i32>(&self.store, "cabi_realloc")?;
        let ptr = alloc.call(&mut self.store, (0, 0, 1, bytes.len() as i32))?;
        self.memory()?.write(&mut self.store, ptr as usize, bytes)?;
        Ok(ptr)
    }

    fn read(&self, ptr: u32, len: u32) -> Result<Vec<u8>> {
        let mut bytes = vec![0; len as usize];
        if len != 0 {
            self.memory()?.read(&self.store, ptr as usize, &mut bytes)?;
        }
        Ok(bytes)
    }

    fn read_result_bytes(&self, ptr: i32) -> Result<Vec<u8>> {
        let raw = self.read(ptr as u32, 12)?;
        if raw[0] != 0 {
            bail!("Lib returned error tag={} code={}", raw[0], raw[4]);
        }
        let out_ptr = u32::from_le_bytes(raw[4..8].try_into().unwrap());
        let out_len = u32::from_le_bytes(raw[8..12].try_into().unwrap());
        self.read(out_ptr, out_len)
    }
}

fn router(path: &str) -> Result<()> {
    let mut core = Core::open(path)?;
    let route = core
        .instance
        .get_typed_func::<(i32, i32, i32, i32), (i32, i32, i32)>(&core.store, "route")?;
    let home = route.call(&mut core.store, (0, 0, 0, 0))?;
    if home != (200, 0, 0) {
        bail!("router home mismatch: {home:?}");
    }
    let create = route.call(&mut core.store, (1, 2, 1, 1))?;
    if create != (201, 1, 3) {
        bail!("router create mismatch: {create:?}");
    }
    Ok(())
}

fn json(path: &str) -> Result<()> {
    let mut core = Core::open(path)?;
    let input = br#"{ "b": 2, "a": [1, true] }"#;
    let ptr = core.alloc_bytes(input)?;
    let compact = core.instance.get_typed_func::<(i32, i32), i32>(
        &core.store,
        "wasmc:json/document@0.0.1#compact",
    )?;
    let result = compact.call(&mut core.store, (ptr, input.len() as i32))?;
    let output = core.read_result_bytes(result)?;
    if output != br#"{"a":[1,true],"b":2}"# {
        bail!("JSON compact mismatch: {}", String::from_utf8_lossy(&output));
    }
    let post = core.instance.get_typed_func::<i32, ()>(
        &core.store,
        "cabi_post_wasmc:json/document@0.0.1#compact",
    )?;
    post.call(&mut core.store, result)?;
    Ok(())
}

fn compression(path: &str) -> Result<()> {
    let mut core = Core::open(path)?;
    let input = b"hello hello hello";
    let ptr = core.alloc_bytes(input)?;
    let compress = core.instance.get_typed_func::<(i32, i32), i32>(
        &core.store,
        "wasmc:compression/gzip@0.0.1#compress",
    )?;
    let result = compress.call(&mut core.store, (ptr, input.len() as i32))?;
    let gzip = core.read_result_bytes(result)?;
    if !gzip.starts_with(&[0x1f, 0x8b, 0x08]) {
        bail!("gzip header mismatch");
    }
    let post_compress = core.instance.get_typed_func::<i32, ()>(
        &core.store,
        "cabi_post_wasmc:compression/gzip@0.0.1#compress",
    )?;
    post_compress.call(&mut core.store, result)?;

    let gzip_ptr = core.alloc_bytes(&gzip)?;
    let decompress = core.instance.get_typed_func::<(i32, i32), i32>(
        &core.store,
        "wasmc:compression/gzip@0.0.1#decompress",
    )?;
    let result = decompress.call(&mut core.store, (gzip_ptr, gzip.len() as i32))?;
    let roundtrip = core.read_result_bytes(result)?;
    if roundtrip != input {
        bail!("gzip roundtrip mismatch");
    }
    let post_decompress = core.instance.get_typed_func::<i32, ()>(
        &core.store,
        "cabi_post_wasmc:compression/gzip@0.0.1#decompress",
    )?;
    post_decompress.call(&mut core.store, result)?;
    Ok(())
}

fn http1(path: &str) -> Result<()> {
    let mut core = Core::open(path)?;
    let request = b"GET / HTTP/1.1\r\nHost: example.com\r\n\r\n";
    let ptr = core.alloc_bytes(request)?;
    let frame = core.instance.get_typed_func::<(i32, i32), i32>(
        &core.store,
        "wasmc:http1-server/wire@0.0.1#request-frame-length",
    )?;
    let result = frame.call(&mut core.store, (ptr, request.len() as i32))?;
    let raw = core.read(result as u32, 12)?;
    if raw[0] != 0 || raw[4] != 1 {
        bail!("HTTP frame result shape mismatch: {raw:?}");
    }
    let length = u32::from_le_bytes(raw[8..12].try_into().unwrap());
    if length != request.len() as u32 {
        bail!("HTTP frame length mismatch: {length} != {}", request.len());
    }
    Ok(())
}

fn main() -> Result<()> {
    let router_path = std::env::var("WASMC_LIBSRC_ROUTER")?;
    let json_path = std::env::var("WASMC_LIBSRC_JSON")?;
    let compression_path = std::env::var("WASMC_LIBSRC_COMPRESSION")?;
    let http1_path = std::env::var("WASMC_LIBSRC_HTTP1")?;

    router(&router_path)?;
    json(&json_path)?;
    compression(&compression_path)?;
    http1(&http1_path)?;

    println!(
        "{{\"accepted\":true,\"engine\":\"wasmi-2.0.0\",\"candidates\":[\"wasmc-router-policy\",\"wasmc-json\",\"wasmc-compression\",\"wasmc-http1\"],\"representative_execution\":true,\"host_imports\":0}}"
    );
    Ok(())
}
