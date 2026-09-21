#[cfg(all(feature = "readiness-dedicated", feature = "reactor-candidate"))]
compile_error!("readiness-dedicated and reactor-candidate are mutually exclusive");

#[cfg(not(any(feature = "readiness-dedicated", feature = "reactor-candidate")))]
#[path = "host_transport_baseline.rs"]
mod host_transport;
#[cfg(any(feature = "readiness-dedicated", feature = "reactor-candidate"))]
#[path = "host_transport_reactor.rs"]
mod host_transport;
#[cfg(any(feature = "readiness-dedicated", feature = "reactor-candidate"))]
mod readiness_owner;

use host_transport::{HostEndpoint, HostTransportError, HostWindow, Terminal};
use rustls::{
    pki_types::{CertificateDer, ServerName, UnixTime},
    time_provider::TimeProvider,
    ClientConfig, ClientConnection, RootCertStore, StreamOwned,
};
use std::{
    error::Error,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{mpsc, Arc},
    thread,
    time::{Duration, Instant},
};
use wasmtime::{Caller, Config, Engine, Instance, Linker, Memory, Module, Store, TypedFunc};

struct CoreBytesResultLib {
    instance: Instance,
    memory: Memory,
    realloc: TypedFunc<(i32, i32, i32, i32), i32>,
}

#[derive(Debug, Clone)]
struct Header {
    name: String,
    value: Vec<u8>,
}

#[derive(Debug)]
struct CoreRequestHead {
    method: String,
    target: String,
    minor_version: u8,
    headers: Vec<Header>,
    body_offset: u32,
}

struct CoreHttpLib {
    instance: Instance,
    memory: Memory,
    realloc: TypedFunc<(i32, i32, i32, i32), i32>,
}

impl CoreHttpLib {
    fn instantiate(
        engine: &Engine,
        store: &mut Store<Host>,
        path: &str,
    ) -> Result<Self, Box<dyn Error>> {
        let module = Module::from_file(engine, path)?;
        if module.imports().next().is_some() {
            return Err(format!("HTTP Core Lib must be import-free: {path}").into());
        }
        let instance = Instance::new(&mut *store, &module, &[])?;
        let memory = instance
            .get_memory(&mut *store, "memory")
            .ok_or("HTTP Core Lib has no exported memory")?;
        let realloc =
            instance.get_typed_func::<(i32, i32, i32, i32), i32>(&mut *store, "cabi_realloc")?;
        Ok(Self {
            instance,
            memory,
            realloc,
        })
    }

    fn alloc_bytes(&self, store: &mut Store<Host>, value: &[u8]) -> Result<i32, Box<dyn Error>> {
        if value.is_empty() {
            return Ok(0);
        }
        let ptr = self
            .realloc
            .call(&mut *store, (0, 0, 1, value.len() as i32))?;
        self.memory.write(&mut *store, ptr as usize, value)?;
        Ok(ptr)
    }

    fn read_bytes(
        &self,
        store: &mut Store<Host>,
        ptr: u32,
        len: u32,
    ) -> Result<Vec<u8>, Box<dyn Error>> {
        let mut value = vec![0u8; len as usize];
        if len != 0 {
            self.memory.read(&mut *store, ptr as usize, &mut value)?;
        }
        Ok(value)
    }

    fn read_u32(bytes: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
    }

    fn request_frame_length(
        &self,
        store: &mut Store<Host>,
        input: &[u8],
    ) -> Result<Result<Option<u32>, u8>, Box<dyn Error>> {
        let ptr = self.alloc_bytes(store, input)?;
        let function = self.instance.get_typed_func::<(i32, i32), i32>(
            &mut *store,
            "wasmc:http1-server/wire@0.0.1#request-frame-length",
        )?;
        let result_ptr = function.call(&mut *store, (ptr, input.len() as i32))?;
        let mut result = [0u8; 12];
        self.memory
            .read(&mut *store, result_ptr as usize, &mut result)?;
        Ok(match result[0] {
            0 => match result[4] {
                0 => Ok(None),
                1 => Ok(Some(Self::read_u32(&result, 8))),
                tag => return Err(format!("invalid HTTP option discriminant {tag}").into()),
            },
            1 => Err(result[4]),
            tag => return Err(format!("invalid HTTP result discriminant {tag}").into()),
        })
    }

    fn parse_request(
        &self,
        store: &mut Store<Host>,
        input: &[u8],
    ) -> Result<Result<CoreRequestHead, u8>, Box<dyn Error>> {
        let ptr = self.alloc_bytes(store, input)?;
        let function = self.instance.get_typed_func::<(i32, i32), i32>(
            &mut *store,
            "wasmc:http1-server/wire@0.0.1#parse-request",
        )?;
        let result_ptr = function.call(&mut *store, (ptr, input.len() as i32))?;
        let mut result = [0u8; 36];
        self.memory
            .read(&mut *store, result_ptr as usize, &mut result)?;
        let lifted = match result[0] {
            0 => {
                let method = self.read_bytes(
                    store,
                    Self::read_u32(&result, 4),
                    Self::read_u32(&result, 8),
                )?;
                let target = self.read_bytes(
                    store,
                    Self::read_u32(&result, 12),
                    Self::read_u32(&result, 16),
                )?;
                let headers_ptr = Self::read_u32(&result, 24);
                let headers_len = Self::read_u32(&result, 28);
                let mut headers = Vec::with_capacity(headers_len as usize);
                for index in 0..headers_len {
                    let mut raw = [0u8; 16];
                    self.memory.read(
                        &mut *store,
                        headers_ptr as usize + index as usize * 16,
                        &mut raw,
                    )?;
                    let name =
                        self.read_bytes(store, Self::read_u32(&raw, 0), Self::read_u32(&raw, 4))?;
                    let value =
                        self.read_bytes(store, Self::read_u32(&raw, 8), Self::read_u32(&raw, 12))?;
                    headers.push(Header {
                        name: String::from_utf8(name)?,
                        value,
                    });
                }
                Ok(CoreRequestHead {
                    method: String::from_utf8(method)?,
                    target: String::from_utf8(target)?,
                    minor_version: result[20],
                    headers,
                    body_offset: Self::read_u32(&result, 32),
                })
            }
            1 => Err(result[4]),
            tag => return Err(format!("invalid HTTP parse result discriminant {tag}").into()),
        };
        self.instance
            .get_typed_func::<i32, ()>(
                &mut *store,
                "cabi_post_wasmc:http1-server/wire@0.0.1#parse-request",
            )?
            .call(&mut *store, result_ptr)?;
        Ok(lifted)
    }

    fn serialize_response_head(
        &self,
        store: &mut Store<Host>,
        minor: u8,
        status: u16,
        headers: &[Header],
    ) -> Result<Result<Vec<u8>, u8>, Box<dyn Error>> {
        let headers_ptr = if headers.is_empty() {
            0
        } else {
            let ptr = self
                .realloc
                .call(&mut *store, (0, 0, 4, (headers.len() * 16) as i32))?;
            for (index, header) in headers.iter().enumerate() {
                let name_ptr = self.alloc_bytes(store, header.name.as_bytes())?;
                let value_ptr = self.alloc_bytes(store, &header.value)?;
                let mut raw = [0u8; 16];
                raw[0..4].copy_from_slice(&(name_ptr as u32).to_le_bytes());
                raw[4..8].copy_from_slice(&(header.name.len() as u32).to_le_bytes());
                raw[8..12].copy_from_slice(&(value_ptr as u32).to_le_bytes());
                raw[12..16].copy_from_slice(&(header.value.len() as u32).to_le_bytes());
                self.memory
                    .write(&mut *store, ptr as usize + index * 16, &raw)?;
            }
            ptr
        };
        let function = self.instance.get_typed_func::<(i32, i32, i32, i32), i32>(
            &mut *store,
            "wasmc:http1-server/wire@0.0.1#serialize-response-head",
        )?;
        let result_ptr = function.call(
            &mut *store,
            (
                minor as i32,
                status as i32,
                headers_ptr,
                headers.len() as i32,
            ),
        )?;
        let mut result = [0u8; 12];
        self.memory
            .read(&mut *store, result_ptr as usize, &mut result)?;
        let lifted = match result[0] {
            0 => Ok(self.read_bytes(
                store,
                Self::read_u32(&result, 4),
                Self::read_u32(&result, 8),
            )?),
            1 => Err(result[4]),
            tag => return Err(format!("invalid HTTP serialize result discriminant {tag}").into()),
        };
        self.instance
            .get_typed_func::<i32, ()>(
                &mut *store,
                "cabi_post_wasmc:http1-server/wire@0.0.1#serialize-response-head",
            )?
            .call(&mut *store, result_ptr)?;
        Ok(lifted)
    }
}

