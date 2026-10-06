use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use std::io::{Read, Write};

const MAX_INPUT_BYTES: usize = 1 << 20;
const MAX_OUTPUT_BYTES: usize = 4 << 20;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InputTooLarge,
    OutputTooLarge,
    InvalidStream,
    InternalFailure,
}

pub fn compress(bytes: Vec<u8>) -> Result<Vec<u8>, Error> {
    if bytes.len() > MAX_INPUT_BYTES {
        return Err(Error::InputTooLarge);
    }
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&bytes).map_err(|_| Error::InternalFailure)?;
    let output = encoder.finish().map_err(|_| Error::InternalFailure)?;
    if output.len() > MAX_OUTPUT_BYTES {
        Err(Error::OutputTooLarge)
    } else {
        Ok(output)
    }
}

pub fn decompress(bytes: Vec<u8>) -> Result<Vec<u8>, Error> {
    if bytes.len() > MAX_INPUT_BYTES {
        return Err(Error::InputTooLarge);
    }
    let decoder = GzDecoder::new(bytes.as_slice());
    let mut limited = decoder.take((MAX_OUTPUT_BYTES as u64) + 1);
    let mut output = Vec::new();
    limited.read_to_end(&mut output).map_err(|_| Error::InvalidStream)?;
    if output.len() > MAX_OUTPUT_BYTES {
        Err(Error::OutputTooLarge)
    } else {
        Ok(output)
    }
}
