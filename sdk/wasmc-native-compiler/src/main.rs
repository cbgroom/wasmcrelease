use std::{
    env, fs,
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    process,
};

use sha2::{Digest, Sha256};
use wasmc_native_compiler::{Compiler, Limits};
use wasmi::{
    Engine as WasmiEngine, Linker as WasmiLinker, Module as WasmiModule, Store as WasmiStore,
};
use wasmtime::{
    Config as WasmtimeConfig, Engine as WasmtimeEngine, Module as WasmtimeModule,
    OptLevel as WasmtimeOptLevel, Store as WasmtimeStore,
};

const NATIVE_MAGIC: &[u8; 8] = b"WASMCN01";
const NATIVE_VERSION: u32 = 1;
const NATIVE_FOOTER_LEN: usize = 60;
const WASMTIME_VERSION: &str = "47.0.4";
const AOT_PROFILE: &str = "core-speed-v1";

fn main() {
    match maybe_run_native_image() {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => {
            eprintln!("{error}");
            process::exit(1);
        }
    }
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = env::args_os().collect::<Vec<_>>();
    match args.as_slice() {
        [_, command, input, rest @ ..] if command == "run" => run_source(input, rest),
        [_, command, input, flag, output] if command == "build" && flag == "-o" => {
            build_wasm(input, output)
        }
        [_, command, target_flag, target, input, output_flag, output]
            if command == "build"
                && target_flag == "--target"
                && target == "native"
                && output_flag == "-o" =>
        {
            build_native(input, output)
        }
        [_, command, input, output] if command == "compile" => build_wasm(input, output),
        _ => Err(
            "usage:\n  wasmc run INPUT.wasmc [scalar-arg ...]\n  wasmc build INPUT.wasmc -o OUTPUT.wasm\n  wasmc build --target native INPUT.wasmc -o EXECUTABLE"
                .into(),
        ),
    }
}

fn read_source(path: &std::ffi::OsStr) -> Result<String, String> {
    let path = PathBuf::from(path);
    let limits = Limits::default();
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    if metadata.len() > limits.source_bytes as u64 {
        return Err("source limit exceeded".into());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

fn compile_source(path: &std::ffi::OsStr) -> Result<Vec<u8>, String> {
    let source = read_source(path)?;
    Compiler::new(Limits::default())?.compile(&source)
}

fn write_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())
}

fn build_wasm(input: &std::ffi::OsStr, output: &std::ffi::OsStr) -> Result<(), String> {
    let wasm = compile_source(input)?;
    write_new(&PathBuf::from(output), &wasm)
}

fn run_source(input: &std::ffi::OsStr, args: &[std::ffi::OsString]) -> Result<(), String> {
    let wasm = compile_source(input)?;
    let engine = WasmiEngine::default();
    let module = WasmiModule::new(&engine, &wasm).map_err(|e| e.to_string())?;
    if let Some(import) = module.imports().next() {
        return Err(format!(
            "`wasmc run` v1 requires an import-free App; unresolved import {}.{}",
            import.module(),
            import.name()
        ));
    }
    let mut store = WasmiStore::new(&engine, ());
    let instance = WasmiLinker::<()>::new(&engine)
        .instantiate_and_start(&mut store, &module)
        .map_err(|e| e.to_string())?;
    let function = instance
        .get_func(&store, "run")
        .ok_or("missing export `run`")?;
    let ty = function.ty(&store);
    if ty.params().len() != args.len() {
        return Err(format!(
            "export `run` expects {} scalar arguments, got {}",
            ty.params().len(),
            args.len()
        ));
    }
    let params = ty
        .params()
        .iter()
        .zip(args)
        .map(|(ty, value)| parse_wasmi_value(*ty, value))
        .collect::<Result<Vec<_>, _>>()?;
    let mut results = ty
        .results()
        .iter()
        .copied()
        .map(wasmi::Val::default_for_ty)
        .collect::<Vec<_>>();
    function
        .call(&mut store, &params, &mut results)
        .map_err(|e| e.to_string())?;
    print_wasmi_results(&results);
    Ok(())
}