impl CoreBytesResultLib {
    fn instantiate(
        engine: &Engine,
        store: &mut Store<Host>,
        path: &str,
    ) -> Result<Self, Box<dyn Error>> {
        let module = Module::from_file(engine, path)?;
        if module.imports().next().is_some() {
            return Err(format!("Core dynamic Lib must be import-free: {path}").into());
        }
        let instance = Instance::new(&mut *store, &module, &[])?;
        let memory = instance
            .get_memory(&mut *store, "memory")
            .ok_or("Core dynamic Lib has no exported memory")?;
        let realloc =
            instance.get_typed_func::<(i32, i32, i32, i32), i32>(&mut *store, "cabi_realloc")?;
        Ok(Self {
            instance,
            memory,
            realloc,
        })
    }

    fn call_bytes_result(
        &self,
        store: &mut Store<Host>,
        function: &str,
        post_return: &str,
        input: &[u8],
    ) -> Result<Result<Vec<u8>, u8>, Box<dyn Error>> {
        let input_ptr = self
            .realloc
            .call(&mut *store, (0, 0, 1, input.len() as i32))?;
        self.memory.write(&mut *store, input_ptr as usize, input)?;
        let call = self
            .instance
            .get_typed_func::<(i32, i32), i32>(&mut *store, function)?;
        let result_ptr = call.call(&mut *store, (input_ptr, input.len() as i32))?;

        let mut result = [0u8; 12];
        self.memory
            .read(&mut *store, result_ptr as usize, &mut result)?;
        let tag = u32::from_le_bytes(result[0..4].try_into().unwrap());
        let lifted = match tag {
            0 => {
                let ptr = u32::from_le_bytes(result[4..8].try_into().unwrap()) as usize;
                let len = u32::from_le_bytes(result[8..12].try_into().unwrap()) as usize;
                let mut output = vec![0u8; len];
                self.memory.read(&mut *store, ptr, &mut output)?;
                Ok(output)
            }
            1 => Err(result[4]),
            other => return Err(format!("invalid Core result discriminant {other}").into()),
        };
        self.instance
            .get_typed_func::<i32, ()>(&mut *store, post_return)?
            .call(&mut *store, result_ptr)?;
        // WIT string/list parameters are owned inputs. The guest takes
        // ownership of the allocation produced by its exported realloc and
        // releases that input as part of the lowered call. Reallocating it to
        // zero here would be a double-free and poisons the Store.
        Ok(lifted)
    }
}

// Host transport now proves real partial physical writes independently. Keep
// the TLS output observation large enough for the production fast path; the
// source-free Host qualification still forces 7-byte physical writes and
// therefore exercises partial commit-output deterministically.
const TLS_IO_LIMIT: u32 = 64 * 1024;
const PLAIN_LIMIT: u32 = 64 * 1024;
const GZIP_THRESHOLD: usize = 256;
const KEEPALIVE_REQUESTS: usize = 256;
const OBSERVE_ONLY_EVENT_FUEL: u64 = u64::MAX;

#[derive(Default)]
struct Host {
    entropy_calls: u64,
    seed: u64,
}
impl Host {
    fn fill_entropy(&mut self, out: &mut [u8]) {
        self.entropy_calls += 1;
        let mut x = self.seed.wrapping_add(self.entropy_calls * 0x9e37_79b9);
        for byte in out {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            *byte = x as u8;
        }
        self.seed = x;
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ConnectionState {
    Handshaking,
    Ready,
    Closing,
    PeerClosed,
    Closed,
    Failed,
}

#[derive(Clone, Copy, Debug)]
struct Progress {
    state: ConnectionState,
    pending_output: u32,
    plaintext_available: u32,
}

struct CoreTlsLib {
    memory: Memory,
    io_ptr: i32,
    io_capacity: i32,
    config_ptr: i32,
    config_capacity: i32,
    create: TypedFunc<(i32, i64), i64>,
    state: TypedFunc<i32, i64>,
    ingest: TypedFunc<(i32, i32), i32>,
    output: TypedFunc<(i32, i32), i64>,
    commit_output: TypedFunc<(i32, i32), i32>,
    write: TypedFunc<(i32, i32), i32>,
    read: TypedFunc<(i32, i32), i64>,
    close: TypedFunc<i32, i32>,
    drop_resource: TypedFunc<i32, i32>,
}

impl CoreTlsLib {
    fn instantiate(
        engine: &Engine,
        store: &mut Store<Host>,
        path: &str,
    ) -> Result<Self, Box<dyn Error>> {
        let module = Module::from_file(engine, path)?;
        let imports = module.imports().collect::<Vec<_>>();
        if imports.len() != 1
            || imports[0].module() != "wasmc:tls-core/entropy"
            || imports[0].name() != "fill"
        {
            return Err("TLS Core Lib import inventory drifted".into());
        }
        let mut linker = Linker::<Host>::new(engine);
        linker.func_wrap(
            "wasmc:tls-core/entropy",
            "fill",
            |mut caller: Caller<'_, Host>, ptr: i32, len: i32| -> i32 {
                let Ok(length) = usize::try_from(len) else {
                    return 1;
                };
                if ptr < 0 || length > 64 * 1024 {
                    return 1;
                }
                let mut bytes = vec![0u8; length];
                caller.data_mut().fill_entropy(&mut bytes);
                let Some(wasmtime::Extern::Memory(memory)) = caller.get_export("memory") else {
                    return 1;
                };
                if memory.write(&mut caller, ptr as usize, &bytes).is_err() {
                    return 1;
                }
                0
            },
        )?;
        let instance = linker.instantiate(&mut *store, &module)?;
        let memory = instance
            .get_memory(&mut *store, "memory")
            .ok_or("TLS Core Lib has no exported memory")?;
        let io_ptr = instance
            .get_typed_func::<(), i32>(&mut *store, "wasmc_tls_core_io_buffer")?
            .call(&mut *store, ())?;
        let io_capacity = instance
            .get_typed_func::<(), i32>(&mut *store, "wasmc_tls_core_io_capacity")?
            .call(&mut *store, ())?;
        let config_ptr = instance
            .get_typed_func::<(), i32>(&mut *store, "wasmc_tls_core_config_buffer")?
            .call(&mut *store, ())?;
        let config_capacity = instance
            .get_typed_func::<(), i32>(&mut *store, "wasmc_tls_core_config_capacity")?
            .call(&mut *store, ())?;
        Ok(Self {
            memory,
            io_ptr,
            io_capacity,
            config_ptr,
            config_capacity,
            create: instance.get_typed_func(&mut *store, "wasmc_tls_core_create")?,
            state: instance.get_typed_func(&mut *store, "wasmc_tls_core_state")?,
            ingest: instance.get_typed_func(&mut *store, "wasmc_tls_core_ingest")?,
            output: instance.get_typed_func(&mut *store, "wasmc_tls_core_output")?,
            commit_output: instance.get_typed_func(&mut *store, "wasmc_tls_core_commit_output")?,
            write: instance.get_typed_func(&mut *store, "wasmc_tls_core_write")?,
            read: instance.get_typed_func(&mut *store, "wasmc_tls_core_read")?,
            close: instance.get_typed_func(&mut *store, "wasmc_tls_core_close")?,
            drop_resource: instance.get_typed_func(&mut *store, "wasmc_tls_core_drop")?,
        })
    }

    fn result_u32(value: i64) -> Result<u32, String> {
        let status = (value as u64 >> 32) as u32;
        if status == 0 {
            Ok(value as u32)
        } else {
            Err(format!("TLS Core status=0x{status:x}"))
        }
    }

    fn progress(value: i64) -> Result<Progress, String> {
        if value < 0 {
            return Err("invalid TLS Core resource".into());
        }
        let raw = value as u64;
        let state = match raw as u8 {
            0 => ConnectionState::Handshaking,
            1 => ConnectionState::Ready,
            2 => ConnectionState::Closing,
            3 => ConnectionState::PeerClosed,
            4 => ConnectionState::Closed,
            5 => ConnectionState::Failed,
            value => return Err(format!("invalid TLS Core state {value}")),
        };
        Ok(Progress {
            state,
            pending_output: ((raw >> 8) & 0x00ff_ffff) as u32,
            plaintext_available: (raw >> 32) as u32,
        })
    }

    fn create(
        &self,
        store: &mut Store<Host>,
        chain: &[Vec<u8>],
        key: &[u8],
        unix_time: u64,
    ) -> Result<i32, String> {
        let mut config = Vec::new();
        config.extend_from_slice(&(chain.len() as u32).to_le_bytes());
        for cert in chain {
            config.extend_from_slice(&(cert.len() as u32).to_le_bytes());
            config.extend_from_slice(cert);
        }
        config.extend_from_slice(&(key.len() as u32).to_le_bytes());
        config.extend_from_slice(key);
        if config.len() > self.config_capacity as usize {
            return Err("TLS Core config too large".into());
        }
        self.memory
            .write(&mut *store, self.config_ptr as usize, &config)
            .map_err(|error| error.to_string())?;
        let unix_time = i64::try_from(unix_time).map_err(|_| "TLS time overflow")?;
        Self::result_u32(
            self.create
                .call(&mut *store, (config.len() as i32, unix_time))
                .map_err(|error| error.to_string())?,
        )
        .map(|handle| handle as i32)
    }

    fn state(&self, store: &mut Store<Host>, handle: i32) -> Result<Progress, String> {
        Self::progress(
            self.state
                .call(&mut *store, handle)
                .map_err(|error| error.to_string())?,
        )
    }

    fn put_io(&self, store: &mut Store<Host>, bytes: &[u8]) -> Result<i32, String> {
        if bytes.len() > self.io_capacity as usize {
            return Err("TLS Core input too large".into());
        }
        self.memory
            .write(&mut *store, self.io_ptr as usize, bytes)
            .map_err(|error| error.to_string())?;
        Ok(bytes.len() as i32)
    }

    fn get_io(&self, store: &mut Store<Host>, len: u32) -> Result<Vec<u8>, String> {
        if len > self.io_capacity as u32 {
            return Err("TLS Core output too large".into());
        }
        let mut bytes = vec![0u8; len as usize];
        self.memory
            .read(&mut *store, self.io_ptr as usize, &mut bytes)
            .map_err(|error| error.to_string())?;
        Ok(bytes)
    }

    fn ingest(&self, store: &mut Store<Host>, handle: i32, bytes: &[u8]) -> Result<(), String> {
        let len = self.put_io(store, bytes)?;
        let status = self
            .ingest
            .call(&mut *store, (handle, len))
            .map_err(|error| error.to_string())?;
        (status == 0)
            .then_some(())
            .ok_or_else(|| format!("TLS Core ingest status=0x{status:x}"))
    }

    fn output(&self, store: &mut Store<Host>, handle: i32, limit: u32) -> Result<Vec<u8>, String> {
        let len = Self::result_u32(
            self.output
                .call(&mut *store, (handle, limit as i32))
                .map_err(|error| error.to_string())?,
        )?;
        self.get_io(store, len)
    }

    fn commit_output(&self, store: &mut Store<Host>, handle: i32, sent: u32) -> Result<(), String> {
        let status = self
            .commit_output
            .call(&mut *store, (handle, sent as i32))
            .map_err(|error| error.to_string())?;
        (status == 0)
            .then_some(())
            .ok_or_else(|| format!("TLS Core commit status=0x{status:x}"))
    }

    fn write(&self, store: &mut Store<Host>, handle: i32, bytes: &[u8]) -> Result<(), String> {
        let len = self.put_io(store, bytes)?;
        let status = self
            .write
            .call(&mut *store, (handle, len))
            .map_err(|error| error.to_string())?;
        (status == 0)
            .then_some(())
            .ok_or_else(|| format!("TLS Core write status=0x{status:x}"))
    }

    fn read(&self, store: &mut Store<Host>, handle: i32, limit: u32) -> Result<Vec<u8>, String> {
        let len = Self::result_u32(
            self.read
                .call(&mut *store, (handle, limit as i32))
                .map_err(|error| error.to_string())?,
        )?;
        self.get_io(store, len)
    }

    fn close(&self, store: &mut Store<Host>, handle: i32) -> Result<(), String> {
        let status = self
            .close
            .call(&mut *store, handle)
            .map_err(|error| error.to_string())?;
        (status == 0)
            .then_some(())
            .ok_or_else(|| format!("TLS Core close status=0x{status:x}"))
    }

    fn drop(&self, store: &mut Store<Host>, handle: i32) -> Result<(), String> {
        let status = self
            .drop_resource
            .call(&mut *store, handle)
            .map_err(|error| error.to_string())?;
        (status == 0)
            .then_some(())
            .ok_or_else(|| format!("TLS Core drop status=0x{status:x}"))
    }
}

#[derive(Debug)]
struct FixedTime(u64);
impl TimeProvider for FixedTime {
    fn current_time(&self) -> Option<UnixTime> {
        Some(UnixTime::since_unix_epoch(Duration::from_secs(self.0)))
    }
}

#[derive(Default)]
struct Metrics {
    tls_commits: u64,
    tls_partial_commits: u64,
    tls_ciphertext_out: u64,
    tls_ciphertext_in: u64,
    requests: u64,
    malformed: u64,
    fuel_events: u64,
    fuel_last: u64,
    fuel_max: u64,
    fuel_total: u128,
    app_fuel_events: u64,
    app_fuel_last: u64,
    app_fuel_max: u64,
    app_fuel_total: u128,
    operations: [OperationMetric; GuestOperation::COUNT],
    operation_sample_every: u64,
    event_sequence: u64,
    operation_profile_active: bool,
    host_transport_operations: u64,
    host_transport_waits: u64,
    host_transport_claimed: u64,
    host_transport_read_operations: u64,
    host_transport_write_operations: u64,
    host_transport_read_bytes: u64,
    host_transport_write_bytes: u64,
    host_transport_partial_writes: u64,
    host_transport_eof_transfers: u64,
    host_transport_pending_issued: u64,
    host_transport_pending_peak: u64,
    host_transport_cancellations: u64,
    host_transport_timeouts: u64,
    host_transport_backpressure_rejections: u64,
    host_transport_owner_wake_cycles: u64,
    host_transport_owner_threads_started: u64,
    host_transport_reactor_poll_calls: u64,
    host_transport_reactor_readiness_events: u64,
}

#[derive(Clone, Copy, Debug)]
#[repr(usize)]
enum GuestOperation {
    TlsState = 0,
    TlsIngest = 1,
    TlsRead = 2,
    TlsWrite = 3,
    TlsOutput = 4,
    TlsCommitOutput = 5,
    HttpFrameLength = 6,
    HttpParseRequest = 7,
    HttpSerializeResponse = 8,
    JsonCompact = 9,
    Router = 10,
    Compression = 11,
}

impl GuestOperation {
    const COUNT: usize = 12;
    const ALL: [Self; Self::COUNT] = [
        Self::TlsState,
        Self::TlsIngest,
        Self::TlsRead,
        Self::TlsWrite,
        Self::TlsOutput,
        Self::TlsCommitOutput,
        Self::HttpFrameLength,
        Self::HttpParseRequest,
        Self::HttpSerializeResponse,
        Self::JsonCompact,
        Self::Router,
        Self::Compression,
    ];

