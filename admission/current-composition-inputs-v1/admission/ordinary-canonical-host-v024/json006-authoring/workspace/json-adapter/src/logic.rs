use serde_json::Value;
use std::io::{self, Write};

const MAX_BYTES: usize = 65_536;
const MAX_DEPTH: usize = 64;
const MAX_POINTERS: usize = 64;
const MAX_POINTER_BYTES: usize = 1_024;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JsonError {
    InputTooLarge, DepthLimit, InvalidJson, TooManyPointers,
    PointerTooLong, InvalidPointer, OutputTooLarge,
}

// This scan bounds parser recursion before constructing the private DOM.
// It does not replace JSON syntax validation, which belongs to serde_json.
fn preflight(input: &[u8]) -> Result<(), JsonError> {
    if input.len() > MAX_BYTES {
        return Err(JsonError::InputTooLarge);
    }
    let (mut quoted, mut escaped, mut depth) = (false, false, 0usize);
    for byte in input.iter().copied() {
        if quoted {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                quoted = false;
            }
        } else {
            match byte {
                b'"' => quoted = true,
                b'[' | b'{' => {
                    depth += 1;
                    if depth > MAX_DEPTH {
                        return Err(JsonError::DepthLimit);
                    }
                }
                b']' | b'}' => depth = depth.saturating_sub(1),
                _ => {}
            }
        }
    }
    Ok(())
}

fn pointer_preflight(pointer: &str) -> Result<(), JsonError> {
    if pointer.len() > MAX_POINTER_BYTES {
        return Err(JsonError::PointerTooLong);
    }
    if !pointer.is_empty() && !pointer.starts_with('/') {
        return Err(JsonError::InvalidPointer);
    }
    let mut bytes = pointer.bytes();
    while let Some(byte) = bytes.next() {
        if byte == b'~' && !matches!(bytes.next(), Some(b'0' | b'1')) {
            return Err(JsonError::InvalidPointer);
        }
    }
    Ok(())
}

struct BoundedOutput {
    bytes: Vec<u8>,
    limit: usize,
}
impl Write for BoundedOutput {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if bytes.len() > self.limit.saturating_sub(self.bytes.len()) {
            return Err(io::Error::other("output limit"));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
fn encode(value: &Value, limit: usize) -> Result<String, JsonError> {
    let mut output = BoundedOutput {
        bytes: Vec::new(),
        limit,
    };
    serde_json::to_writer(&mut output, value).map_err(|_| JsonError::OutputTooLarge)?;
    String::from_utf8(output.bytes).map_err(|_| JsonError::InvalidJson)
}


pub fn compact(input: &[u8]) -> Result<String, JsonError> {
        preflight(input)?;
        let value: Value = serde_json::from_slice(input).map_err(|_| JsonError::InvalidJson)?;
        encode(&value, MAX_BYTES)
    }
    pub fn select(input: &[u8], pointers: &[String]) -> Result<Vec<Option<String>>, JsonError> {
        preflight(input)?;
        if pointers.len() > MAX_POINTERS {
            return Err(JsonError::TooManyPointers);
        }
        for pointer in pointers {
            pointer_preflight(pointer)?;
        }
        let value: Value = serde_json::from_slice(input).map_err(|_| JsonError::InvalidJson)?;
        let mut remaining = MAX_BYTES;
        let mut output = Vec::with_capacity(pointers.len());
        for pointer in pointers {
            if let Some(selected) = value.pointer(&pointer) {
                let text = encode(selected, remaining)?;
                remaining -= text.len();
                output.push(Some(text));
            } else {
                output.push(None);
            }
        }
        Ok(output)
    }
    pub fn validate(input: &[u8]) -> Result<(), JsonError> {
        preflight(input)?;
        serde_json::from_slice::<Value>(input)
            .map(|_| ())
            .map_err(|_| JsonError::InvalidJson)
    }

#[cfg(test)]
mod tests {
    use super::*;
    fn pointers(input: &[&str]) -> Vec<String> { input.iter().map(|v| (*v).into()).collect() }

