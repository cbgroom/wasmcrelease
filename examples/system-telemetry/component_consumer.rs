// Consumer uses only the copied public WIT and provided Component bytes.
// It has no dependency on telemetry's Rust implementation or private WAsmC code.
wasmtime::component::bindgen!({path: "wit", world: "system-telemetry"});
use exports::wasmc::system_telemetry::monitor::{Profile, Snapshots, TelemetryError};
use wasmtime::{Config, Engine, Store};
use wasmtime::component::{Component, Linker};

fn inputs(cpu: &str) -> Snapshots {
    Snapshots {
        cpu: Some(cpu.into()),
        memory: Some("MemAvailable: 100 kB\nSwapTotal: 20 kB\nSwapFree: 5 kB\n".into()),
        network: Some("Inter-| Receive | Transmit\nbytes packets\neth0: 10 0 0 0 0 0 0 0 20 0 0 0 0 0 0 0\n".into()),
        load: Some("1.25 0 0 1/1 1\n".into()),
    }
}

fn main() {
    let path = std::env::args().nth(1).expect("Component path");
    let mut config = Config::new();
    config.wasm_component_model(true);
    let engine = Engine::new(&config).unwrap();
    let component = Component::from_file(&engine, path).unwrap();
    let mut store = Store::new(&engine, ());
    // Empty linker: no filesystem, process, clock, network or telemetry Host.
    let binding = SystemTelemetry::instantiate(&mut store, &component, &Linker::new(&engine)).unwrap();
    let monitor = binding.wasmc_system_telemetry_monitor();
    let api = monitor.sampler();
    for _ in 0..128 {
        let state = api.call_constructor(&mut store, Profile::Balanced).unwrap();
        assert_eq!(api.call_refresh_mask(&mut store, state, 0).unwrap().unwrap(), 15);
        let first = api.call_sample(&mut store, state, 0, &inputs("cpu 10 0 0 90\n")).unwrap().unwrap();
        assert_eq!(first.sequence, 1);
        assert_eq!(first.cpu_milli_pct, None);
        assert_eq!(first.available_memory, 102400);
        let empty = Snapshots {cpu:None,memory:None,network:None,load:None};
        let cached = api.call_sample(&mut store, state, 1_000_000, &empty).unwrap().unwrap();
        assert_eq!(cached.freshness_mask, 0);
        assert!(matches!(api.call_sample(&mut store,state,10_000_000,&empty).unwrap(),Err(TelemetryError::MissingInput)));
        let next = api.call_sample(&mut store,state,10_000_000,&inputs("cpu 30 0 0 110\n")).unwrap().unwrap();
        assert_eq!(next.sequence, 3);
        assert_eq!(next.cpu_milli_pct, Some(50000));
        assert_eq!(next.freshness_mask, 7);
        let encoded = monitor.call_encode_frame(&mut store, next).unwrap().unwrap();
        assert_eq!(encoded.len(),64);
        assert_eq!(&encoded[48..52],&50000u32.to_le_bytes());
        assert_eq!(&encoded[60..64],&0u32.to_le_bytes());
        assert!(matches!(api.call_refresh_mask(&mut store,state,1).unwrap(),Err(TelemetryError::ClockRegressed)));
        state.resource_drop(&mut store).unwrap();
        assert!(state.resource_drop(&mut store).is_err(),"double drop must reject");
    }
    println!("{{\"accepted\":true,\"profile\":\"source-free-rust-component\",\"rounds\":128,\"host_bindings\":0,\"negative_controls\":[\"missing-input\",\"clock-regressed\",\"double-drop\"],\"release_qualified\":false}}");
}
