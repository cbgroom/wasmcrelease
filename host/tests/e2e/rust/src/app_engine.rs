use crate::resident_app::ResidentApp;
pub enum AppEngine {
    Wasmi(Box<ResidentApp>),
    #[cfg(feature = "wasmtime-engine")]
    Wasmtime(Box<crate::wasmtime_app::WasmtimeApp>),
}
impl AppEngine {
    pub fn new(lib: &str, app: &str, jit: bool) -> Result<Self, Box<dyn std::error::Error>> {
        if jit {
            #[cfg(feature = "wasmtime-engine")]
            {
                return Ok(Self::Wasmtime(Box::new(
                    crate::wasmtime_app::WasmtimeApp::new(lib, app)?,
                )));
            }
            #[cfg(not(feature = "wasmtime-engine"))]
            {
                return Err("wasmtime profile unavailable".into());
            }
        }
        Ok(Self::Wasmi(Box::new(ResidentApp::new(lib, app)?)))
    }
    pub fn call(&mut self, bytes: &[u8], fail: i32) -> Result<i64, Box<dyn std::error::Error>> {
        match self {
            Self::Wasmi(app) => app.call(bytes, fail),
            #[cfg(feature = "wasmtime-engine")]
            Self::Wasmtime(app) => app.call(bytes, fail),
        }
    }
    pub fn lib_calls(&self) -> usize {
        match self {
            Self::Wasmi(app) => app.lib_calls(),
            #[cfg(feature = "wasmtime-engine")]
            Self::Wasmtime(app) => app.lib_calls(),
        }
    }
}
