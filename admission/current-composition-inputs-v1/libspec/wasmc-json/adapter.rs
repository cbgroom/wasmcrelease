use crate::delta;
use crate::exports::wasmc::json::document::{Guest, JsonError};

pub struct Adapter;

fn map_error(error: delta::Error) -> JsonError {
    match error {
        delta::Error::InputTooLarge => JsonError::InputTooLarge,
        delta::Error::DepthLimit => JsonError::DepthLimit,
        delta::Error::InvalidJson => JsonError::InvalidJson,
        delta::Error::TooManyPointers => JsonError::TooManyPointers,
        delta::Error::PointerTooLong => JsonError::PointerTooLong,
        delta::Error::InvalidPointer => JsonError::InvalidPointer,
        delta::Error::OutputTooLarge => JsonError::OutputTooLarge,
    }
}

impl Guest for Adapter {
    fn compact(input: String) -> Result<String, JsonError> {
        delta::compact(input).map_err(map_error)
    }

    fn select(input: String, pointers: Vec<String>) -> Result<Vec<Option<String>>, JsonError> {
        delta::select(input, pointers).map_err(map_error)
    }

    fn validate(input: String) -> Result<(), JsonError> {
        delta::validate(input).map_err(map_error)
    }
}
