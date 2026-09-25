//! Source-free live consumer: public wasmc-host SDK -> snapshots -> Component.
//! Telemetry implementation is not linked into this caller.
mod resource_snapshot;
wasmtime::component::bindgen!({path: "wit", world: "system-telemetry"});

#[cfg(target_os = "linux")]
mod linux {
    use super::resource_snapshot::{complete, SNAPSHOT_LIMIT};
    use super::{
        exports::wasmc::system_telemetry::monitor::{Profile, Snapshots},
        SystemTelemetry,
    };
    use std::{
        error::Error,
        fs,
        time::{Duration, Instant},
    };
    use wasmc_host::{ResourceHandle, WasmcHost};
    use wasmtime::component::{Component, Linker};
    use wasmtime::{Config, Engine, Store, StoreLimits, StoreLimitsBuilder};

    const GRANTS: [(&str, &str); 4] = [
        ("os.proc.stat", "/proc/stat"),
        ("os.proc.meminfo", "/proc/meminfo"),
        ("os.proc.netdev", "/proc/net/dev"),
        ("os.proc.loadavg", "/proc/loadavg"),
    ];
    struct Resources {
        host: WasmcHost,
        handles: Vec<ResourceHandle>,
    }
    impl Resources {
        fn open() -> Result<Self, Box<dyn Error>> {
            let mut builder = WasmcHost::builder();
            for (selector, path) in GRANTS {
                builder =
                    builder.grant_file_path(selector, path, false, 16_384, SNAPSHOT_LIMIT + 1)?;
            }
            let host = builder.build()?;
            let handles = GRANTS
                .iter()
                .map(|(selector, _)| host.open(selector))
                .collect::<Result<Vec<_>, _>>()?;
            assert_eq!(host.selectors().count(), 4);
            assert!(host.open("/etc/passwd").is_err());
            Ok(Self { host, handles })
        }
        fn close(&mut self) -> Result<(), Box<dyn Error>> {
            // Keep failed handles available for Drop's cleanup attempt.
            while let Some(&id) = self.handles.last() {
                self.host.release(id)?;
                self.handles.pop();
                assert!(self.host.read(id, Some(0), &mut [0]).is_err());
            }
            assert!(self.host.selectors().next().is_none());
            Ok(())
        }
    }
    impl Drop for Resources {
        fn drop(&mut self) {
            for id in self.handles.drain(..) {
                let _ = self.host.release(id);
            }
        }
    }