fn parse_wasmi_value(ty: wasmi::ValType, value: &std::ffi::OsStr) -> Result<wasmi::Val, String> {
    let text = value.to_str().ok_or("argument must be UTF-8")?;
    match ty {
        wasmi::ValType::I32 => text
            .parse::<i32>()
            .map(wasmi::Val::I32)
            .map_err(|e| e.to_string()),
        wasmi::ValType::I64 => text
            .parse::<i64>()
            .map(wasmi::Val::I64)
            .map_err(|e| e.to_string()),
        wasmi::ValType::F32 => text
            .parse::<f32>()
            .map(|value| wasmi::Val::F32(value.into()))
            .map_err(|e| e.to_string()),
        wasmi::ValType::F64 => text
            .parse::<f64>()
            .map(|value| wasmi::Val::F64(value.into()))
            .map_err(|e| e.to_string()),
        other => Err(format!("unsupported `wasmc run` value type `{other:?}`")),
    }
}

fn print_wasmi_results(values: &[wasmi::Val]) {
    for (index, value) in values.iter().enumerate() {
        if index != 0 {
            print!(" ");
        }
        match value {
            wasmi::Val::I32(value) => print!("{value}"),
            wasmi::Val::I64(value) => print!("{value}"),
            wasmi::Val::F32(value) => print!("{}", f32::from_bits(value.to_bits())),
            wasmi::Val::F64(value) => print!("{}", f64::from_bits(value.to_bits())),
            other => print!("{other:?}"),
        }
    }
    println!();
}

fn build_native(input: &std::ffi::OsStr, output: &std::ffi::OsStr) -> Result<(), String> {
    let wasm = compile_source(input)?;
    let (cwasm, cache, hit) = native_cache_or_precompile(&wasm)?;
    let runner =
        fs::read(env::current_exe().map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let image = append_native_image(&runner, &cwasm)?;
    let output = PathBuf::from(output);
    write_new(&output, &image)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&output, fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }
    eprintln!(
        "native {}: {} (cache {} {})",
        if hit { "reuse" } else { "build" },
        output.display(),
        cache.display(),
        if hit { "hit" } else { "miss" }
    );
    Ok(())
}

fn native_cache_or_precompile(wasm: &[u8]) -> Result<(Vec<u8>, PathBuf, bool), String> {
    let key = native_cache_key(wasm);
    let cache = cache_root().join("native").join(key);
    let cwasm_path = cache.join("app.cwasm");
    let digest_path = cache.join("app.cwasm.sha256");
    if let (Ok(cwasm), Ok(expected)) = (fs::read(&cwasm_path), fs::read_to_string(&digest_path)) {
        if sha256_hex(&cwasm) == expected.trim() {
            return Ok((cwasm, cache, true));
        }
    }
    let mut config = WasmtimeConfig::new();
    config.cranelift_opt_level(WasmtimeOptLevel::Speed);
    let engine = WasmtimeEngine::new(&config).map_err(|e| e.to_string())?;
    let cwasm = engine.precompile_module(wasm).map_err(|e| e.to_string())?;
    fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    fs::write(&cwasm_path, &cwasm).map_err(|e| e.to_string())?;
    fs::write(&digest_path, format!("{}\n", sha256_hex(&cwasm))).map_err(|e| e.to_string())?;
    Ok((cwasm, cache, false))
}

fn cache_root() -> PathBuf {
    if let Some(value) = env::var_os("WASMC_CACHE_DIR") {
        return PathBuf::from(value);
    }
    if let Some(value) = env::var_os("XDG_CACHE_HOME") {
        return PathBuf::from(value).join("wasmc");
    }
    if cfg!(windows) {
        return env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(env::temp_dir)
            .join("wasmc");
    }
    env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
        .join(".cache")
        .join("wasmc")
}

fn native_cache_key(wasm: &[u8]) -> String {
    let identity = format!(
        "wasm={}\nwasmtime={WASMTIME_VERSION}\ntarget={}\ncpu={}\nprofile={AOT_PROFILE}\n",
        sha256_hex(wasm),
        target_identity(),
        cpu_features().join(",")
    );
    sha256_hex(identity.as_bytes())
}

