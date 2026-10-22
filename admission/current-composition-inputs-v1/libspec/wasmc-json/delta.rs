use serde_json::Value;

const MAX_INPUT_BYTES: usize = 64 * 1024;
const MAX_OUTPUT_BYTES: usize = 64 * 1024;
const MAX_POINTERS: usize = 64;
const MAX_POINTER_BYTES: usize = 1024;
const MAX_DEPTH: usize = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InputTooLarge,
    DepthLimit,
    InvalidJson,
    TooManyPointers,
    PointerTooLong,
    InvalidPointer,
    OutputTooLarge,
}

fn parse(input: &str) -> Result<Value, Error> {
    if input.len() > MAX_INPUT_BYTES {
        return Err(Error::InputTooLarge);
    }
    let value: Value = serde_json::from_str(input).map_err(|error| {
        if error.to_string().contains("recursion limit exceeded") {
            Error::DepthLimit
        } else {
            Error::InvalidJson
        }
    })?;
    if value_depth(&value) > MAX_DEPTH {
        return Err(Error::DepthLimit);
    }
    Ok(value)
}

fn value_depth(value: &Value) -> usize {
    match value {
        Value::Array(values) => 1 + values.iter().map(value_depth).max().unwrap_or(0),
        Value::Object(values) => 1 + values.values().map(value_depth).max().unwrap_or(0),
        _ => 0,
    }
}

fn render(value: &Value) -> Result<String, Error> {
    let output = serde_json::to_string(value).map_err(|_| Error::InvalidJson)?;
    if output.len() > MAX_OUTPUT_BYTES {
        Err(Error::OutputTooLarge)
    } else {
        Ok(output)
    }
}

fn validate_pointer(pointer: &str) -> Result<(), Error> {
    if pointer.len() > MAX_POINTER_BYTES {
        return Err(Error::PointerTooLong);
    }
    if !pointer.is_empty() && !pointer.starts_with('/') {
        return Err(Error::InvalidPointer);
    }
    let bytes = pointer.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'~' {
            if index + 1 >= bytes.len() || !matches!(bytes[index + 1], b'0' | b'1') {
                return Err(Error::InvalidPointer);
            }
            index += 2;
        } else {
            index += 1;
        }
    }
    Ok(())
}

pub fn compact(input: String) -> Result<String, Error> {
    render(&parse(&input)?)
}

pub fn select(input: String, pointers: Vec<String>) -> Result<Vec<Option<String>>, Error> {
    if pointers.len() > MAX_POINTERS {
        return Err(Error::TooManyPointers);
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
                    .ok_or(Error::OutputTooLarge)?;
                if output_bytes > MAX_OUTPUT_BYTES {
                    return Err(Error::OutputTooLarge);
                }
                Some(value)
            }
            None => None,
        };
        output.push(selected);
    }
    Ok(output)
}

pub fn validate(input: String) -> Result<(), Error> {
    parse(&input).map(|_| ())
}
