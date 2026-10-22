/// The adapter supplies the explicitly granted clock value. Business logic
/// cannot acquire a clock or any other ambient capability itself.
pub fn sampled(now: i32, offset: i32) -> i32 { now.wrapping_add(offset) }