    const fn name(self) -> &'static str {
        match self {
            Self::TlsState => "tls.state",
            Self::TlsIngest => "tls.ingest",
            Self::TlsRead => "tls.read",
            Self::TlsWrite => "tls.write",
            Self::TlsOutput => "tls.output",
            Self::TlsCommitOutput => "tls.commit-output",
            Self::HttpFrameLength => "http.frame-length",
            Self::HttpParseRequest => "http.parse-request",
            Self::HttpSerializeResponse => "http.serialize-response",
            Self::JsonCompact => "json.compact",
            Self::Router => "router.route",
            Self::Compression => "compression.gzip",
        }
    }

    const fn component(self) -> &'static str {
        match self {
            Self::TlsState
            | Self::TlsIngest
            | Self::TlsRead
            | Self::TlsWrite
            | Self::TlsOutput
            | Self::TlsCommitOutput => "tls",
            Self::HttpFrameLength | Self::HttpParseRequest | Self::HttpSerializeResponse => "http",
            Self::JsonCompact => "json",
            Self::Router => "router",
            Self::Compression => "compression",
        }
    }
}

#[derive(Clone, Copy, Debug, Default)]
struct OperationMetric {
    sampled_calls: u64,
    sampled_errors: u64,
    fuel_total: u128,
    fuel_max: u64,
    fuel_histogram: [u64; 32],
    wall_ns_total: u128,
    wall_ns_max: u64,
    wall_ns_histogram: [u64; 32],
}

impl Metrics {
    fn with_operation_sampling(operation_sample_every: u64) -> Self {
        Self {
            operation_sample_every,
            ..Self::default()
        }
    }

    fn start_event_profile(&mut self) {
        self.operation_profile_active = self.operation_sample_every != 0
            && self.event_sequence % self.operation_sample_every == 0;
    }

    fn finish_event_profile(&mut self) {
        self.event_sequence = self.event_sequence.saturating_add(1);
        self.operation_profile_active = false;
    }

    fn record_event_fuel(&mut self, consumed: u64) {
        self.fuel_events = self.fuel_events.saturating_add(1);
        self.fuel_last = consumed;
        self.fuel_max = self.fuel_max.max(consumed);
        self.fuel_total = self.fuel_total.saturating_add(consumed as u128);
    }

    fn record_app_fuel(&mut self, consumed: u64) {
        self.app_fuel_events = self.app_fuel_events.saturating_add(1);
        self.app_fuel_last = consumed;
        self.app_fuel_max = self.app_fuel_max.max(consumed);
        self.app_fuel_total = self.app_fuel_total.saturating_add(consumed as u128);
    }

