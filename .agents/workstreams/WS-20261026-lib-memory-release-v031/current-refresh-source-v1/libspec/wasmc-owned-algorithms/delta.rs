pub struct Request {
    pub label: String,
    pub values: Vec<i32>,
    pub enabled: bool,
}

pub fn count_true(values: Vec<bool>) -> u32 {
    values.into_iter().filter(|value| *value).count() as u32
}

pub fn request_score(value: Request) -> i64 {
    value.label.len() as i64 * 1000
        + sum_s32(value.values)
        + if value.enabled { 100 } else { 0 }
}

pub fn sum_s32(values: Vec<i32>) -> i64 {
    values.into_iter().map(i64::from).sum()
}

pub fn utf8_score(value: String) -> i32 {
    (value.chars().count() as i32).wrapping_mul(1000)
        .wrapping_add(value.len() as i32)
}