    #[test]
    fn binary_ingress_preserves_upstream_json_semantics() {
        for input in [
            br#"{"z":1,"a":0,"z":2}"#.as_slice(), b"18446744073709551615",
            b"-9223372036854775808", b"1.2345678901234567",
            br#"[true,false,null,{"nested":[1,2]}]"#,
            "{\"text\":\"非 ASCII 😀\",\"zero\":\"\\u0000\"}".as_bytes(),
        ] {
            let expected: Value=serde_json::from_slice(input).unwrap();
            assert_eq!(compact(input).unwrap(),serde_json::to_string(&expected).unwrap());
            assert_eq!(validate(input),Ok(()));
        }
    }
    #[test]
    fn missing_and_json_null_remain_distinct() {
        assert_eq!(select(br#"{"x":null,"a/b":3,"~":true,"array":["a","b"]}"#,
            &pointers(&["/x","/absent","/a~1b","/~0","/array/1"])).unwrap(),
            vec![Some("null".into()),None,Some("3".into()),Some("true".into()),Some("\"b\"".into())]);
    }
    #[test]
    fn unicode_and_nul_pointer_keys_are_logical_values() {
        let input="{\"😀\":{\"键\":\"值\"},\"\\u0000\":7}";
        assert_eq!(select(input.as_bytes(),&pointers(&["/😀/键","/\0"])).unwrap(),
            vec![Some("\"值\"".into()),Some("7".into())]);
    }
    #[test]
    fn full_input_is_consumed_beyond_host_call_budget_lengths() {
        for size in [801,4096,32768,MAX_BYTES-25] {
            let input=format!("{{\"padding\":\"{}\",\"tail\":42}}","x".repeat(size));
            assert!(input.len()<=MAX_BYTES);
            assert_eq!(select(input.as_bytes(),&pointers(&["/tail"])).unwrap(),vec![Some("42".into())]);
        }
    }
    #[test]
    fn input_boundary_applies_to_bytes_without_lossy_utf8() {
        let exact=format!("\"{}\"", "x".repeat(MAX_BYTES-2));
        assert_eq!(compact(exact.as_bytes()).unwrap().len(),MAX_BYTES);
        assert_eq!(validate(&vec![b' ';MAX_BYTES+1]),Err(JsonError::InputTooLarge));
        for input in [&[255][..],b"\"\xff\"",b"{}\0",b"{} trailing",b"{"] {
            assert_eq!(compact(input),Err(JsonError::InvalidJson));
            assert_eq!(validate(input),Err(JsonError::InvalidJson));
        }
    }
    #[test]
    fn depth_scan_counts_containers_outside_strings_only() {
        assert!(validate(format!("{}0{}","[".repeat(64),"]".repeat(64)).as_bytes()).is_ok());
        assert_eq!(validate(format!("{}0{}","[".repeat(65),"]".repeat(65)).as_bytes()),Err(JsonError::DepthLimit));
        assert!(validate(format!("\"{}\"", "[".repeat(100)).as_bytes()).is_ok());
        assert!(validate(br#"{"quote":"\"[","slash":"\\"}"#).is_ok());
    }
    #[test]
    fn pointer_syntax_count_and_byte_limits_keep_error_precedence() {
        assert_eq!(select(b"null",&vec![String::new();65]),Err(JsonError::TooManyPointers));
        for p in ["~0","/~2","/~","/x~3"] {
            assert_eq!(select(b"{",&pointers(&[p])),Err(JsonError::InvalidPointer));
        }
        assert_eq!(select(b"null",&pointers(&[&format!("/{}","a".repeat(1024))])),Err(JsonError::PointerTooLong));
        assert_eq!(select(&vec![b' ';MAX_BYTES+1],&pointers(&["bad"])),Err(JsonError::InputTooLarge));
    }
    #[test]
    fn output_limit_has_no_partial_result_and_next_call_recovers() {
        let input=format!("\"{}\"", "x".repeat(40000));
        assert_eq!(select(input.as_bytes(),&pointers(&["",""])),Err(JsonError::OutputTooLarge));
        assert_eq!(select(b"[1,2]",&pointers(&["/1"])).unwrap(),vec![Some("2".into())]);
        assert_eq!(compact(b"[1,2]").unwrap(),"[1,2]");
    }
    #[test]
    fn all_binary_byte_values_are_validated_by_serde_not_reinterpreted() {
        for byte in 0..=255u8 {
            let input=[b'"',byte,b'"'];
            let oracle=serde_json::from_slice::<Value>(&input);
            assert_eq!(validate(&input).is_ok(),oracle.is_ok(),"{byte}");
        }
    }
}