    fn record_host_transport(&mut self, metrics: host_transport::HostTransportMetrics) {
        self.host_transport_operations = self
            .host_transport_operations
            .saturating_add(metrics.operations_issued);
        self.host_transport_waits = self.host_transport_waits.saturating_add(metrics.waits);
        self.host_transport_claimed = self
            .host_transport_claimed
            .saturating_add(metrics.results_claimed);
        self.host_transport_read_operations = self
            .host_transport_read_operations
            .saturating_add(metrics.read_operations);
        self.host_transport_write_operations = self
            .host_transport_write_operations
            .saturating_add(metrics.write_operations);
        self.host_transport_read_bytes = self
            .host_transport_read_bytes
            .saturating_add(metrics.read_bytes);
        self.host_transport_write_bytes = self
            .host_transport_write_bytes
            .saturating_add(metrics.write_bytes);
        self.host_transport_partial_writes = self
            .host_transport_partial_writes
            .saturating_add(metrics.partial_writes);
        self.host_transport_eof_transfers = self
            .host_transport_eof_transfers
            .saturating_add(metrics.eof_transfers);
        self.host_transport_pending_issued = self
            .host_transport_pending_issued
            .saturating_add(metrics.pending_issued);
        self.host_transport_pending_peak =
            self.host_transport_pending_peak.max(metrics.pending_peak);
        self.host_transport_cancellations = self
            .host_transport_cancellations
            .saturating_add(metrics.cancellations);
        self.host_transport_timeouts = self
            .host_transport_timeouts
            .saturating_add(metrics.timeouts);
        self.host_transport_backpressure_rejections = self
            .host_transport_backpressure_rejections
            .saturating_add(metrics.backpressure_rejections);
        self.host_transport_owner_wake_cycles = self
            .host_transport_owner_wake_cycles
            .saturating_add(metrics.owner_wake_cycles);
        self.host_transport_owner_threads_started = self
            .host_transport_owner_threads_started
            .saturating_add(metrics.owner_threads_started);
        self.host_transport_reactor_poll_calls = self
            .host_transport_reactor_poll_calls
            .saturating_add(metrics.reactor_poll_calls);
        self.host_transport_reactor_readiness_events = self
            .host_transport_reactor_readiness_events
            .saturating_add(metrics.reactor_readiness_events);
    }

    fn record_operation(
        &mut self,
        operation: GuestOperation,
        fuel: Option<u64>,
        wall_ns: Option<u64>,
        failed: bool,
    ) {
        let metric = &mut self.operations[operation as usize];
        metric.sampled_calls = metric.sampled_calls.saturating_add(1);
        metric.sampled_errors = metric.sampled_errors.saturating_add(u64::from(failed));
        if let Some(fuel) = fuel {
            metric.fuel_total = metric.fuel_total.saturating_add(fuel as u128);
            metric.fuel_max = metric.fuel_max.max(fuel);
            metric.fuel_histogram[log2_bucket(fuel)] =
                metric.fuel_histogram[log2_bucket(fuel)].saturating_add(1);
        }
        if let Some(wall_ns) = wall_ns {
            metric.wall_ns_total = metric.wall_ns_total.saturating_add(wall_ns as u128);
            metric.wall_ns_max = metric.wall_ns_max.max(wall_ns);
            metric.wall_ns_histogram[log2_bucket(wall_ns)] =
                metric.wall_ns_histogram[log2_bucket(wall_ns)].saturating_add(1);
        }
    }

    fn operation_json(&self) -> String {
        let rows = GuestOperation::ALL
            .iter()
            .map(|operation| {
                let metric = &self.operations[*operation as usize];
                let fuel_mean = if metric.sampled_calls == 0 {
                    0
                } else {
                    metric.fuel_total / metric.sampled_calls as u128
                };
                let wall_mean = if metric.sampled_calls == 0 {
                    0
                } else {
                    metric.wall_ns_total / metric.sampled_calls as u128
                };
                let fuel_p50 = histogram_percentile(&metric.fuel_histogram, 50);
                let fuel_p95 = histogram_percentile(&metric.fuel_histogram, 95);
                let fuel_p99 = histogram_percentile(&metric.fuel_histogram, 99);
                let wall_p50 = histogram_percentile(&metric.wall_ns_histogram, 50);
                let wall_p95 = histogram_percentile(&metric.wall_ns_histogram, 95);
                let wall_p99 = histogram_percentile(&metric.wall_ns_histogram, 99);
                format!(
                    "{{\"component\":\"{}\",\"operation\":\"{}\",\"sampled_calls\":{},\"sampled_errors\":{},\"fuel_sample_sum\":\"{}\",\"fuel_sample_sum_scientific\":\"{}\",\"fuel_sample_mean\":\"{}\",\"fuel_sample_max\":{},\"fuel_p50_upper\":{},\"fuel_p95_upper\":{},\"fuel_p99_upper\":{},\"wall_ns_sample_sum\":\"{}\",\"wall_ns_sample_mean\":\"{}\",\"wall_ns_sample_max\":{},\"wall_ns_p50_upper\":{},\"wall_ns_p95_upper\":{},\"wall_ns_p99_upper\":{}}}",
                    operation.component(),
                    operation.name(),
                    metric.sampled_calls,
                    metric.sampled_errors,
                    metric.fuel_total,
                    scientific_u128(metric.fuel_total),
                    fuel_mean,
                    metric.fuel_max,
                    fuel_p50,
                    fuel_p95,
                    fuel_p99,
                    metric.wall_ns_total,
                    wall_mean,
                    metric.wall_ns_max,
                    wall_p50,
                    wall_p95,
                    wall_p99,
                )
            })
            .collect::<Vec<_>>();
        format!("[{}]", rows.join(","))
    }
}

fn log2_bucket(value: u64) -> usize {
    if value == 0 {
        0
    } else {
        (63usize.saturating_sub(value.leading_zeros() as usize)).min(31)
    }
}

fn histogram_percentile(histogram: &[u64; 32], percentile: u64) -> u64 {
    let total = histogram.iter().copied().sum::<u64>();
    if total == 0 {
        return 0;
    }
    let target = total.saturating_mul(percentile).saturating_add(99) / 100;
    let mut seen = 0u64;
    for (bucket, count) in histogram.iter().copied().enumerate() {
        seen = seen.saturating_add(count);
        if seen >= target {
            return if bucket >= 31 {
                u32::MAX as u64
            } else {
                (1u64 << (bucket + 1)).saturating_sub(1)
            };
        }
    }
    u32::MAX as u64
}

macro_rules! profiled_guest_call {
    ($runtime:expr, $operation:expr, $call:expr) => {{
        if $runtime.metrics.operation_profile_active {
            let __fuel_before = $runtime.store.get_fuel().ok();
            let __started = Instant::now();
            let __result = $call;
            let __wall_ns = __started.elapsed().as_nanos().min(u64::MAX as u128) as u64;
            let __fuel_after = $runtime.store.get_fuel().ok();
            let __fuel = match (__fuel_before, __fuel_after) {
                (Some(before), Some(after)) => Some(before.saturating_sub(after)),
                _ => None,
            };
            let __failed = __result.is_err();
            $runtime
                .metrics
                .record_operation($operation, __fuel, Some(__wall_ns), __failed);
            __result
        } else {
            $call
        }
    }};
}

fn scientific_u128(value: u128) -> String {
    let digits = value.to_string();
    if digits.len() == 1 {
        return format!("{}.000e0", digits);
    }
    let exponent = digits.len() - 1;
    let mut fraction = digits[1..].chars().take(3).collect::<String>();
    while fraction.len() < 3 {
        fraction.push('0');
    }
    format!("{}.{}e{}", &digits[..1], fraction, exponent)
}

struct ServerRuntime {
    store: Store<Host>,
    tls: CoreTlsLib,
    http: CoreHttpLib,
    json: CoreBytesResultLib,
    compression: CoreBytesResultLib,
    route: TypedFunc<(i32, i32, i32, i32), (i32, i32, i32)>,
    cert: Vec<u8>,
    key: Vec<u8>,
    metrics: Metrics,
    benchmark_request_count_modulo: Option<u32>,
    benchmark_native_http: bool,
}

fn header<'a>(headers: &'a [Header], name: &str) -> Option<&'a [u8]> {
    headers
        .iter()
        .find(|h| h.name.eq_ignore_ascii_case(name))
        .map(|h| h.value.as_slice())
}
fn method_code(method: &str) -> i32 {
    match method {
        "GET" => 0,
        "POST" => 1,
        "PUT" => 2,
        "PATCH" => 3,
        "DELETE" => 4,
        _ => 5,
    }
}
fn path_code(target: &str) -> i32 {
    match target.split('?').next().unwrap_or(target) {
        "/" => 0,
        "/health" => 1,
        "/items" => 2,
        "/admin" => 3,
        "/redirect" => 4,
        "/teapot" => 5,
        _ => 6,
    }
}
fn content_type_json(headers: &[Header]) -> bool {
    header(headers, "content-type").is_some_and(|v| v.starts_with(b"application/json"))
}
fn accepts_gzip(headers: &[Header]) -> bool {
    header(headers, "accept-encoding").is_some_and(|v| {
        v.split(|b| *b == b',').any(|x| {
            x.iter()
                .copied()
                .filter(|b| !b.is_ascii_whitespace())
                .eq(b"gzip".iter().copied())
        })
    })
}