fn target_identity() -> String {
    let suffix = match env::consts::OS {
        "macos" => "apple-darwin".to_string(),
        "linux" if cfg!(target_env = "musl") => "unknown-linux-musl".to_string(),
        "linux" => "unknown-linux-gnu".to_string(),
        "windows" if cfg!(target_env = "gnu") => "pc-windows-gnu".to_string(),
        "windows" => "pc-windows-msvc".to_string(),
        other => format!("unknown-{other}"),
    };
    format!("{}-{suffix}", env::consts::ARCH)
}

fn cpu_features() -> Vec<&'static str> {
    let mut out = Vec::new();
    #[cfg(target_arch = "aarch64")]
    for (name, enabled) in [
        ("aes", std::arch::is_aarch64_feature_detected!("aes")),
        ("crc", std::arch::is_aarch64_feature_detected!("crc")),
        (
            "dotprod",
            std::arch::is_aarch64_feature_detected!("dotprod"),
        ),
        ("fp16", std::arch::is_aarch64_feature_detected!("fp16")),
        ("lse", std::arch::is_aarch64_feature_detected!("lse")),
        ("neon", std::arch::is_aarch64_feature_detected!("neon")),
        ("sha2", std::arch::is_aarch64_feature_detected!("sha2")),
    ] {
        if enabled {
            out.push(name);
        }
    }
    #[cfg(target_arch = "x86_64")]
    for (name, enabled) in [
        ("sse2", std::arch::is_x86_feature_detected!("sse2")),
        ("sse4.1", std::arch::is_x86_feature_detected!("sse4.1")),
        ("sse4.2", std::arch::is_x86_feature_detected!("sse4.2")),
        ("avx", std::arch::is_x86_feature_detected!("avx")),
        ("avx2", std::arch::is_x86_feature_detected!("avx2")),
        ("bmi1", std::arch::is_x86_feature_detected!("bmi1")),
        ("bmi2", std::arch::is_x86_feature_detected!("bmi2")),
    ] {
        if enabled {
            out.push(name);
        }
    }
    out.sort_unstable();
    out
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn sha256_bytes(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

fn append_native_image(runner: &[u8], cwasm: &[u8]) -> Result<Vec<u8>, String> {
    let total = runner
        .len()
        .checked_add(cwasm.len())
        .and_then(|value| value.checked_add(NATIVE_FOOTER_LEN))
        .ok_or("native image size overflow")?;
    let mut out = Vec::with_capacity(total);
    out.extend_from_slice(runner);
    out.extend_from_slice(cwasm);
    out.extend_from_slice(NATIVE_MAGIC);
    out.extend_from_slice(&NATIVE_VERSION.to_le_bytes());
    out.extend_from_slice(&(runner.len() as u64).to_le_bytes());
    out.extend_from_slice(&(cwasm.len() as u64).to_le_bytes());
    out.extend_from_slice(&sha256_bytes(cwasm));
    Ok(out)
}

fn read_native_image(path: &Path) -> Result<Option<Vec<u8>>, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let file_len = usize::try_from(file.metadata().map_err(|e| e.to_string())?.len())
        .map_err(|_| "native image file length exceeds host")?;
    if file_len < NATIVE_FOOTER_LEN {
        return Ok(None);
    }
    file.seek(SeekFrom::End(-(NATIVE_FOOTER_LEN as i64)))
        .map_err(|e| e.to_string())?;
    let mut footer = [0u8; NATIVE_FOOTER_LEN];
    file.read_exact(&mut footer).map_err(|e| e.to_string())?;
    if &footer[..8] != NATIVE_MAGIC {
        return Ok(None);
    }
    if u32::from_le_bytes(footer[8..12].try_into().map_err(|_| "bad native version")?)
        != NATIVE_VERSION
    {
        return Err("unsupported native image version".into());
    }
    let runner_len = usize::try_from(u64::from_le_bytes(
        footer[12..20].try_into().map_err(|_| "bad runner length")?,
    ))
    .map_err(|_| "runner length exceeds host")?;
    let cwasm_len = usize::try_from(u64::from_le_bytes(
        footer[20..28].try_into().map_err(|_| "bad cwasm length")?,
    ))
    .map_err(|_| "cwasm length exceeds host")?;
    if runner_len
        .checked_add(cwasm_len)
        .and_then(|value| value.checked_add(NATIVE_FOOTER_LEN))
        != Some(file_len)
    {
        return Err("native image length mismatch".into());
    }
    file.seek(SeekFrom::Start(runner_len as u64))
        .map_err(|e| e.to_string())?;
    let mut cwasm = vec![0u8; cwasm_len];
    file.read_exact(&mut cwasm).map_err(|e| e.to_string())?;
    if sha256_bytes(&cwasm).as_slice() != &footer[28..60] {
        return Err("native AOT digest mismatch".into());
    }
    Ok(Some(cwasm))
}

