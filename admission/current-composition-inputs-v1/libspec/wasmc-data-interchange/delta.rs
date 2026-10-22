use crate::data_arrow::{self, BatchSnapshot};
use arrow_array::RecordBatch;
use arrow_ipc::reader::FileReader;
use arrow_ipc::writer::FileWriter;
use bytes::Bytes;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use std::io::{Cursor, Error as IoError, Result as IoResult, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EncodeOptions {
    pub max_batches: u32,
    pub max_rows: u32,
    pub max_output_bytes: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DecodeOptions {
    pub max_input_bytes: u32,
    pub max_batches: u32,
    pub max_rows: u32,
    pub batch_rows: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InvalidOptions,
    InvalidBatch,
    EmptyInput,
    SchemaMismatch,
    UnsupportedType,
    InputLimitExceeded,
    BatchLimitExceeded,
    RowLimitExceeded,
    OutputLimitExceeded,
    InvalidData,
    EncodeFailure,
    Overflow,
}

struct BoundedWriter {
    bytes: Vec<u8>,
    limit: usize,
    exceeded: Arc<AtomicBool>,
}
impl Write for BoundedWriter {
    fn write(&mut self, value: &[u8]) -> IoResult<usize> {
        let next = self.bytes.len().checked_add(value.len())
            .ok_or_else(|| IoError::other("output size overflow"))?;
        if next > self.limit {
            self.exceeded.store(true, Ordering::Relaxed);
            return Err(IoError::other("output limit exceeded"));
        }
        self.bytes.extend_from_slice(value);
        Ok(value.len())
    }
    fn flush(&mut self) -> IoResult<()> { Ok(()) }
}
fn encode_error(exceeded: &AtomicBool) -> Error {
    if exceeded.load(Ordering::Relaxed) { Error::OutputLimitExceeded } else { Error::EncodeFailure }
}
fn map_data_error(error: data_arrow::Error) -> Error {
    match error {
        data_arrow::Error::UnsupportedType => Error::UnsupportedType,
        _ => Error::InvalidBatch,
    }
}
fn validate_encode(
    values: &[BatchSnapshot],
    options: EncodeOptions,
) -> Result<Vec<RecordBatch>, Error> {
    if options.max_batches == 0 || options.max_rows == 0 || options.max_output_bytes == 0 {
        return Err(Error::InvalidOptions);
    }
    if values.is_empty() { return Err(Error::EmptyInput); }
    if values.len() > options.max_batches as usize { return Err(Error::BatchLimitExceeded); }
    let mut rows = 0u32;
    let batches = values.iter().map(|value| {
        if value.fields.is_empty() { return Err(Error::InvalidBatch); }
        rows = rows.checked_add(value.rows).ok_or(Error::Overflow)?;
        if rows > options.max_rows { return Err(Error::RowLimitExceeded); }
        data_arrow::validate_snapshot(value).map_err(map_data_error)
    }).collect::<Result<Vec<_>,_>>()?;
    let schema = batches[0].schema();
    if batches.iter().skip(1).any(|batch| batch.schema() != schema) {
        return Err(Error::SchemaMismatch);
    }
    Ok(batches)
}
fn validate_decode(input: &[u8], options: DecodeOptions) -> Result<(), Error> {
    if options.max_input_bytes == 0 || options.max_batches == 0
        || options.max_rows == 0 || options.batch_rows == 0 {
        return Err(Error::InvalidOptions);
    }
    if input.is_empty() { return Err(Error::EmptyInput); }
    if input.len() > options.max_input_bytes as usize { return Err(Error::InputLimitExceeded); }
    Ok(())
}
fn collect_decoded(
    batches: impl Iterator<Item=Result<RecordBatch,arrow_schema::ArrowError>>,
    options: DecodeOptions,
) -> Result<Vec<BatchSnapshot>,Error> {
    let mut output=Vec::new(); let mut rows=0u32;
    for batch in batches {
        if output.len() >= options.max_batches as usize { return Err(Error::BatchLimitExceeded); }
        let batch=batch.map_err(|_|Error::InvalidData)?;
        rows=rows.checked_add(u32::try_from(batch.num_rows()).map_err(|_|Error::Overflow)?).ok_or(Error::Overflow)?;
        if rows>options.max_rows { return Err(Error::RowLimitExceeded); }
        output.push(data_arrow::snapshot_from_batch_schema(&batch).map_err(|e|match e{
            data_arrow::Error::UnsupportedType=>Error::UnsupportedType,
            _=>Error::InvalidData,
        })?);
    }
    if output.is_empty(){return Err(Error::InvalidData)}
    Ok(output)
}
pub fn ipc_file_encode(values:Vec<BatchSnapshot>,options:EncodeOptions)->Result<Vec<u8>,Error>{
    let batches=validate_encode(&values,options)?;
    let exceeded=Arc::new(AtomicBool::new(false));
    let sink=BoundedWriter{bytes:Vec::new(),limit:options.max_output_bytes as usize,exceeded:exceeded.clone()};
    let mut writer=FileWriter::try_new(sink,batches[0].schema().as_ref()).map_err(|_|encode_error(&exceeded))?;
    for batch in &batches{writer.write(batch).map_err(|_|encode_error(&exceeded))?;}
    writer.into_inner().map(|w|w.bytes).map_err(|_|encode_error(&exceeded))
}
pub fn ipc_file_decode(input:Vec<u8>,options:DecodeOptions)->Result<Vec<BatchSnapshot>,Error>{
    validate_decode(&input,options)?;
    let reader=FileReader::try_new(Cursor::new(input),None).map_err(|_|Error::InvalidData)?;
    collect_decoded(reader,options)
}
pub fn parquet_encode(values:Vec<BatchSnapshot>,options:EncodeOptions)->Result<Vec<u8>,Error>{
    let batches=validate_encode(&values,options)?;
    let exceeded=Arc::new(AtomicBool::new(false));
    let sink=BoundedWriter{bytes:Vec::new(),limit:options.max_output_bytes as usize,exceeded:exceeded.clone()};
    let properties=WriterProperties::builder().set_compression(Compression::UNCOMPRESSED).build();
    let mut writer=ArrowWriter::try_new(sink,batches[0].schema(),Some(properties)).map_err(|_|encode_error(&exceeded))?;
    for batch in &batches{writer.write(batch).map_err(|_|encode_error(&exceeded))?;}
    writer.into_inner().map(|w|w.bytes).map_err(|_|encode_error(&exceeded))
}
pub fn parquet_decode(input:Vec<u8>,options:DecodeOptions)->Result<Vec<BatchSnapshot>,Error>{
    validate_decode(&input,options)?;
    let reader=ParquetRecordBatchReaderBuilder::try_new(Bytes::from(input)).map_err(|_|Error::InvalidData)?
        .with_batch_size(options.batch_rows as usize).build().map_err(|_|Error::InvalidData)?;
    collect_decoded(reader,options)
}