impl ServerRuntime {
    fn new(
        tls_path: &str,
        http_path: &str,
        json_path: &str,
        compression_path: &str,
        policy_path: &str,
        cert: Vec<u8>,
        key: Vec<u8>,
    ) -> Result<Self, Box<dyn Error>> {
        let mut cfg = Config::new();
        cfg.consume_fuel(true);
        let engine = Engine::new(&cfg)?;
        let mut store = Store::new(
            &engine,
            Host {
                seed: 0x1234_5678_9abc_def0,
                ..Host::default()
            },
        );
        // Fuel is observe-only by default. Resetting to u64::MAX gives every
        // admitted execution event an effectively unbounded metering window
        // while still allowing exact per-event consumption accounting.
        store.set_fuel(OBSERVE_ONLY_EVENT_FUEL)?;

        let tls = CoreTlsLib::instantiate(&engine, &mut store, tls_path)?;

        let http = CoreHttpLib::instantiate(&engine, &mut store, http_path)?;
        let json = CoreBytesResultLib::instantiate(&engine, &mut store, json_path)?;
        let compression = CoreBytesResultLib::instantiate(&engine, &mut store, compression_path)?;

        let module = Module::from_file(&engine, policy_path)?;
        let instance = Instance::new(&mut store, &module, &[])?;
        let route = instance
            .get_typed_func::<(i32, i32, i32, i32), (i32, i32, i32)>(&mut store, "route")?;
        let operation_sample_every = std::env::var("WASMC_PROFILE_OPERATION_SAMPLE_EVERY")
            .ok()
            .map(|value| value.parse::<u64>())
            .transpose()?
            .unwrap_or(1024);
        let benchmark_request_count_modulo =
            std::env::var("WASMC_HTTPS_BENCH_REQUEST_COUNT_MODULO")
                .ok()
                .map(|value| value.parse::<u32>())
                .transpose()?;
        if benchmark_request_count_modulo == Some(0) {
            return Err("WASMC_HTTPS_BENCH_REQUEST_COUNT_MODULO must be positive".into());
        }
        let benchmark_native_http = std::env::var_os("WASMC_HTTPS_BENCH_NATIVE_HTTP").is_some();

        Ok(Self {
            store,
            tls,
            http,
            json,
            compression,
            route,
            cert,
            key,
            metrics: Metrics::with_operation_sampling(operation_sample_every),
            benchmark_request_count_modulo,
            benchmark_native_http,
        })
    }

    fn build_response(
        &mut self,
        minor: u8,
        status: u16,
        plain: &[u8],
        gzip_requested: bool,
    ) -> Result<Vec<u8>, Box<dyn Error>> {
        let mut body = plain.to_vec();
        let mut headers = Vec::new();
        if !body.is_empty() {
            headers.push(Header {
                name: "content-type".into(),
                value: b"application/json".to_vec(),
            });
        }
        if gzip_requested && body.len() >= GZIP_THRESHOLD {
            body = profiled_guest_call!(
                self,
                GuestOperation::Compression,
                self.compression.call_bytes_result(
                    &mut self.store,
                    "wasmc:compression/gzip@0.0.1#compress",
                    "cabi_post_wasmc:compression/gzip@0.0.1#compress",
                    &body,
                )
            )?
            .map_err(|e| format!("gzip error lane {e}"))?;
            headers.push(Header {
                name: "content-encoding".into(),
                value: b"gzip".to_vec(),
            });
        }
        headers.push(Header {
            name: "content-length".into(),
            value: body.len().to_string().into_bytes(),
        });
        let mut out = profiled_guest_call!(
            self,
            GuestOperation::HttpSerializeResponse,
            self.http
                .serialize_response_head(&mut self.store, minor, status, &headers)
        )?
        .map_err(|e| format!("serialize {e:?}"))?;
        out.extend_from_slice(&body);
        Ok(out)
    }

    fn build_bad_request_close(&mut self) -> Result<Vec<u8>, Box<dyn Error>> {
        let body = b"{\"error\":\"bad-request\"}";
        let headers = vec![
            Header {
                name: "content-type".into(),
                value: b"application/json".to_vec(),
            },
            Header {
                name: "content-length".into(),
                value: body.len().to_string().into_bytes(),
            },
            Header {
                name: "connection".into(),
                value: b"close".to_vec(),
            },
        ];
        let mut out = profiled_guest_call!(
            self,
            GuestOperation::HttpSerializeResponse,
            self.http
                .serialize_response_head(&mut self.store, 1, 400, &headers)
        )?
        .map_err(|e| format!("serialize bad request {e:?}"))?;
        out.extend_from_slice(body);
        Ok(out)
    }

    fn app_response(&mut self, raw: &[u8], request_count: u32) -> Result<Vec<u8>, Box<dyn Error>> {
        let app_fuel_before = self.store.get_fuel()?;
        let req = profiled_guest_call!(
            self,
            GuestOperation::HttpParseRequest,
            self.http.parse_request(&mut self.store, raw)
        )?
        .map_err(|e| format!("parse {e:?}"))?;
        let body = &raw[req.body_offset as usize..];
        let mut body_class = if body.is_empty() { 0 } else { 2 };
        let mut normalized = None;
        if !body.is_empty() && content_type_json(&req.headers) {
            match profiled_guest_call!(
                self,
                GuestOperation::JsonCompact,
                self.json.call_bytes_result(
                    &mut self.store,
                    "wasmc:json/document@0.0.1#compact",
                    "cabi_post_wasmc:json/document@0.0.1#compact",
                    std::str::from_utf8(body)?.as_bytes(),
                )
            )? {
                Ok(c) => {
                    normalized = Some(String::from_utf8(c)?);
                    body_class = 1;
                }
                Err(_) => {
                    let response = self.build_response(
                        req.minor_version,
                        400,
                        b"{\"error\":\"invalid-json\"}",
                        false,
                    );
                    let remaining = self.store.get_fuel()?;
                    self.metrics
                        .record_app_fuel(app_fuel_before.saturating_sub(remaining));
                    return response;
                }
            }
        }
        let (status, action, target) = profiled_guest_call!(
            self,
            GuestOperation::Router,
            self.route.call(
                &mut self.store,
                (
                    method_code(&req.method),
                    path_code(&req.target),
                    body_class,
                    request_count as i32,
                ),
            )
        )?;
        if !(0..=2).contains(&action) || !(0..=4).contains(&target) {
            return Err("invalid router lanes".into());
        }
        let response_json = match status {
            200 => "{\"ok\":true,\"service\":\"wasmc\"}".to_string(),
            201 => format!(
                "{{\"created\":true,\"request\":{}}}",
                normalized.unwrap_or_else(|| "null".into())
            ),
            204 => String::new(),
            301 => "{\"redirect\":true}".into(),
            403 => "{\"error\":\"forbidden\"}".into(),
            418 => "{\"teapot\":true}".into(),
            429 => "{\"error\":\"rate-limited\"}".into(),
            _ => "{\"error\":\"not-found\"}".into(),
        };
        let body = if response_json.is_empty() {
            Vec::new()
        } else {
            profiled_guest_call!(
                self,
                GuestOperation::JsonCompact,
                self.json.call_bytes_result(
                    &mut self.store,
                    "wasmc:json/document@0.0.1#compact",
                    "cabi_post_wasmc:json/document@0.0.1#compact",
                    response_json.as_bytes(),
                )
            )?
            .map_err(|e| format!("response json error lane {e}"))?
        };
        let response = self.build_response(
            req.minor_version,
            status as u16,
            &body,
            accepts_gzip(&req.headers),
        );
        let remaining = self.store.get_fuel()?;
        self.metrics
            .record_app_fuel(app_fuel_before.saturating_sub(remaining));
        response
    }

    fn flush_tls(
        &mut self,
        transport: &mut HostEndpoint,
        owned: i32,
    ) -> Result<(), Box<dyn Error>> {
        loop {
            let before = profiled_guest_call!(
                self,
                GuestOperation::TlsState,
                self.tls.state(&mut self.store, owned)
            )?;
            let chunk = profiled_guest_call!(
                self,
                GuestOperation::TlsOutput,
                self.tls.output(&mut self.store, owned, TLS_IO_LIMIT)
            )?;
            if chunk.is_empty() {
                break;
            }
            let mut window = HostWindow::acquire(chunk.len() as u32)?;
            window.commit(&chunk, chunk.len() as u32)?;
            let mut operation = transport.write(&window)?;
            let ready = transport.wait(&[&operation])?;
            if ready.as_slice() != [0] {
                return Err("Host write operation did not become selection index 0".into());
            }
            let transferred = match transport.take_result(&mut operation)? {
                Terminal::Transfer(transfer) if !transfer.eof && transfer.transferred > 0 => {
                    transfer.transferred
                }
                other => return Err(format!("unexpected Host write terminal {other:?}").into()),
            };
            self.metrics.tls_ciphertext_out += transferred as u64;
            self.metrics.tls_commits += 1;
            if before.pending_output > transferred || (transferred as usize) < chunk.len() {
                self.metrics.tls_partial_commits += 1;
            }
            profiled_guest_call!(
                self,
                GuestOperation::TlsCommitOutput,
                self.tls.commit_output(&mut self.store, owned, transferred)
            )?;
        }
        Ok(())
    }