    pub fn run() -> Result<(), Box<dyn Error>> {
        let path = std::env::args().nth(1).ok_or("Component path required")?;
        let mut cfg = Config::new();
        cfg.wasm_component_model(true).consume_fuel(true);
        let engine = Engine::new(&cfg)?;
        let component = Component::from_file(&engine, path)?;
        let limits = StoreLimitsBuilder::new()
            .memory_size(32 << 20)
            .table_elements(4096)
            .instances(32)
            .build();
        let mut store = Store::new(&engine, limits);
        store.limiter(|data: &mut StoreLimits| data);
        store.set_fuel(64_000_000)?;
        let binding = SystemTelemetry::instantiate(&mut store, &component, &Linker::new(&engine))?;
        let monitor = binding.wasmc_system_telemetry_monitor();
        let api = monitor.sampler();
        let state = api.call_constructor(&mut store, Profile::Balanced)?;
        let mut sources = Resources::open()?;
        let fd_open = fs::read_dir("/proc/self/fd")?.count();
        let mut buffers: [Vec<u8>; 4] = std::array::from_fn(|_| vec![0; SNAPSHOT_LIMIT]);
        let mut calls = 0u64;
        let mut snapshots = 0u64;
        let mut refreshed = [0u64; 4];
        let epoch = Instant::now();
        let mut last_sequence = 0;
        for frame_no in 1..=128u64 {
            store.set_fuel(64_000_000)?;
            let now = u64::try_from(epoch.elapsed().as_nanos())?;
            let mask = api
                .call_refresh_mask(&mut store, state, now)?
                .map_err(|e| format!("cadence: {e:?}"))?;
            let mut values: [Option<String>; 4] = std::array::from_fn(|_| None);
            for i in 0..4 {
                if mask & (1 << i) != 0 {
                    let (n, c) = complete(&mut sources.host, sources.handles[i], &mut buffers[i])?;
                    values[i] = Some(std::str::from_utf8(&buffers[i][..n])?.to_owned());
                    snapshots += 1;
                    calls += c;
                    refreshed[i] += 1;
                }
            }
            let [cpu, memory, network, load] = values;
            let frame = api
                .call_sample(
                    &mut store,
                    state,
                    now,
                    &Snapshots {
                        cpu,
                        memory,
                        network,
                        load,
                    },
                )?
                .map_err(|e| format!("sample: {e:?}"))?;
            assert_eq!(frame.sequence, frame_no);
            assert_eq!(frame.freshness_mask, mask);
            if frame_no == 1 {
                assert_eq!(frame.cpu_milli_pct, None);
            }
            let encoded = monitor
                .call_encode_frame(&mut store, frame)?
                .map_err(|e| format!("encode: {e:?}"))?;
            assert_eq!(encoded.len(), 64);
            assert_eq!(u64::from_le_bytes(encoded[0..8].try_into()?), frame_no);
            last_sequence = frame_no;
            std::thread::sleep(Duration::from_millis(1));
        }
        state.resource_drop(&mut store)?;
        assert!(state.resource_drop(&mut store).is_err());
        assert_eq!(
            fs::read_dir("/proc/self/fd")?.count(),
            fd_open,
            "FD growth during resident run"
        );
        sources.close()?;
        let fd_closed = fs::read_dir("/proc/self/fd")?.count();
        assert_eq!(fd_closed + 4, fd_open, "four SDK grants must close");
        println!("{{\"accepted\":true,\"profile\":\"linux-sdk-to-source-free-component\",\"engine\":\"wasmtime-47.0.4\",\"frames\":{},\"snapshots\":{},\"generic_read_calls\":{},\"refresh_counts\":{:?},\"fd_open\":{},\"fd_closed\":{},\"released_grants\":4,\"sampling_uses_shell\":false,\"component_host_bindings\":0,\"release_qualified\":false}}",last_sequence,snapshots,calls,refreshed,fd_open,fd_closed);
        Ok(())
    }
}
#[cfg(target_os = "linux")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    linux::run()
}
#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!(
        "Live acquisition currently requires explicit Linux proc resources; no simulated fallback."
    );
    std::process::exit(2);
}

