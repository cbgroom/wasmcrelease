mod bindings { wit_bindgen::generate!({path:"../../lib.wit",world:"text-world"}); }
use bindings::exports::wasmc::text::text::Guest;
struct Component;
impl Guest for Component {
    fn contains(input: String, pattern: String) -> bool { input.contains(&pattern) }
    fn starts_with(input: String, pattern: String) -> bool { input.starts_with(&pattern) }
    fn ends_with(input: String, pattern: String) -> bool { input.ends_with(&pattern) }
    fn is_empty(input: String) -> bool { input.is_empty() }
    fn is_ascii(input: String) -> bool { input.is_ascii() }
    fn eq_ignore_ascii_case(input: String, other: String) -> bool { input.eq_ignore_ascii_case(&other) }
    fn find(input: String, pattern: String) -> Option<u32> { memchr::memmem::find(input.as_bytes(),pattern.as_bytes()).map(|n|u32::try_from(n).expect("wasm32 offset")) }
    fn rfind(input: String, pattern: String) -> Option<u32> { memchr::memmem::rfind(input.as_bytes(),pattern.as_bytes()).map(|n|u32::try_from(n).expect("wasm32 offset")) }
    fn trim(input: String) -> String { input.trim().to_owned() }
    fn trim_start(input: String) -> String { input.trim_start().to_owned() }
    fn trim_end(input: String) -> String { input.trim_end().to_owned() }
    fn to_lowercase(input: String) -> String { input.to_lowercase() }
    fn to_uppercase(input: String) -> String { input.to_uppercase() }
    fn to_ascii_lowercase(input: String) -> String { input.to_ascii_lowercase() }
    fn to_ascii_uppercase(input: String) -> String { input.to_ascii_uppercase() }
    fn split(input: String, pattern: String) -> Vec<String> { input.split(&pattern).map(str::to_owned).collect() }
    fn splitn(input: String, count: u32, pattern: String) -> Vec<String> { input.splitn(count as usize,&pattern).map(str::to_owned).collect() }
    fn split_whitespace(input: String) -> Vec<String> { input.split_whitespace().map(str::to_owned).collect() }
    fn split_ascii_whitespace(input: String) -> Vec<String> { input.split_ascii_whitespace().map(str::to_owned).collect() }
    fn lines(input: String) -> Vec<String> { input.lines().map(str::to_owned).collect() }
    fn replace(input: String, from: String, to: String) -> String { input.replace(&from,&to) }
    fn replacen(input: String, from: String, to: String, count: u32) -> String { input.replacen(&from,&to,count as usize) }
    fn join(parts: Vec<String>, separator: String) -> String { parts.join(&separator) }
    fn strip_prefix_or(input: String, pattern: String, fallback: String) -> String { input.strip_prefix(&pattern).map(str::to_owned).unwrap_or(fallback) }
    fn strip_suffix_or(input: String, pattern: String, fallback: String) -> String { input.strip_suffix(&pattern).map(str::to_owned).unwrap_or(fallback) }
    fn get_or(input: String, start: u32, end: u32, fallback: String) -> String { input.get(start as usize..end as usize).map(str::to_owned).unwrap_or(fallback) }
    fn is_char_boundary(input: String, index: u32) -> bool { input.is_char_boundary(index as usize) }
    fn into_bytes(input: String) -> Vec<u8> { input.into_bytes() }
    fn from_utf8_or(input: Vec<u8>, fallback: String) -> String { String::from_utf8(input).ok().unwrap_or(fallback) }
    fn from_utf8_lossy(input: Vec<u8>) -> String { String::from_utf8_lossy(&input).into_owned() }
}
bindings::export!(Component with_types_in bindings);

#[cfg(test)]
mod tests;
