use crate::delta;
use crate::exports::wasmc::owned_algorithms::algorithms::{Guest, Request};

pub struct Adapter;

impl Guest for Adapter {
    fn count_true(values: Vec<bool>) -> u32 { delta::count_true(values) }
    fn sum_s32(values: Vec<i32>) -> i64 { delta::sum_s32(values) }
    fn utf8_score(value: String) -> i32 { delta::utf8_score(value) }
    fn request_score(value: Request) -> i64 {
        delta::request_score(delta::Request {
            label: value.label, values: value.values, enabled: value.enabled,
        })
    }
}
