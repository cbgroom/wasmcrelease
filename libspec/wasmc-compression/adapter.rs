use crate::delta;
use crate::exports::wasmc::compression::gzip::{CompressionError, Guest};

pub struct Adapter;

fn map_error(error: delta::Error) -> CompressionError {
    match error {
        delta::Error::InputTooLarge => CompressionError::InputTooLarge,
        delta::Error::OutputTooLarge => CompressionError::OutputTooLarge,
        delta::Error::InvalidStream => CompressionError::InvalidStream,
        delta::Error::InternalFailure => CompressionError::InternalFailure,
    }
}

impl Guest for Adapter {
    fn compress(bytes: Vec<u8>) -> Result<Vec<u8>, CompressionError> {
        delta::compress(bytes).map_err(map_error)
    }

    fn decompress(bytes: Vec<u8>) -> Result<Vec<u8>, CompressionError> {
        delta::decompress(bytes).map_err(map_error)
    }
}
