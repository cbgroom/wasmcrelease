use std::cell::Cell;

pub struct Counter(Cell<i32>);

impl Counter {
    pub fn new(initial: i32) -> Self { Self(Cell::new(initial)) }
    pub fn add(&self, delta: i32) -> i32 {
        let value = self.0.get().wrapping_add(delta);
        self.0.set(value);
        value
    }
    pub fn value(&self) -> i32 { self.0.get() }
}
