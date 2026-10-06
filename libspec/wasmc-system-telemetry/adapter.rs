use crate::exports::wasmc::system_telemetry::monitor as api;
use std::cell::RefCell;
pub struct Adapter;
pub struct State(RefCell<crate::delta::Sampler>);
fn error(e: crate::delta::Error) -> api::TelemetryError {
    match e {
        crate::delta::Error::MalformedInput => api::TelemetryError::MalformedInput,
        crate::delta::Error::MissingInput => api::TelemetryError::MissingInput,
        crate::delta::Error::InputTooLarge => api::TelemetryError::InputTooLarge,
        crate::delta::Error::Overflow => api::TelemetryError::Overflow,
        crate::delta::Error::ClockRegressed => api::TelemetryError::ClockRegressed,
    }
}
impl api::Guest for Adapter {
    type Sampler = State;
    fn encode_frame(f: api::Frame) -> Result<Vec<u8>, api::TelemetryError> {
        crate::delta::Frame {
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
        Self(RefCell::new(crate::delta::Sampler::new(match p {
            api::Profile::Fast => crate::delta::Profile::Fast,
            api::Profile::Balanced => crate::delta::Profile::Balanced,
            api::Profile::Economy => crate::delta::Profile::Economy,
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
                crate::delta::Snapshots {
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

