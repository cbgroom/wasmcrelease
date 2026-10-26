use crate::data_arrow::{self, BatchSnapshot};
use arrow_array::RecordBatch;
use arrow_ipc::reader::FileReader;
use arrow_ipc::writer::FileWriter;
use bytes::Bytes;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use std::io::Cursor;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DecodeOptions {
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

fn map_data_error(error: data_arrow::Error) -> Error {
    match error {
        data_arrow::Error::UnsupportedType => Error::UnsupportedType,
        _ => Error::InvalidBatch,
    }
}
fn validate_encode(values: &[BatchSnapshot]) -> Result<Vec<RecordBatch>, Error> {
    if values.is_empty() {
        return Err(Error::EmptyInput);
    }
    let batches = values
        .iter()
        .map(|value| {
            if value.fields.is_empty() {
                return Err(Error::InvalidBatch);
            }
            data_arrow::validate_snapshot(value).map_err(map_data_error)
        })
        .collect::<Result<Vec<_>, _>>()?;
    let schema = batches[0].schema();
    if batches.iter().skip(1).any(|batch| batch.schema() != schema) {
        return Err(Error::SchemaMismatch);
    }
    Ok(batches)
}
fn validate_decode(input: &[u8], options: DecodeOptions) -> Result<(), Error> {
    if options.batch_rows == 0 {
        return Err(Error::InvalidOptions);
    }
    if input.is_empty() {
        return Err(Error::EmptyInput);
    }
    Ok(())
}
fn collect_decoded(
    batches: impl Iterator<Item = Result<RecordBatch, arrow_schema::ArrowError>>,
) -> Result<Vec<BatchSnapshot>, Error> {
    let mut output = Vec::new();
    for batch in batches {
        let batch = batch.map_err(|_| Error::InvalidData)?;
        output.push(
            data_arrow::snapshot_from_batch_schema(&batch).map_err(|e| match e {
                data_arrow::Error::UnsupportedType => Error::UnsupportedType,
                _ => Error::InvalidData,
            })?,
        );
    }
    if output.is_empty() {
        return Err(Error::InvalidData);
    }
    Ok(output)
}
pub fn ipc_file_encode(values: Vec<BatchSnapshot>) -> Result<Vec<u8>, Error> {
    let batches = validate_encode(&values)?;
    let sink = Vec::new();
    let mut writer = FileWriter::try_new(sink, batches[0].schema().as_ref())
        .map_err(|_| Error::EncodeFailure)?;
    for batch in &batches {
        writer.write(batch).map_err(|_| Error::EncodeFailure)?;
    }
    writer
        .into_inner()
        .map(|w| w)
        .map_err(|_| Error::EncodeFailure)
}
pub fn ipc_file_decode(
    input: Vec<u8>,
    options: DecodeOptions,
) -> Result<Vec<BatchSnapshot>, Error> {
    validate_decode(&input, options)?;
    let reader = FileReader::try_new(Cursor::new(input), None).map_err(|_| Error::InvalidData)?;
    collect_decoded(reader)
}
pub fn parquet_encode(values: Vec<BatchSnapshot>) -> Result<Vec<u8>, Error> {
    let batches = validate_encode(&values)?;
    let sink = Vec::new();
    let properties = WriterProperties::builder()
        .set_compression(Compression::UNCOMPRESSED)
        .build();
    let mut writer = ArrowWriter::try_new(sink, batches[0].schema(), Some(properties))
        .map_err(|_| Error::EncodeFailure)?;
    for batch in &batches {
        writer.write(batch).map_err(|_| Error::EncodeFailure)?;
    }
    writer
        .into_inner()
        .map(|w| w)
        .map_err(|_| Error::EncodeFailure)
}
pub fn parquet_decode(input: Vec<u8>, options: DecodeOptions) -> Result<Vec<BatchSnapshot>, Error> {
    validate_decode(&input, options)?;
    let reader = ParquetRecordBatchReaderBuilder::try_new(Bytes::from(input))
        .map_err(|_| Error::InvalidData)?
        .with_batch_size(options.batch_rows as usize)
        .build()
        .map_err(|_| Error::InvalidData)?;
    collect_decoded(reader)
}

#[cfg(test)]
mod memory_tests {
    use super::*;
    use crate::data_arrow::{Column, DataType, Field};
    fn batch(rows: u32) -> BatchSnapshot {
        BatchSnapshot {
            rows,
            fields: vec![Field {
                name: "value".into(),
                data_type: DataType::Utf8,
                nullable: false,
            }],
            columns: vec![Column::Utf8(
                (0..rows)
                    .map(|n| Some(format!("{n:08}-{}", "中abcdef".repeat(10))))
                    .collect(),
            )],
        }
    }
    #[test]
    fn ipc_large_bytes_rows_and_many_batches_without_capacity_options() {
        let values = vec![batch(10000); 3];
        let bytes = ipc_file_encode(values.clone()).unwrap();
        assert!(bytes.len() > 2 * 1024 * 1024);
        assert_eq!(
            ipc_file_decode(bytes, DecodeOptions { batch_rows: 1000 }).unwrap(),
            values
        );
    }
    #[test]
    fn parquet_round_trip_and_schema_validation_remain() {
        let value = batch(30000);
        let bytes = parquet_encode(vec![value.clone()]).unwrap();
        let decoded = parquet_decode(bytes, DecodeOptions { batch_rows: 30000 }).unwrap();
        assert_eq!(decoded, vec![value]);
        assert_eq!(ipc_file_encode(vec![]), Err(Error::EmptyInput));
        assert_eq!(
            parquet_decode(vec![0], DecodeOptions { batch_rows: 0 }),
            Err(Error::InvalidOptions)
        );
    }
}
