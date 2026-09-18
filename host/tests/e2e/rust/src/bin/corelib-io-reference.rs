//! Trusted exact-provider/private-ABI conformance fixture, not an untrusted SDK.
type Failure = Box<dyn std::error::Error>;
mod interpreted {
    use wasmi::{Config, Engine, Instance, Linker, Module, Store};
    fn engine() -> Result<Engine, super::Failure> {
        let mut config = Config::default();
        config.consume_fuel(true);
        Ok(Engine::new(&config))
    }
    fn instantiate(
        linker: &Linker<()>,
        store: &mut Store<()>,
        module: &Module,
    ) -> Result<Instance, super::Failure> {
        Ok(linker.instantiate_and_start(store, module)?)
    }
    include!("../corelib_io_conformance.rs");
}
#[cfg(feature = "wasmtime-engine")]
mod compiled {
    use wasmtime::{Config, Engine, Instance, Linker, Module, Store};
    fn engine() -> Result<Engine, super::Failure> {
        let mut config = Config::new();
        config.consume_fuel(true);
        Ok(Engine::new(&config)?)
    }
    fn instantiate(
        linker: &Linker<()>,
        store: &mut Store<()>,
        module: &Module,
    ) -> Result<Instance, super::Failure> {
        Ok(linker.instantiate(store, module)?)
    }
    include!("../corelib_io_conformance.rs");
}
fn main() -> Result<(), Failure> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() < 5 {
        return Err("provider caller directory name [--wasmtime]".into());
    }
    if args.iter().any(|a| a == "--wasmtime") {
        #[cfg(feature = "wasmtime-engine")]
        return compiled::proof(
            &args[1],
            &args[2],
            &args[3],
            &args[4],
            args.iter().any(|a| a == "--lifetime-only"),
        );
        #[cfg(not(feature = "wasmtime-engine"))]
        return Err("wasmtime profile unavailable".into());
    }
    interpreted::proof(
        &args[1],
        &args[2],
        &args[3],
        &args[4],
        args.iter().any(|a| a == "--lifetime-only"),
    )
}
