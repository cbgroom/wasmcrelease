use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use std::io::{Read, Write};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InputTooLarge,
    OutputTooLarge,
    InvalidStream,
    InternalFailure,
}

pub fn compress(bytes: Vec<u8>) -> Result<Vec<u8>, Error> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(&bytes)
        .map_err(|_| Error::InternalFailure)?;
    let output = encoder.finish().map_err(|_| Error::InternalFailure)?;
    Ok(output)
}

pub fn decompress(bytes: Vec<u8>) -> Result<Vec<u8>, Error> {
    let mut decoder = GzDecoder::new(bytes.as_slice());
    let mut output = Vec::new();
    decoder
        .read_to_end(&mut output)
        .map_err(|_| Error::InvalidStream)?;
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn no_one_mib_input_or_four_mib_output_limit() {
        let mut x = 0x12345678u32;
        let bytes: Vec<_> = (0..(5 * 1024 * 1024 + 17))
            .map(|_| {
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                x as u8
            })
            .collect();
        let compressed = compress(bytes.clone()).unwrap();
        assert!(compressed.len() > 4 * 1024 * 1024);
        assert_eq!(decompress(compressed).unwrap(), bytes);
    }
    #[test]
    fn high_compression_ratio_has_no_output_quota_and_invalid_stream_still_errors() {
        let bytes = vec![b'x'; 5 * 1024 * 1024];
        assert_eq!(decompress(compress(bytes.clone()).unwrap()).unwrap(), bytes);
        assert_eq!(
            decompress(b"invalid gzip".to_vec()),
            Err(Error::InvalidStream)
        );
    }
}