    fn process_native_http_frames(
        &mut self,
        plain: &mut Vec<u8>,
        owned: i32,
        transport: &mut HostEndpoint,
        request_count: &mut u32,
    ) -> Result<bool, Box<dyn Error>> {
        let mut progressed = false;
        loop {
            let mut headers = [httparse::EMPTY_HEADER; 32];
            let mut request = httparse::Request::new(&mut headers);
            let head = match request
                .parse(plain)
                .map_err(|error| format!("native benchmark HTTP parse {error:?}"))?
            {
                httparse::Status::Complete(head) => head,
                httparse::Status::Partial => break,
            };
            let content_length = request
                .headers
                .iter()
                .find(|header| header.name.eq_ignore_ascii_case("content-length"))
                .map(|header| {
                    std::str::from_utf8(header.value)
                        .map_err(|error| error.to_string())?
                        .parse::<usize>()
                        .map_err(|error| error.to_string())
                })
                .transpose()
                .map_err(|error| format!("native benchmark content-length {error}"))?
                .unwrap_or(0);
            let frame_length = head
                .checked_add(content_length)
                .ok_or("native benchmark HTTP frame overflow")?;
            if plain.len() < frame_length {
                break;
            }
            plain.drain(..frame_length);
            *request_count = request_count.saturating_add(1);
            self.metrics.requests = self.metrics.requests.saturating_add(1);
            profiled_guest_call!(
                self,
                GuestOperation::TlsWrite,
                self.tls.write(
                    &mut self.store,
                    owned,
                    b"HTTP/1.1 204 No Content\r\ncontent-length: 0\r\n\r\n"
                )
            )?;
            self.flush_tls(transport, owned)?;
            progressed = true;
        }
        Ok(progressed)
    }

    fn close_tls(
        &mut self,
        transport: &mut HostEndpoint,
        owned: i32,
    ) -> Result<(), Box<dyn Error>> {
        self.tls.close(&mut self.store, owned)?;
        self.flush_tls(transport, owned)?;
        Ok(())
    }

    fn transport_read(
        transport: &mut HostEndpoint,
        capacity: u32,
    ) -> Result<(host_transport::Transfer, Vec<u8>), HostTransportError> {
        let mut window = HostWindow::acquire(capacity)?;
        let mut operation = transport.read(&mut window, capacity)?;
        let ready = transport.wait(&[&operation])?;
        if ready.as_slice() != [0] {
            return Err(HostTransportError::Busy);
        }
        let transfer = match transport.take_result(&mut operation)? {
            Terminal::Transfer(transfer) => transfer,
            _ => return Err(HostTransportError::InvalidResource),
        };
        Ok((transfer, window.copy_out()))
    }

    fn serve_tls_connection(&mut self, stream: TcpStream) -> Result<(), Box<dyn Error>> {
        let max_write_chunk = std::env::var("WASMC_HOST_TRANSPORT_MAX_WRITE")
            .ok()
            .map(|value| value.parse::<usize>())
            .transpose()?
            .unwrap_or(usize::MAX);
        let transport = HostEndpoint::from_accepted_tcp_with_write_limit(
            stream,
            Duration::from_secs(5),
            Duration::from_secs(5),
            max_write_chunk,
        )?;
        self.serve_tls_transport(transport)
    }

    fn serve_tls_host_endpoint(&mut self, transport: HostEndpoint) -> Result<(), Box<dyn Error>> {
        self.serve_tls_transport(transport)
    }

    fn serve_tls_transport(&mut self, mut transport: HostEndpoint) -> Result<(), Box<dyn Error>> {
        self.store.set_fuel(OBSERVE_ONLY_EVENT_FUEL)?;
        let chain = vec![self.cert.clone()];
        let owned = self
            .tls
            .create(&mut self.store, &chain, &self.key, 1_700_000_000)?;
        let mut request_count = 0u32;
        let result = (|| -> Result<(), Box<dyn Error>> {
            while profiled_guest_call!(
                self,
                GuestOperation::TlsState,
                self.tls.state(&mut self.store, owned)
            )?
            .state
                != ConnectionState::Ready
            {
                self.flush_tls(&mut transport, owned)?;
                if profiled_guest_call!(
                    self,
                    GuestOperation::TlsState,
                    self.tls.state(&mut self.store, owned)
                )?
                .state
                    == ConnectionState::Ready
                {
                    break;
                }
                let (transfer, cipher) = Self::transport_read(&mut transport, 4096)?;
                if transfer.eof {
                    return Err("eof during handshake".into());
                }
                let n = transfer.transferred as usize;
                self.metrics.tls_ciphertext_in += n as u64;
                profiled_guest_call!(
                    self,
                    GuestOperation::TlsIngest,
                    self.tls.ingest(&mut self.store, owned, &cipher[..n])
                )?;
            }
            self.flush_tls(&mut transport, owned)?;

            self.metrics.start_event_profile();
            let mut plain = Vec::<u8>::new();
            loop {
                // Drain all plaintext already decrypted by TLS.
                loop {
                    let bytes = profiled_guest_call!(
                        self,
                        GuestOperation::TlsRead,
                        self.tls.read(&mut self.store, owned, PLAIN_LIMIT)
                    )?;
                    if bytes.is_empty() {
                        break;
                    }
                    plain.extend_from_slice(&bytes);
                }
                if self.benchmark_native_http {
                    self.process_native_http_frames(
                        &mut plain,
                        owned,
                        &mut transport,
                        &mut request_count,
                    )?;
                } else {
                    loop {
                        let frame = profiled_guest_call!(
                            self,
                            GuestOperation::HttpFrameLength,
                            self.http.request_frame_length(&mut self.store, &plain)
                        )?;
                        match frame {
                            Ok(Some(n)) => {
                                let event_fuel_before = self.store.get_fuel()?;
                                let n = n as usize;
                                let raw = plain[..n].to_vec();
                                plain.drain(..n);
                                let policy_request_count = self
                                    .benchmark_request_count_modulo
                                    .map(|modulo| request_count % modulo)
                                    .unwrap_or(request_count);
                                match self.app_response(&raw, policy_request_count) {
                                    Ok(response) => {
                                        request_count += 1;
                                        self.metrics.requests += 1;
                                        profiled_guest_call!(
                                            self,
                                            GuestOperation::TlsWrite,
                                            self.tls.write(&mut self.store, owned, &response)
                                        )?;
                                        self.flush_tls(&mut transport, owned)?;
                                        let event_fuel_after = self.store.get_fuel()?;
                                        self.metrics.record_event_fuel(
                                            event_fuel_before.saturating_sub(event_fuel_after),
                                        );
                                        self.store.set_fuel(OBSERVE_ONLY_EVENT_FUEL)?;
                                        self.metrics.finish_event_profile();
                                        self.metrics.start_event_profile();
                                    }
                                    Err(_) => {
                                        self.metrics.malformed += 1;
                                        let response = self.build_bad_request_close()?;
                                        profiled_guest_call!(
                                            self,
                                            GuestOperation::TlsWrite,
                                            self.tls.write(&mut self.store, owned, &response)
                                        )?;
                                        self.flush_tls(&mut transport, owned)?;
                                        self.close_tls(&mut transport, owned)?;
                                        return Ok(());
                                    }
                                }
                            }
                            Ok(None) => break,
                            Err(3) => break,
                            Err(_) => {
                                self.metrics.malformed += 1;
                                let response = self.build_bad_request_close()?;
                                profiled_guest_call!(
                                    self,
                                    GuestOperation::TlsWrite,
                                    self.tls.write(&mut self.store, owned, &response)
                                )?;
                                self.flush_tls(&mut transport, owned)?;
                                self.close_tls(&mut transport, owned)?;
                                return Ok(());
                            }
                        }
                    }
                }
                let (transfer, cipher) = match Self::transport_read(&mut transport, 4096) {
                    Ok(result) => result,
                    Err(HostTransportError::Timeout) => {
                        self.close_tls(&mut transport, owned)?;
                        return Ok(());
                    }
                    Err(error) => return Err(error.into()),
                };
                if transfer.eof {
                    return Err("tcp eof without tls close_notify".into());
                }
                let n = transfer.transferred as usize;
                self.metrics.tls_ciphertext_in += n as u64;
                profiled_guest_call!(
                    self,
                    GuestOperation::TlsIngest,
                    self.tls.ingest(&mut self.store, owned, &cipher[..n])
                )?;
                self.flush_tls(&mut transport, owned)?;
                let state = self.tls.state(&mut self.store, owned)?;
                if state.state == ConnectionState::PeerClosed {
                    self.close_tls(&mut transport, owned)?;
                    return Ok(());
                }
            }
        })();
        let transport_metrics = transport.metrics();
        self.metrics.record_host_transport(transport_metrics);
        eprintln!(
            "host-transport operations={} waits={} claimed={} reads={} read-bytes={} writes={} write-bytes={} partial-writes={} eof-transfers={}",
            transport_metrics.operations_issued,
            transport_metrics.waits,
            transport_metrics.results_claimed,
            transport_metrics.read_operations,
            transport_metrics.read_bytes,
            transport_metrics.write_operations,
            transport_metrics.write_bytes,
            transport_metrics.partial_writes,
            transport_metrics.eof_transfers,
        );
        if let Err(error) = &result {
            eprintln!("tls-connection-result-before-drop error={error:#}");
        } else {
            eprintln!("tls-connection-result-before-drop ok requests={request_count}");
        }
        let mut cleanup_error: Option<Box<dyn Error>> = None;
        match profiled_guest_call!(
            self,
            GuestOperation::TlsState,
            self.tls.state(&mut self.store, owned)
        ) {
            Ok(final_state) => {
                eprintln!("tls-resource-drop-before state={final_state:?} requests={request_count}")
            }
            Err(error) => {
                eprintln!("tls-final-state-err requests={request_count} error={error:#}");
                cleanup_error = Some(error.into());
            }
        }
        match self.tls.drop(&mut self.store, owned) {
            Ok(()) => eprintln!("tls-resource-drop-ok requests={request_count}"),
            Err(error) => {
                eprintln!("tls-resource-drop-err requests={request_count} error={error:#}");
                if cleanup_error.is_none() {
                    cleanup_error = Some(error.into());
                }
            }
        }
        match transport.close_backend() {
            Ok(()) => eprintln!("host-transport-close-ack requests={request_count}"),
            Err(error) => {
                eprintln!("host-transport-close-err requests={request_count} error={error:#}");
                if cleanup_error.is_none() {
                    cleanup_error = Some(error.into());
                }
            }
        }
        match result {
            Err(error) => Err(error),
            Ok(()) => match cleanup_error {
                Some(error) => Err(error),
                None => Ok(()),
            },
        }
    }
}

