wit_bindgen::generate!({ path: "wit", world: "system-telemetry", generate_all });
use exports::wasmc::system_telemetry::monitor as api;
use std::cell::RefCell;
struct Component;
pub struct State(RefCell<super::Sampler>);
fn error(e: super::Error) -> api::TelemetryError {
    match e {
        super::Error::MalformedInput => api::TelemetryError::MalformedInput,
        super::Error::MissingInput => api::TelemetryError::MissingInput,
        super::Error::InputTooLarge => api::TelemetryError::InputTooLarge,
        super::Error::Overflow => api::TelemetryError::Overflow,
        super::Error::ClockRegressed => api::TelemetryError::ClockRegressed,
    }
}
impl api::Guest for Component {
    type Sampler = State;
    fn encode_frame(f: api::Frame) -> Result<Vec<u8>, api::TelemetryError> {
        super::Frame {
            sequence: f.sequence,
            monotonic_ns: f.monotonic_ns,
            available_memory: f.available_memory,
            used_swap: f.used_swap,
            network_rx_total: f.network_rx_total,
            network_tx_total: f.network_tx_total,
            cpu_milli_pct: f.cpu_milli_pct,
            load1_milli: f.load1_milli,
            freshness_mask: f.freshness_mask,
        }
        .encode()
        .map(|v| v.to_vec())
        .map_err(error)
    }
}
impl api::GuestSampler for State {
    fn new(p: api::Profile) -> Self {
        Self(RefCell::new(super::Sampler::new(match p {
            api::Profile::Fast => super::Profile::Fast,
            api::Profile::Balanced => super::Profile::Balanced,
            api::Profile::Economy => super::Profile::Economy,
        })))
    }
    fn refresh_mask(&self, now: u64) -> Result<u32, api::TelemetryError> {
        self.0.borrow().refresh_mask(now).map_err(error)
    }
    fn sample(&self, now: u64, input: api::Snapshots) -> Result<api::Frame, api::TelemetryError> {
        let f = self
            .0
            .borrow_mut()
            .sample(
                now,
                super::Snapshots {
                    cpu: input.cpu.as_deref(),
                    memory: input.memory.as_deref(),
                    network: input.network.as_deref(),
                    load: input.load.as_deref(),
                },
            )
            .map_err(error)?;
        Ok(api::Frame {
            sequence: f.sequence,
            monotonic_ns: f.monotonic_ns,
            available_memory: f.available_memory,
            used_swap: f.used_swap,
            network_rx_total: f.network_rx_total,
            network_tx_total: f.network_tx_total,
            cpu_milli_pct: f.cpu_milli_pct,
            load1_milli: f.load1_milli,
            freshness_mask: f.freshness_mask,
        })
    }
}
export!(Component);