fn maybe_run_native_image() -> Result<bool, String> {
    let path = env::current_exe().map_err(|e| e.to_string())?;
    let Some(cwasm) = read_native_image(&path)? else {
        return Ok(false);
    };
    let mut config = WasmtimeConfig::new();
    config.cranelift_opt_level(WasmtimeOptLevel::Speed);
    let engine = WasmtimeEngine::new(&config).map_err(|e| e.to_string())?;
    // Safety: the AOT bytes are part of the executable and digest-checked by
    // the fixed footer before deserialization. Wasmtime then enforces its own
    // target/config compatibility metadata.
    let module =
        unsafe { WasmtimeModule::deserialize(&engine, &cwasm) }.map_err(|e| e.to_string())?;
    if let Some(import) = module.imports().next() {
        return Err(format!(
            "native v1 requires an import-free App; unresolved import {}.{}",
            import.module(),
            import.name()
        ));
    }
    let mut store = WasmtimeStore::new(&engine, ());
    let instance = wasmtime::Instance::new(&mut store, &module, &[]).map_err(|e| e.to_string())?;
    let function = instance
        .get_func(&mut store, "run")
        .ok_or("missing export `run`")?;
    let ty = function.ty(&store);
    let raw_args = env::args_os().skip(1).collect::<Vec<_>>();
    if ty.params().len() != raw_args.len() {
        return Err(format!(
            "native `run` expects {} scalar arguments, got {}",
            ty.params().len(),
            raw_args.len()
        ));
    }
    let params = ty
        .params()
        .zip(&raw_args)
        .map(|(ty, value)| parse_wasmtime_value(ty, value))
        .collect::<Result<Vec<_>, _>>()?;
    let mut results = ty
        .results()
        .map(|ty| wasmtime::Val::default_for_ty(&ty).ok_or("unsupported native result type"))
        .collect::<Result<Vec<_>, _>>()?;
    function
        .call(&mut store, &params, &mut results)
        .map_err(|e| e.to_string())?;
    print_wasmtime_results(&results);
    Ok(true)
}

fn parse_wasmtime_value(
    ty: wasmtime::ValType,
    value: &std::ffi::OsStr,
) -> Result<wasmtime::Val, String> {
    let text = value.to_str().ok_or("argument must be UTF-8")?;
    match ty {
        wasmtime::ValType::I32 => text
            .parse::<i32>()
            .map(wasmtime::Val::I32)
            .map_err(|e| e.to_string()),
        wasmtime::ValType::I64 => text
            .parse::<i64>()
            .map(wasmtime::Val::I64)
            .map_err(|e| e.to_string()),
        wasmtime::ValType::F32 => text
            .parse::<f32>()
            .map(|value| wasmtime::Val::F32(value.to_bits()))
            .map_err(|e| e.to_string()),
        wasmtime::ValType::F64 => text
            .parse::<f64>()
            .map(|value| wasmtime::Val::F64(value.to_bits()))
            .map_err(|e| e.to_string()),
        other => Err(format!("unsupported native value type `{other}`")),
    }
}

fn print_wasmtime_results(values: &[wasmtime::Val]) {
    for (index, value) in values.iter().enumerate() {
        if index != 0 {
            print!(" ");
        }
        match value {
            wasmtime::Val::I32(value) => print!("{value}"),
            wasmtime::Val::I64(value) => print!("{value}"),
            wasmtime::Val::F32(value) => print!("{}", f32::from_bits(*value)),
            wasmtime::Val::F64(value) => print!("{}", f64::from_bits(*value)),
            other => print!("{other:?}"),
        }
    }
    println!();
}