fn client_config(cert: &[u8]) -> Result<Arc<ClientConfig>, Box<dyn Error>> {
    let mut roots = RootCertStore::empty();
    roots
        .add(CertificateDer::from(cert.to_vec()))
        .map_err(|e| format!("root {e:?}"))?;
    let provider = Arc::new(rustls_rustcrypto::provider());
    let cfg = ClientConfig::builder_with_details(provider, Arc::new(FixedTime(1_700_000_000)))
        .with_safe_default_protocol_versions()
        .map_err(|e| format!("versions {e:?}"))?
        .with_root_certificates(roots)
        .with_no_client_auth();
    Ok(Arc::new(cfg))
}

fn connect_https(
    addr: std::net::SocketAddr,
    cfg: Arc<ClientConfig>,
) -> Result<StreamOwned<ClientConnection, TcpStream>, Box<dyn Error>> {
    let tcp = TcpStream::connect(addr)?;
    tcp.set_read_timeout(Some(Duration::from_secs(5)))?;
    tcp.set_write_timeout(Some(Duration::from_secs(5)))?;
    let conn = ClientConnection::new(cfg, ServerName::try_from("example.com")?)?;
    Ok(StreamOwned::new(conn, tcp))
}

fn client_graceful_close(
    stream: &mut StreamOwned<ClientConnection, TcpStream>,
) -> Result<(), Box<dyn Error>> {
    stream.conn.send_close_notify();
    stream.flush()?;
    let mut probe = [0u8; 1];
    if stream.read(&mut probe)? != 0 {
        return Err("unexpected application bytes during tls close".into());
    }
    Ok(())
}

fn client_expect_server_close(
    stream: &mut StreamOwned<ClientConnection, TcpStream>,
) -> Result<(), Box<dyn Error>> {
    let mut probe = [0u8; 1];
    if stream.read(&mut probe)? != 0 {
        return Err("unexpected application bytes during server tls close".into());
    }
    Ok(())
}

fn read_http_response<S: Read>(
    stream: &mut S,
) -> Result<(u16, Vec<(String, Vec<u8>)>, Vec<u8>), Box<dyn Error>> {
    let mut buf = Vec::new();
    let mut temp = [0u8; 4096];
    loop {
        let mut hs = [httparse::EMPTY_HEADER; 32];
        let mut r = httparse::Response::new(&mut hs);
        match r.parse(&buf).map_err(|e| format!("response parse {e:?}"))? {
            httparse::Status::Complete(head) => {
                let len = r
                    .headers
                    .iter()
                    .find(|h| h.name.eq_ignore_ascii_case("content-length"))
                    .map(|h| {
                        std::str::from_utf8(h.value)
                            .unwrap()
                            .parse::<usize>()
                            .unwrap()
                    })
                    .unwrap_or(0);
                if buf.len() >= head + len {
                    let status = r.code.ok_or("response status")?;
                    let headers = r
                        .headers
                        .iter()
                        .map(|h| (h.name.to_ascii_lowercase(), h.value.to_vec()))
                        .collect();
                    return Ok((status, headers, buf[head..head + len].to_vec()));
                }
            }
            httparse::Status::Partial => {}
        }
        let n = stream.read(&mut temp)?;
        if n == 0 {
            return Err("response eof".into());
        }
        buf.extend_from_slice(&temp[..n]);
    }
}

fn expected_benchmark_disconnect(error: &str) -> bool {
    let lower = error.to_ascii_lowercase();
    lower.contains("tcp eof without tls close_notify")
        || lower.contains("connection reset")
        || lower.contains("broken pipe")
        || lower.contains("connection aborted")
}

