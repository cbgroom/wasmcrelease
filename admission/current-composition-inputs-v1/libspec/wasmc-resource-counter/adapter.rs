use crate::delta;
use crate::exports::wasmc::resource_counter::counters::{Guest, GuestCounter};

pub struct Adapter;
pub struct Counter(delta::Counter);

impl Guest for Adapter { type Counter = Counter; }
impl GuestCounter for Counter {
    fn new(initial: i32) -> Self { Self(delta::Counter::new(initial)) }
    fn add(&self, value: i32) -> i32 { self.0.add(value) }
    fn value(&self) -> i32 { self.0.value() }
}
