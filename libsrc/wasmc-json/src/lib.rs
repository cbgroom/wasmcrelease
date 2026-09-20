wit_bindgen::generate!({
    path: "wit",
    world: "json",
});

use crate::exports::wasmc::json::document::{Guest, JsonError};
use serde_json::Value;

const MAX_INPUT_BYTES: usize = 64 * 1024;
const MAX_OUTPUT_BYTES: usize = 64 * 1024;
const MAX_POINTERS: usize = 64;
const MAX_POINTER_BYTES: usize = 1024;
const MAX_DEPTH: usize = 64;

struct Json;

fn parse(input: &str) -> Result<Value, JsonError> {
    if input.len() > MAX_INPUT_BYTES {
        return Err(JsonError::InputTooLarge);
    }
    let value: Value = serde_json::from_str(input).map_err(|error| {
        if error.to_string().contains("recursion limit exceeded") {
            JsonError::DepthLimit
        } else {
            JsonError::InvalidJson
        }
    })?;
    if value_depth(&value) > MAX_DEPTH {
        return Err(JsonError::DepthLimit);
    }
    Ok(value)
}

fn value_depth(value: &Value) -> usize {
    match value {
        Value::Array(values) => {
            1 + values.iter().map(value_depth).max().unwrap_or(0)
        }
        Value::Object(values) => {
            1 + values.values().map(value_depth).max().unwrap_or(0)
        }
        _ => 0,
    }
}

fn render(value: &Value) -> Result<String, JsonError> {
    let output = serde_json::to_string(value).map_err(|_| JsonError::InvalidJson)?;
    if output.len() > MAX_OUTPUT_BYTES {
        Err(JsonError::OutputTooLarge)
    } else {
        Ok(output)
    }
}

fn validate_pointer(pointer: &str) -> Result<(), JsonError> {
    if pointer.len() > MAX_POINTER_BYTES {
        return Err(JsonError::PointerTooLong);
    }
    if !pointer.is_empty() && !pointer.starts_with('/') {
        return Err(JsonError::InvalidPointer);
    }
    let bytes = pointer.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'~' {
            if index + 1 >= bytes.len() || !matches!(bytes[index + 1], b'0' | b'1') {
                return Err(JsonError::InvalidPointer);
            }
            index += 2;
        } else {
            index += 1;
        }
    }
    Ok(())
}

impl Guest for Json {
    fn compact(input: String) -> Result<String, JsonError> {
        render(&parse(&input)?)
    }

    fn select(input: String, pointers: Vec<String>) -> Result<Vec<Option<String>>, JsonError> {
        if pointers.len() > MAX_POINTERS {
            return Err(JsonError::TooManyPointers);
        }
        let document = parse(&input)?;
        let mut output = Vec::with_capacity(pointers.len());
        let mut output_bytes = 0usize;
        for pointer in pointers {
            validate_pointer(&pointer)?;
            let selected = match document.pointer(&pointer) {
                Some(value) => {
                    let value = render(value)?;
                    output_bytes = output_bytes
                        .checked_add(value.len())
                        .ok_or(JsonError::OutputTooLarge)?;
                    if output_bytes > MAX_OUTPUT_BYTES {
                        return Err(JsonError::OutputTooLarge);
                    }
                    Some(value)
                }
                None => None,
            };
            output.push(selected);
        }
        Ok(output)
    }

    fn validate(input: String) -> Result<(), JsonError> {
        parse(&input).map(|_| ())
    }
}

export!(Json);