fn run_external_benchmark_server(
    tls: String,
    http: String,
    json: String,
    compression: String,
    policy: String,
    cert: Vec<u8>,
    key: Vec<u8>,
) -> Result<(), Box<dyn Error>> {
    let connections = std::env::var("WASMC_HTTPS_EXTERNAL_CONNECTIONS")
        .ok()
        .map(|value| value.parse::<usize>())
        .transpose()?
        .unwrap_or(1);
    if connections == 0 || connections > 64 {
        return Err("WASMC_HTTPS_EXTERNAL_CONNECTIONS must be in 1..=64".into());
    }
    let port = std::env::var("WASMC_HTTPS_EXTERNAL_PORT")
        .ok()
        .map(|value| value.parse::<u16>())
        .transpose()?
        .unwrap_or(0);
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    let addr = listener.local_addr()?;
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
    let mut workers = Vec::with_capacity(connections);
    for ordinal in 0..connections {
        let listener = listener.try_clone()?;
        let tls = tls.clone();
        let http = http.clone();
        let json = json.clone();
        let compression = compression.clone();
        let policy = policy.clone();
        let cert = cert.clone();
        let key = key.clone();
        let ready_tx = ready_tx.clone();
        workers.push(thread::spawn(
            move || -> Result<(u64, u64, u64, u64), String> {
                let rt = ServerRuntime::new(&tls, &http, &json, &compression, &policy, cert, key)
                    .map_err(|error| format!("connection {ordinal} runtime: {error:#}"));
                match &rt {
                    Ok(_) => {
                        let _ = ready_tx.send(Ok(()));
                    }
                    Err(error) => {
                        let _ = ready_tx.send(Err(error.clone()));
                    }
                }
                let mut rt = rt?;
                let (stream, _) = listener
                    .accept()
                    .map_err(|error| format!("connection {ordinal} accept: {error}"))?;
                let result = rt.serve_tls_connection(stream);
                if let Err(error) = result {
                    let message = format!("{error:#}");
                    if !expected_benchmark_disconnect(&message) {
                        return Err(format!("connection {ordinal}: {message}"));
                    }
                }
                Ok((
                    rt.metrics.requests,
                    rt.metrics.host_transport_operations,
                    rt.metrics.host_transport_read_bytes,
                    rt.metrics.host_transport_write_bytes,
                ))
            },
        ));
    }
    drop(ready_tx);
    for _ in 0..connections {
        ready_rx
            .recv()
            .map_err(|_| "external benchmark runtime readiness channel closed")?
            .map_err(|error| format!("external benchmark runtime init failed: {error}"))?;
    }
    println!(
        "{{\"schema\":\"wasmc-https-external-server/v1\",\"ready\":true,\"addr\":\"{}\",\"connections\":{},\"runtime_prewarm\":true}}",
        addr, connections
    );
    std::io::stdout().flush()?;
    drop(listener);

    let mut requests = 0u64;
    let mut host_operations = 0u64;
    let mut host_read_bytes = 0u64;
    let mut host_write_bytes = 0u64;
    for worker in workers {
        let (worker_requests, worker_operations, worker_read_bytes, worker_write_bytes) = worker
            .join()
            .map_err(|_| "external benchmark worker panicked")?
            .map_err(|error| format!("external benchmark worker failed: {error}"))?;
        requests = requests.saturating_add(worker_requests);
        host_operations = host_operations.saturating_add(worker_operations);
        host_read_bytes = host_read_bytes.saturating_add(worker_read_bytes);
        host_write_bytes = host_write_bytes.saturating_add(worker_write_bytes);
    }
    println!(
        "{{\"schema\":\"wasmc-https-external-server-result/v1\",\"accepted\":true,\"connections\":{},\"requests\":{},\"host_operations\":{},\"host_read_bytes\":{},\"host_write_bytes\":{}}}",
        connections, requests, host_operations, host_read_bytes, host_write_bytes
    );
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut a = std::env::args().skip(1);
    let tls = a.next().ok_or("tls")?;
    let http = a.next().ok_or("http")?;
    let json = a.next().ok_or("json")?;
    let compression = a.next().ok_or("compression")?;
    let policy = a.next().ok_or("policy")?;
    let cert = std::fs::read(a.next().ok_or("cert")?)?;
    let key = std::fs::read(a.next().ok_or("key")?)?;
    if std::env::var_os("WASMC_HTTPS_EXTERNAL_SERVER").is_some() {
        return run_external_benchmark_server(tls, http, json, compression, policy, cert, key);
    }
    let keepalive_requests = std::env::var("WASMC_HTTPS_KEEPALIVE_REQUESTS")
        .ok()
        .map(|value| value.parse::<usize>())
        .transpose()?
        .unwrap_or(KEEPALIVE_REQUESTS);
    let keepalive_duration = std::env::var("WASMC_HTTPS_KEEPALIVE_DURATION_MS")
        .ok()
        .map(|value| value.parse::<u64>())
        .transpose()?
        .map(Duration::from_millis);
    if keepalive_requests == 0 {
        return Err("WASMC_HTTPS_KEEPALIVE_REQUESTS must be positive".into());
    }
    if keepalive_duration == Some(Duration::ZERO) {
        return Err("WASMC_HTTPS_KEEPALIVE_DURATION_MS must be positive".into());
    }

    let listener = TcpListener::bind("127.0.0.1:0")?;
    let addr = listener.local_addr()?;
    let cert_server = cert.clone();
    let server = thread::spawn(move || -> Result<ServerRuntime, String> {
        let mut rt =
            ServerRuntime::new(&tls, &http, &json, &compression, &policy, cert_server, key)
                .map_err(|e| e.to_string())?;
        for _ in 0..3 {
            let (stream, _) = listener.accept().map_err(|e| e.to_string())?;
            if let Err(e) = rt.serve_tls_connection(stream) {
                eprintln!("server-connection-error={e}");
                return Err(e.to_string());
            }
        }
        Ok(rt)
    });

    let cfg = client_config(&cert)?;
    let started = Instant::now();
    let mut c = connect_https(addr, cfg.clone())?;
    let root = b"GET / HTTP/1.1\r\nHost: example.com\r\nAccept-Encoding: gzip\r\n\r\n";
    let health = b"GET /health HTTP/1.1\r\nHost: example.com\r\n\r\n";
    let post = b"POST /items HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{ \"name\": \"x\" }";
    let mut checksum = 0u64;
    let keepalive_started = Instant::now();
    let mut completed_keepalive_requests = 0usize;
    loop {
        if let Some(duration) = keepalive_duration {
            if completed_keepalive_requests != 0 && keepalive_started.elapsed() >= duration {
                break;
            }
        } else if completed_keepalive_requests >= keepalive_requests {
            break;
        }
        let i = completed_keepalive_requests;
        let req: &[u8] = match i % 3 {
            0 => root,
            1 => health,
            _ => post,
        };
        c.write_all(req)?;
        c.flush()?;
        let (status, headers, body) = read_http_response(&mut c)?;
        let expected = if i >= 100 {
            429
        } else {
            match i % 3 {
                0 => 200,
                1 => 204,
                _ => 201,
            }
        };
        if status != expected {
            return Err(format!("status {status} != {expected}").into());
        }
        if i % 3 == 0 && headers.iter().any(|(k, _)| k == "content-encoding") {
            return Err("small response unexpectedly gzip-compressed".into());
        }
        checksum = checksum
            .wrapping_add(status as u64)
            .wrapping_add(body.len() as u64);
        completed_keepalive_requests += 1;
    }
    client_graceful_close(&mut c)?;
    drop(c);

    // Malformed HTTP inside a valid TLS session must get 400 and close only that connection.
    let mut bad = connect_https(addr, cfg.clone())?;
    bad.write_all(b"GET / HTTP/1.1\r\nContent-Length: 1\r\nContent-Length: 1\r\n\r\na")?;
    bad.flush()?;
    let (bad_status, _, _) = read_http_response(&mut bad)?;
    if bad_status != 400 {
        return Err(format!("malformed status {bad_status}").into());
    }
    client_expect_server_close(&mut bad)?;
    drop(bad);

    // Recovery connection after malformed TLS+HTTP session.
    let mut recovery = connect_https(addr, cfg)?;
    recovery.write_all(b"GET / HTTP/1.1\r\nHost: example.com\r\n\r\n")?;
    recovery.flush()?;
    let (status, _, _) = read_http_response(&mut recovery)?;
    if status != 200 {
        return Err("recovery failed".into());
    }
    client_graceful_close(&mut recovery)?;
    drop(recovery);

    let elapsed = started.elapsed();
    let rt = server
        .join()
        .map_err(|_| "server panic")?
        .map_err(|e| format!("server {e}"))?;
    if rt.metrics.requests != (completed_keepalive_requests as u64 + 1) {
        return Err(format!("requests {}", rt.metrics.requests).into());
    }
    if rt.metrics.malformed != 1 {
        return Err(format!("malformed {}", rt.metrics.malformed).into());
    }
    if std::env::var_os("WASMC_HOST_TRANSPORT_MAX_WRITE").is_some()
        && rt.metrics.tls_partial_commits == 0
    {
        return Err("partial TLS commit not exercised".into());
    }
    println!("{{\"accepted\":true,\"https\":true,\"keep_alive_requests\":{},\"keep_alive_duration_target_ms\":{},\"keep_alive_elapsed_ms\":{},\"recovery_requests\":1,\"malformed_requests\":1,\"elapsed_ns\":{},\"avg_ns_per_valid_request\":{},\"rps\":{},\"tls_commits\":{},\"tls_partial_commits\":{},\"ciphertext_in\":{},\"ciphertext_out\":{},\"entropy_calls\":{},\"gzip_threshold\":{},\"small_gzip_suppressed\":true,\"http_framing_lib\":true,\"wasmc_router\":true,\"json\":true,\"graceful_tls_close\":true,\"fuel_policy\":\"observe-only\",\"fuel_counter_single\":\"u64\",\"fuel_counter_total\":\"u128\",\"fuel_events\":{},\"fuel_last\":{},\"fuel_max\":{},\"fuel_total\":\"{}\",\"fuel_total_scientific\":\"{}\",\"app_fuel_events\":{},\"app_fuel_last\":{},\"app_fuel_max\":{},\"app_fuel_total\":\"{}\",\"app_fuel_total_scientific\":\"{}\",\"operation_profile_sample_every\":{},\"operation_profile\":{},\"host_transport\":\"endpoint-window-operation-wait-take-result\",\"host_operations\":{},\"host_waits\":{},\"host_claimed\":{},\"host_read_operations\":{},\"host_write_operations\":{},\"host_read_bytes\":{},\"host_write_bytes\":{},\"host_partial_writes\":{},\"host_eof_transfers\":{},\"host_pending_issued\":{},\"host_pending_peak\":{},\"host_cancellations\":{},\"host_timeouts\":{},\"host_backpressure_rejections\":{},\"host_owner_wake_cycles\":{},\"host_owner_threads_started\":{},\"host_reactor_poll_calls\":{},\"host_reactor_readiness_events\":{},\"checksum\":{}}}", completed_keepalive_requests, keepalive_duration.map(|v| v.as_millis() as u64).unwrap_or(0), keepalive_started.elapsed().as_millis(), elapsed.as_nanos(), elapsed.as_nanos()/(completed_keepalive_requests as u128+1), ((completed_keepalive_requests as f64+1.0)/elapsed.as_secs_f64()) as u64, rt.metrics.tls_commits, rt.metrics.tls_partial_commits, rt.metrics.tls_ciphertext_in, rt.metrics.tls_ciphertext_out, rt.store.data().entropy_calls, GZIP_THRESHOLD, rt.metrics.fuel_events, rt.metrics.fuel_last, rt.metrics.fuel_max, rt.metrics.fuel_total, scientific_u128(rt.metrics.fuel_total), rt.metrics.app_fuel_events, rt.metrics.app_fuel_last, rt.metrics.app_fuel_max, rt.metrics.app_fuel_total, scientific_u128(rt.metrics.app_fuel_total), rt.metrics.operation_sample_every, rt.metrics.operation_json(), rt.metrics.host_transport_operations, rt.metrics.host_transport_waits, rt.metrics.host_transport_claimed, rt.metrics.host_transport_read_operations, rt.metrics.host_transport_write_operations, rt.metrics.host_transport_read_bytes, rt.metrics.host_transport_write_bytes, rt.metrics.host_transport_partial_writes, rt.metrics.host_transport_eof_transfers, rt.metrics.host_transport_pending_issued, rt.metrics.host_transport_pending_peak, rt.metrics.host_transport_cancellations, rt.metrics.host_transport_timeouts, rt.metrics.host_transport_backpressure_rejections, rt.metrics.host_transport_owner_wake_cycles, rt.metrics.host_transport_owner_threads_started, rt.metrics.host_transport_reactor_poll_calls, rt.metrics.host_transport_reactor_readiness_events, checksum);
    Ok(())
}