#[cfg(test)]
mod integration_tests {
    use super::exports::wasmc::system_telemetry::monitor::{Profile, Snapshots, TelemetryError};
    use super::{resource_snapshot::complete, SystemTelemetry};
    use std::sync::{Arc, Mutex};
    use wasmc_host::{HostError, ResourceBinding, WasmcHost};
    use wasmtime::component::{Component, Linker};
    use wasmtime::{Config, Engine, Store};
    struct Input(Arc<Mutex<Vec<u8>>>);
    impl ResourceBinding for Input {
        fn read(&mut self, pos: Option<u64>, dest: &mut [u8]) -> Result<usize, HostError> {
            let data = self.0.lock().unwrap();
            let src = data.get(pos.unwrap_or(0) as usize..).unwrap_or_default();
            // Deliberately short completions, independently of EOF.
            let n = src.len().min(dest.len()).min(7);
            dest[..n].copy_from_slice(&src[..n]);
            Ok(n)
        }
        fn release(&mut self) -> Result<(), HostError> {
            Ok(())
        }
    }
    #[test]
    fn sdk_to_component_preserves_errors_and_transactional_state() {
        let path =
            std::env::var("WASMC_TELEMETRY_COMPONENT").expect("exact verified Component path");
        let mut cfg = Config::new();
        cfg.wasm_component_model(true).consume_fuel(true);
        let engine = Engine::new(&cfg).unwrap();
        let component = Component::from_file(&engine, path).unwrap();
        let mut store = Store::new(&engine, ());
        store.set_fuel(64_000_000).unwrap();
        let b =
            SystemTelemetry::instantiate(&mut store, &component, &Linker::new(&engine)).unwrap();
        let api = b.wasmc_system_telemetry_monitor().sampler();
        let state = api.call_constructor(&mut store, Profile::Balanced).unwrap();
        let data = [
            "cpu 10 0 0 90\n",
            "MemAvailable: 100 kB\nSwapTotal: 20 kB\nSwapFree: 5 kB\n",
            "Inter-| Receive | Transmit\nbytes packets\neth0: 10 0 0 0 0 0 0 0 20 0 0 0 0 0 0 0\n",
            "1.25 0 0 1/1 1\n",
        ]
        .map(|s| Arc::new(Mutex::new(s.as_bytes().to_vec())));
        let mut builder = WasmcHost::builder();
        for (i, d) in data.iter().enumerate() {
            builder = builder
                .grant_resource(format!("fixture.{i}"), Box::new(Input(d.clone())))
                .unwrap();
        }
        let mut host = builder.build().unwrap();
        let ids: Vec<_> = (0..4)
            .map(|i| host.open(&format!("fixture.{i}")).unwrap())
            .collect();
        let mut acquire = || {
            let values: [String; 4] = std::array::from_fn(|i| {
                let mut out = [0u8; 256];
                let (n, _) = complete(&mut host, ids[i], &mut out).unwrap();
                std::str::from_utf8(&out[..n]).unwrap().to_owned()
            });
            let [cpu, memory, network, load] = values;
            Snapshots {
                cpu: Some(cpu),
                memory: Some(memory),
                network: Some(network),
                load: Some(load),
            }
        };
        let first = api
            .call_sample(&mut store, state, 0, &acquire())
            .unwrap()
            .unwrap();
        assert_eq!(first.sequence, 1);
        assert_eq!(first.available_memory, 102400);
        assert_eq!(first.cpu_milli_pct, None);
        *data[0].lock().unwrap() = b"cpu 30 0 0 110\n".to_vec();
        *data[1].lock().unwrap() = b"MemAvailable: invalid kB\n".to_vec();
        assert!(matches!(
            api.call_sample(&mut store, state, 10_000_000, &acquire())
                .unwrap(),
            Err(TelemetryError::MalformedInput)
        ));
        assert_eq!(
            api.call_refresh_mask(&mut store, state, 10_000_000)
                .unwrap()
                .unwrap(),
            7
        );
        *data[1].lock().unwrap() =
            b"MemAvailable: 100 kB\nSwapTotal: 20 kB\nSwapFree: 5 kB\n".to_vec();
        let next = api
            .call_sample(&mut store, state, 10_000_000, &acquire())
            .unwrap()
            .unwrap();
        assert_eq!(next.sequence, 2);
        assert_eq!(next.cpu_milli_pct, Some(50000));
        assert_eq!(next.used_swap, 15360);
        assert_eq!(next.network_rx_total, 10);
        assert_eq!(next.network_tx_total, 20);
        let empty = Snapshots {
            cpu: None,
            memory: None,
            network: None,
            load: None,
        };
        assert!(matches!(
            api.call_sample(&mut store, state, 20_000_000, &empty)
                .unwrap(),
            Err(TelemetryError::MissingInput)
        ));
        let cached = api
            .call_sample(&mut store, state, 11_000_000, &empty)
            .unwrap()
            .unwrap();
        assert_eq!(cached.sequence, 3);
        assert_eq!(cached.freshness_mask, 0);
        assert_eq!(cached.cpu_milli_pct, Some(50000));
        for id in ids {
            host.release(id).unwrap();
            assert!(host.read(id, Some(0), &mut [0]).is_err());
        }
        assert_eq!(host.selectors().count(), 0);
        state.resource_drop(&mut store).unwrap();
        assert!(state.resource_drop(&mut store).is_err());
    }
}
