use anyhow::{bail, Context, Result};
use wasmi::{Caller, Engine, Instance, Linker, Memory, Module, Store};

const TLS_ENTROPY_MODULE: &str = "wasmc:tls-core/entropy@0.0.1";
const TLS_RESOURCE_MODULE: &str = "[export]wasmc:tls-client/tls@0.0.1";

struct TlsHost {
    random: u64,
    entropy_calls: u64,
}

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
            bail!(
                "pure Lib unexpectedly imports {}.{}",
                import.module(),
                import.name()
            );
        }
        let mut store = Store::new(&engine, ());
        let instance = Linker::<()>::new(&engine)
            .instantiate_and_start(&mut store, &module)
            .with_context(|| format!("instantiate {path}"))?;
        let memory = instance.get_memory(&store, "memory");
        Ok(Self {
            store,
            instance,
            memory,
        })
    }

    fn memory(&self) -> Result<Memory> {
        self.memory
            .ok_or_else(|| anyhow::anyhow!("memory export missing"))
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

    fn alloc_zeroed(&mut self, len: usize, align: i32) -> Result<i32> {
        let alloc = self
            .instance
            .get_typed_func::<(i32, i32, i32, i32), i32>(&self.store, "cabi_realloc")?;
        let ptr = alloc.call(&mut self.store, (0, 0, align, len as i32))?;
        self.memory()?
            .write(&mut self.store, ptr as usize, &vec![0; len])?;
        Ok(ptr)
    }

    fn write(&mut self, ptr: i32, bytes: &[u8]) -> Result<()> {
        self.memory()?.write(&mut self.store, ptr as usize, bytes)?;
        Ok(())
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
    let compact = core
        .instance
        .get_typed_func::<(i32, i32), i32>(&core.store, "wasmc:json/document@0.0.1#compact")?;
    let result = compact.call(&mut core.store, (ptr, input.len() as i32))?;
    let output = core.read_result_bytes(result)?;
    if output != br#"{"a":[1,true],"b":2}"# {
        bail!(
            "JSON compact mismatch: {}",
            String::from_utf8_lossy(&output)
        );
    }
    let post = core
        .instance
        .get_typed_func::<i32, ()>(&core.store, "cabi_post_wasmc:json/document@0.0.1#compact")?;
    post.call(&mut core.store, result)?;
    Ok(())
}

