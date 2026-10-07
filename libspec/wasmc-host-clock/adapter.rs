use crate::delta;
use crate::exports::wasmc::host_clock::clock_api::Guest;

pub struct Adapter;
impl Guest for Adapter {
    fn sampled(offset: i32) -> i32 {
        delta::sampled(crate::wasmc::host_clock::clock_host::now(), offset)
    }
}
