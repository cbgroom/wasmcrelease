wit_bindgen::generate!({
    path: "wit",
    world: "compression",
});

use crate::exports::wasmc::compression::gzip::{CompressionError, Guest};
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use std::io::{Read, Write};

const MAX_INPUT_BYTES: usize = 16 << 20;
const MAX_OUTPUT_BYTES: usize = 64 << 20;

struct Gzip;

impl Guest for Gzip {
    fn compress(bytes: Vec<u8>) -> Result<Vec<u8>, CompressionError> {
        if bytes.len() > MAX_INPUT_BYTES {
            return Err(CompressionError::InputTooLarge);
        }
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(&bytes)
            .map_err(|_| CompressionError::InternalFailure)?;
        let output = encoder
            .finish()
            .map_err(|_| CompressionError::InternalFailure)?;
        if output.len() > MAX_OUTPUT_BYTES {
            Err(CompressionError::OutputTooLarge)
        } else {
            Ok(output)
        }
    }

    fn decompress(bytes: Vec<u8>) -> Result<Vec<u8>, CompressionError> {
        if bytes.len() > MAX_INPUT_BYTES {
            return Err(CompressionError::InputTooLarge);
        }
        let decoder = GzDecoder::new(bytes.as_slice());
        let mut limited = decoder.take((MAX_OUTPUT_BYTES as u64) + 1);
        let mut output = Vec::new();
        limited
            .read_to_end(&mut output)
            .map_err(|_| CompressionError::InvalidStream)?;
        if output.len() > MAX_OUTPUT_BYTES {
            Err(CompressionError::OutputTooLarge)
        } else {
            Ok(output)
        }
    }
}

export!(Gzip);