fn compression(path: &str) -> Result<()> {
    let mut core = Core::open(path)?;
    let input = b"hello hello hello";
    let ptr = core.alloc_bytes(input)?;
    let compress = core
        .instance
        .get_typed_func::<(i32, i32), i32>(&core.store, "wasmc:compression/gzip@0.0.1#compress")?;
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

fn http1_client(path: &str) -> Result<()> {
    let mut core = Core::open(path)?;
    let method = b"GET";
    let target = b"/health";
    let header_name = b"host";
    let header_value = b"example.test";
    let method_ptr = core.alloc_bytes(method)?;
    let target_ptr = core.alloc_bytes(target)?;
    let name_ptr = core.alloc_bytes(header_name)?;
    let value_ptr = core.alloc_bytes(header_value)?;
    let headers_ptr = core.alloc_zeroed(16, 4)?;
    let mut header = [0u8; 16];
    header[0..4].copy_from_slice(&(name_ptr as u32).to_le_bytes());
    header[4..8].copy_from_slice(&(header_name.len() as u32).to_le_bytes());
    header[8..12].copy_from_slice(&(value_ptr as u32).to_le_bytes());
    header[12..16].copy_from_slice(&(header_value.len() as u32).to_le_bytes());
    core.write(headers_ptr, &header)?;

    let serialize = core
        .instance
        .get_typed_func::<(i32, i32, i32, i32, i32, i32, i32, i32), i32>(
            &core.store,
            "wasmc:http1-client/wire@0.0.1#serialize-request",
        )?;
    let result = serialize.call(
        &mut core.store,
        (
            method_ptr,
            method.len() as i32,
            target_ptr,
            target.len() as i32,
            headers_ptr,
            1,
            0,
            0,
        ),
    )?;
    let output = core.read_result_bytes(result)?;
    if output != b"GET /health HTTP/1.1\r\nhost: example.test\r\n\r\n" {
        bail!(
            "HTTP client serialization mismatch: {}",
            String::from_utf8_lossy(&output)
        );
    }
    let post = core.instance.get_typed_func::<i32, ()>(
        &core.store,
        "cabi_post_wasmc:http1-client/wire@0.0.1#serialize-request",
    )?;
    post.call(&mut core.store, result)?;
    Ok(())
}

fn tls_client(path: &str, certificate_path: &str) -> Result<u64> {
    let engine = Engine::default();
    let bytes = std::fs::read(path).with_context(|| format!("read {path}"))?;
    let module = Module::new(&engine, &bytes[..]).with_context(|| format!("compile {path}"))?;
    let imports = module
        .imports()
        .map(|import| (import.module().to_owned(), import.name().to_owned()))
        .collect::<Vec<_>>();
    let expected = vec![
        (TLS_ENTROPY_MODULE.to_owned(), "fill".to_owned()),
        (
            TLS_RESOURCE_MODULE.to_owned(),
            "[resource-new]session".to_owned(),
        ),
        (
            TLS_RESOURCE_MODULE.to_owned(),
            "[resource-drop]session".to_owned(),
        ),
    ];
    if imports != expected {
        bail!("TLS client Core import mismatch: {imports:?}");
    }

    let mut linker = Linker::<TlsHost>::new(&engine);
    linker.func_wrap(
        TLS_ENTROPY_MODULE,
        "fill",
        |mut caller: Caller<'_, TlsHost>,
         length: i32,
         result_ptr: i32|
         -> std::result::Result<(), wasmi::Error> {
            let length = usize::try_from(length)
                .map_err(|_| wasmi::Error::new("negative entropy length"))?;
            let result_ptr = usize::try_from(result_ptr)
                .map_err(|_| wasmi::Error::new("negative entropy result pointer"))?;
            let memory = caller
                .get_export("memory")
                .and_then(|item| item.into_memory())
                .ok_or_else(|| wasmi::Error::new("TLS client memory export missing"))?;
            let realloc = caller
                .get_export("cabi_realloc")
                .and_then(|item| item.into_func())
                .ok_or_else(|| wasmi::Error::new("TLS client allocator export missing"))?
                .typed::<(i32, i32, i32, i32), i32>(&caller)?;
            let scratch = realloc
                .call(&mut caller, (0, 0, 1, length as i32))
                .map_err(|error| wasmi::Error::new(format!("allocate entropy result: {error}")))?
                as usize;
            let mut output = Vec::with_capacity(length);
            {
                let state = caller.data_mut();
                state.entropy_calls += 1;
                for _ in 0..length {
                    state.random ^= state.random << 13;
                    state.random ^= state.random >> 7;
                    state.random ^= state.random << 17;
                    output.push((state.random >> 24) as u8);
                }
            }
            memory
                .write(&mut caller, scratch, &output)
                .map_err(|error| wasmi::Error::new(format!("write entropy: {error}")))?;
            let mut result = [0u8; 12];
            result[4..8].copy_from_slice(&(scratch as u32).to_le_bytes());
            result[8..12].copy_from_slice(&(length as u32).to_le_bytes());
            memory
                .write(&mut caller, result_ptr, &result)
                .map_err(|error| wasmi::Error::new(format!("write entropy result: {error}")))?;
            Ok(())
        },
    )?;
    linker.func_wrap(
        TLS_RESOURCE_MODULE,
        "[resource-new]session",
        |representation: i32| -> i32 { representation },
    )?;
    linker.func_wrap(
        TLS_RESOURCE_MODULE,
        "[resource-drop]session",
        |_representation: i32| {},
    )?;

    let mut store = Store::new(
        &engine,
        TlsHost {
            random: 0x9e37_79b9_d1ce_beef,
            entropy_calls: 0,
        },
    );
    let instance = linker
        .instantiate_and_start(&mut store, &module)
        .with_context(|| format!("instantiate {path}"))?;
    let memory = instance
        .get_memory(&store, "memory")
        .ok_or_else(|| anyhow::anyhow!("TLS client memory export missing"))?;
    let alloc = instance.get_typed_func::<(i32, i32, i32, i32), i32>(&store, "cabi_realloc")?;
    let alloc_bytes = |store: &mut Store<TlsHost>, bytes: &[u8], align: i32| -> Result<i32> {
        if bytes.is_empty() {
            return Ok(0);
        }
        let ptr = alloc.call(&mut *store, (0, 0, align, bytes.len() as i32))?;
        memory.write(&mut *store, ptr as usize, bytes)?;
        Ok(ptr)
    };

    let server_name = b"example.com";
    let server_name_ptr = alloc_bytes(&mut store, server_name, 1)?;
    let certificate = std::fs::read(certificate_path)
        .with_context(|| format!("read TLS certificate {certificate_path}"))?;
    let certificate_ptr = alloc_bytes(&mut store, &certificate, 1)?;
    let mut roots = [0u8; 8];
    roots[0..4].copy_from_slice(&(certificate_ptr as u32).to_le_bytes());
    roots[4..8].copy_from_slice(&(certificate.len() as u32).to_le_bytes());
    let roots_ptr = alloc_bytes(&mut store, &roots, 4)?;
    let alpn = b"http/1.1";
    let alpn_ptr = alloc_bytes(&mut store, alpn, 1)?;
    let mut alpns = [0u8; 8];
    alpns[0..4].copy_from_slice(&(alpn_ptr as u32).to_le_bytes());
    alpns[4..8].copy_from_slice(&(alpn.len() as u32).to_le_bytes());
    let alpns_ptr = alloc_bytes(&mut store, &alpns, 4)?;

    let create = instance.get_typed_func::<(i32, i32, i32, i32, i64, i32, i32), i32>(
        &store,
        "wasmc:tls-client/tls@0.0.1#create",
    )?;
    let result_ptr = create
        .call(
            &mut store,
            (
                server_name_ptr,
                server_name.len() as i32,
                roots_ptr,
                1,
                1_700_000_000,
                alpns_ptr,
                1,
            ),
        )
        .context("Wasmi TLS client create call")?;
    let mut create_result = [0u8; 8];
    memory.read(&store, result_ptr as usize, &mut create_result)?;
    if create_result[0] != 0 {
        bail!("Wasmi TLS client create failed: {create_result:?}");
    }
    let session = i32::from_le_bytes(create_result[4..8].try_into().unwrap());

    let state = instance
        .get_typed_func::<i32, i32>(&store, "wasmc:tls-client/tls@0.0.1#[method]session.state")?;
    let state_ptr = state
        .call(&mut store, session)
        .context("Wasmi TLS client state call")?;
    let mut progress = [0u8; 12];
    memory.read(&store, state_ptr as usize, &mut progress)?;
    if progress[0] != 0 {
        bail!("Wasmi TLS client did not begin handshaking: {progress:?}");
    }
    let pending = u32::from_le_bytes(progress[4..8].try_into().unwrap());
    if pending == 0 {
        bail!("Wasmi TLS client produced no initial handshake bytes");
    }

    let output = instance.get_typed_func::<(i32, i32), i32>(
        &store,
        "wasmc:tls-client/tls@0.0.1#[method]session.output",
    )?;
    let output_result_ptr = output
        .call(&mut store, (session, pending as i32))
        .context("Wasmi TLS client output call")?;
    let mut output_result = [0u8; 12];
    memory.read(&store, output_result_ptr as usize, &mut output_result)?;
    if output_result[0] != 0 {
        bail!("Wasmi TLS client output failed: {output_result:?}");
    }
    let ciphertext_ptr = u32::from_le_bytes(output_result[4..8].try_into().unwrap());
    let ciphertext_len = u32::from_le_bytes(output_result[8..12].try_into().unwrap());
    if ciphertext_len == 0 || ciphertext_len != pending {
        bail!("Wasmi TLS initial flight mismatch: pending={pending} output={ciphertext_len}");
    }
    let mut ciphertext = vec![0; ciphertext_len as usize];
    memory.read(&store, ciphertext_ptr as usize, &mut ciphertext)?;
    if ciphertext.first() != Some(&22) {
        bail!("Wasmi TLS initial record is not a handshake record");
    }
    let post_output = instance.get_typed_func::<i32, ()>(
        &store,
        "cabi_post_wasmc:tls-client/tls@0.0.1#[method]session.output",
    )?;
    post_output
        .call(&mut store, output_result_ptr)
        .context("Wasmi TLS client post-output call")?;

    let commit = instance.get_typed_func::<(i32, i32), i32>(
        &store,
        "wasmc:tls-client/tls@0.0.1#[method]session.commit-output",
    )?;
    let commit_result_ptr = commit
        .call(&mut store, (session, ciphertext_len as i32))
        .context("Wasmi TLS client commit-output call")?;
    let mut commit_result = [0u8; 8];
    memory.read(&store, commit_result_ptr as usize, &mut commit_result)?;
    if commit_result[0] != 0 {
        bail!("Wasmi TLS client commit-output failed: {commit_result:?}");
    }

    let destructor =
        instance.get_typed_func::<i32, ()>(&store, "wasmc:tls-client/tls@0.0.1#[dtor]session")?;
    destructor
        .call(&mut store, session)
        .context("Wasmi TLS client destructor call")?;
    if store.data().entropy_calls == 0 {
        bail!("Wasmi TLS client did not invoke the approved entropy import");
    }
    Ok(store.data().entropy_calls)
}

fn structural(path: &str, exports: &[&str]) -> Result<()> {
    let core = Core::open(path)?;
    core.memory()?;
    if core
        .instance
        .get_export(&core.store, "cabi_realloc")
        .is_none()
    {
        bail!("canonical allocator export missing: {path}");
    }
    for export in exports {
        if core.instance.get_export(&core.store, export).is_none() {
            bail!("expected Core export missing in {path}: {export}");
        }
    }
    Ok(())
}

fn main() -> Result<()> {
    let router_path = std::env::var("WASMC_LIBSRC_ROUTER")?;
    let json_path = std::env::var("WASMC_LIBSRC_JSON")?;
    let compression_path = std::env::var("WASMC_LIBSRC_COMPRESSION")?;
    let http1_path = std::env::var("WASMC_LIBSRC_HTTP1")?;
    let http1_client_path = std::env::var("WASMC_LIBSRC_HTTP1_CLIENT")?;
    let tls_client_path = std::env::var("WASMC_LIBSRC_TLS_CLIENT")?;
    let tls_certificate_path = std::env::var("WASMC_LIBSRC_TLS_CERTIFICATE")?;
    let data_core_path = std::env::var("WASMC_LIBSRC_DATA_CORE")?;
    let csv_path = std::env::var("WASMC_LIBSRC_CSV")?;
    let expr_path = std::env::var("WASMC_LIBSRC_DATA_EXPR")?;
    let compute_path = std::env::var("WASMC_LIBSRC_DATA_COMPUTE")?;
    let relational_path = std::env::var("WASMC_LIBSRC_DATA_RELATIONAL")?;
    let relational_version = std::env::var("WASMC_LIBSRC_DATA_RELATIONAL_VERSION")
        .unwrap_or_else(|_| "0.0.1".to_string());
    let profile_path = std::env::var("WASMC_LIBSRC_DATA_PROFILE")?;
    let interchange_path = std::env::var("WASMC_LIBSRC_DATA_INTERCHANGE")?;

    router(&router_path)?;
    json(&json_path)?;
    compression(&compression_path)?;
    http1(&http1_path)?;
    http1_client(&http1_client_path)?;
    let tls_entropy_calls = tls_client(&tls_client_path, &tls_certificate_path)?;
    structural(
        &data_core_path,
        &[
            "wasmc:data-core/model@0.0.1#validate",
            "wasmc:data-core/model@0.0.1#take",
        ],
    )?;
    structural(&csv_path, &["wasmc:csv/parser@0.0.1#parse"])?;
    structural(
        &expr_path,
        &[
            "wasmc:data-expr/expr@0.0.1#validate",
            "wasmc:data-expr/expr@0.0.1#evaluate",
        ],
    )?;
    structural(
        &compute_path,
        &[
            "wasmc:data-compute/compute@0.0.1#filter",
            "wasmc:data-compute/compute@0.0.1#project",
            "wasmc:data-compute/compute@0.0.1#sort",
        ],
    )?;
    let relational_prefix = format!(
        "wasmc:data-relational/relational@{}#",
        relational_version
    );
    let mut relational_exports = vec![
        format!("{relational_prefix}group-aggregate"),
        format!("{relational_prefix}union-all"),
        format!("{relational_prefix}equi-join"),
        format!("{relational_prefix}window-rank"),
    ];
    if relational_version == "0.0.2" {
        relational_exports.push(format!("{relational_prefix}distinct"));
        relational_exports.push(format!("{relational_prefix}window-offset"));
        relational_exports.push(format!("{relational_prefix}window-aggregate"));
    } else if relational_version != "0.0.1" {
        bail!("unsupported relational qualification version: {relational_version}");
    }
    let relational_export_refs = relational_exports
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>();
    structural(&relational_path, &relational_export_refs)?;
    structural(
        &profile_path,
        &["wasmc:data-profile/profile@0.0.1#describe"],
    )?;
    structural(
        &interchange_path,
        &[
            "wasmc:data-interchange/adapter@0.0.1#ipc-file-encode",
            "wasmc:data-interchange/adapter@0.0.1#ipc-file-decode",
            "wasmc:data-interchange/adapter@0.0.1#parquet-encode",
            "wasmc:data-interchange/adapter@0.0.1#parquet-decode",
        ],
    )?;

    println!(
        "{{\"accepted\":true,\"engine\":\"wasmi-2.0.0\",\"candidates\":[\"wasmc-router-policy\",\"wasmc-json\",\"wasmc-compression\",\"wasmc-http1\",\"wasmc-http1-client\",\"wasmc-tls-client\",\"wasmc-data-core\",\"wasmc-csv\",\"wasmc-data-expr\",\"wasmc-data-compute\",\"wasmc-data-relational\",\"wasmc-data-profile\",\"wasmc-data-interchange\"],\"relational_version\":\"{}\",\"representative_execution\":true,\"structural_data_qualification\":true,\"pure_host_imports\":0,\"tls_client_semantic_host_imports\":[\"wasmc:tls-core/entropy@0.0.1#fill\"],\"tls_client_entropy_calls\":{tls_entropy_calls}}}",
        relational_version
    );
    Ok(())
}
