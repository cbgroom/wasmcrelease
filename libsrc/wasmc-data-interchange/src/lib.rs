wit_bindgen::generate!({
    path: "wit",
    world: "data-interchange",
    generate_all,
});

use crate::exports::wasmc::data_interchange::adapter::{
    DecodeOptions, EncodeOptions, Guest, InterchangeError,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot, Column, DataType as WitDataType, Field as WitField,
};
use arrow_array::builder::{BinaryBuilder, StringBuilder};
use arrow_array::{
    Array, ArrayRef, BinaryArray, BooleanArray, Float64Array, Int64Array, RecordBatch, StringArray,
    UInt64Array,
};
use arrow_ipc::reader::FileReader;
use arrow_ipc::writer::FileWriter;
use arrow_schema::{DataType as ArrowDataType, Field as ArrowField, Schema};
use bytes::Bytes;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use std::collections::BTreeSet;
use std::io::{Cursor, Error, Result as IoResult, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

struct DataInterchange;

struct BoundedWriter {
    bytes: Vec<u8>,
    limit: usize,
    exceeded: Arc<AtomicBool>,
}

impl Write for BoundedWriter {
    fn write(&mut self, value: &[u8]) -> IoResult<usize> {
        let next = self
            .bytes
            .len()
            .checked_add(value.len())
            .ok_or_else(|| Error::other("output size overflow"))?;
        if next > self.limit {
            self.exceeded.store(true, Ordering::Relaxed);
            return Err(Error::other("output limit exceeded"));
        }
        self.bytes.extend_from_slice(value);
        Ok(value.len())
    }

    fn flush(&mut self) -> IoResult<()> {
        Ok(())
    }
}

fn encode_error(exceeded: &AtomicBool) -> InterchangeError {
    if exceeded.load(Ordering::Relaxed) {
        InterchangeError::OutputLimitExceeded
    } else {
        InterchangeError::EncodeFailure
    }
}

fn arrow_type(value: WitDataType) -> ArrowDataType {
    match value {
        WitDataType::Boolean => ArrowDataType::Boolean,
        WitDataType::Int64 => ArrowDataType::Int64,
        WitDataType::Uint64 => ArrowDataType::UInt64,
        WitDataType::Float64 => ArrowDataType::Float64,
        WitDataType::Utf8 => ArrowDataType::Utf8,
        WitDataType::Binary => ArrowDataType::Binary,
    }
}

fn wit_type(value: &ArrowDataType) -> Result<WitDataType, InterchangeError> {
    Ok(match value {
        ArrowDataType::Boolean => WitDataType::Boolean,
        ArrowDataType::Int64 => WitDataType::Int64,
        ArrowDataType::UInt64 => WitDataType::Uint64,
        ArrowDataType::Float64 => WitDataType::Float64,
        ArrowDataType::Utf8 => WitDataType::Utf8,
        ArrowDataType::Binary => WitDataType::Binary,
        _ => return Err(InterchangeError::UnsupportedType),
    })
}

fn column_len(value: &Column) -> usize {
    match value {
        Column::BooleanColumn(values) => values.len(),
        Column::Int64Column(values) => values.len(),
        Column::Uint64Column(values) => values.len(),
        Column::Float64Column(values) => values.len(),
        Column::Utf8Column(values) => values.len(),
        Column::BinaryColumn(values) => values.len(),
    }
}

fn column_to_array(value: &Column) -> ArrayRef {
    match value {
        Column::BooleanColumn(values) => Arc::new(BooleanArray::from(values.clone())),
        Column::Int64Column(values) => Arc::new(Int64Array::from(values.clone())),
        Column::Uint64Column(values) => Arc::new(UInt64Array::from(values.clone())),
        Column::Float64Column(values) => Arc::new(Float64Array::from(values.clone())),
        Column::Utf8Column(values) => {
            let mut builder = StringBuilder::new();
            for value in values {
                match value {
                    Some(value) => builder.append_value(value),
                    None => builder.append_null(),
                }
            }
            Arc::new(builder.finish())
        }
        Column::BinaryColumn(values) => {
            let mut builder = BinaryBuilder::new();
            for value in values {
                match value {
                    Some(value) => builder.append_value(value),
                    None => builder.append_null(),
                }
            }
            Arc::new(builder.finish())
        }
    }
}

fn snapshot_to_batch(value: &BatchSnapshot) -> Result<RecordBatch, InterchangeError> {
    if value.fields.is_empty() || value.fields.len() != value.columns.len() {
        return Err(InterchangeError::InvalidBatch);
    }
    let mut names = BTreeSet::new();
    let mut fields = Vec::with_capacity(value.fields.len());
    let mut arrays = Vec::with_capacity(value.columns.len());
    for (field, column) in value.fields.iter().zip(&value.columns) {
        if field.name.is_empty()
            || !names.insert(field.name.clone())
            || column_len(column) != value.rows as usize
        {
            return Err(InterchangeError::InvalidBatch);
        }
        let array = column_to_array(column);
        if array.data_type() != &arrow_type(field.data_type)
            || (!field.nullable && array.null_count() != 0)
        {
            return Err(InterchangeError::InvalidBatch);
        }
        fields.push(ArrowField::new(
            field.name.clone(),
            arrow_type(field.data_type),
            field.nullable,
        ));
        arrays.push(array);
    }
    RecordBatch::try_new(Arc::new(Schema::new(fields)), arrays)
        .map_err(|_| InterchangeError::InvalidBatch)
}

fn schema_to_fields(schema: &Schema) -> Result<Vec<WitField>, InterchangeError> {
    let mut names = BTreeSet::new();
    schema
        .fields()
        .iter()
        .map(|field| {
            if field.name().is_empty() || !names.insert(field.name().clone()) {
                return Err(InterchangeError::InvalidData);
            }
            Ok(WitField {
                name: field.name().clone(),
                data_type: wit_type(field.data_type())?,
                nullable: field.is_nullable(),
            })
        })
        .collect()
}

fn batch_to_snapshot(batch: &RecordBatch) -> Result<BatchSnapshot, InterchangeError> {
    let fields = schema_to_fields(batch.schema().as_ref())?;
    let mut columns = Vec::with_capacity(fields.len());
    for (field, array) in fields.iter().zip(batch.columns()) {
        if !field.nullable && array.null_count() != 0 {
            return Err(InterchangeError::InvalidData);
        }
        let column = match field.data_type {
            WitDataType::Boolean => {
                let values = array
                    .as_any()
                    .downcast_ref::<BooleanArray>()
                    .ok_or(InterchangeError::InvalidData)?;
                Column::BooleanColumn(
                    (0..values.len())
                        .map(|i| (!values.is_null(i)).then(|| values.value(i)))
                        .collect(),
                )
            }
            WitDataType::Int64 => {
                let values = array
                    .as_any()
                    .downcast_ref::<Int64Array>()
                    .ok_or(InterchangeError::InvalidData)?;
                Column::Int64Column(
                    (0..values.len())
                        .map(|i| (!values.is_null(i)).then(|| values.value(i)))
                        .collect(),
                )
            }
            WitDataType::Uint64 => {
                let values = array
                    .as_any()
                    .downcast_ref::<UInt64Array>()
                    .ok_or(InterchangeError::InvalidData)?;
                Column::Uint64Column(
                    (0..values.len())
                        .map(|i| (!values.is_null(i)).then(|| values.value(i)))
                        .collect(),
                )
            }
            WitDataType::Float64 => {
                let values = array
                    .as_any()
                    .downcast_ref::<Float64Array>()
                    .ok_or(InterchangeError::InvalidData)?;
                Column::Float64Column(
                    (0..values.len())
                        .map(|i| (!values.is_null(i)).then(|| values.value(i)))
                        .collect(),
                )
            }
            WitDataType::Utf8 => {
                let values = array
                    .as_any()
                    .downcast_ref::<StringArray>()
                    .ok_or(InterchangeError::InvalidData)?;
                Column::Utf8Column(
                    (0..values.len())
                        .map(|i| (!values.is_null(i)).then(|| values.value(i).to_owned()))
                        .collect(),
                )
            }
            WitDataType::Binary => {
                let values = array
                    .as_any()
                    .downcast_ref::<BinaryArray>()
                    .ok_or(InterchangeError::InvalidData)?;
                Column::BinaryColumn(
                    (0..values.len())
                        .map(|i| (!values.is_null(i)).then(|| values.value(i).to_vec()))
                        .collect(),
                )
            }
        };
        columns.push(column);
    }
    Ok(BatchSnapshot {
        rows: u32::try_from(batch.num_rows()).map_err(|_| InterchangeError::Overflow)?,
        fields,
        columns,
    })
}

fn validate_encode(
    values: &[BatchSnapshot],
    options: &EncodeOptions,
) -> Result<Vec<RecordBatch>, InterchangeError> {
    if options.max_batches == 0 || options.max_rows == 0 || options.max_output_bytes == 0 {
        return Err(InterchangeError::InvalidOptions);
    }
    if values.is_empty() {
        return Err(InterchangeError::EmptyInput);
    }
    if values.len() > options.max_batches as usize {
        return Err(InterchangeError::BatchLimitExceeded);
    }
    let mut rows = 0_u32;
    let batches = values
        .iter()
        .map(|value| {
            rows = rows
                .checked_add(value.rows)
                .ok_or(InterchangeError::Overflow)?;
            if rows > options.max_rows {
                return Err(InterchangeError::RowLimitExceeded);
            }
            snapshot_to_batch(value)
        })
        .collect::<Result<Vec<_>, _>>()?;
    let schema = batches[0].schema();
    if batches.iter().skip(1).any(|batch| batch.schema() != schema) {
        return Err(InterchangeError::SchemaMismatch);
    }
    Ok(batches)
}

fn validate_decode(input: &[u8], options: &DecodeOptions) -> Result<(), InterchangeError> {
    if options.max_input_bytes == 0
        || options.max_batches == 0
        || options.max_rows == 0
        || options.batch_rows == 0
    {
        return Err(InterchangeError::InvalidOptions);
    }
    if input.is_empty() {
        return Err(InterchangeError::EmptyInput);
    }
    if input.len() > options.max_input_bytes as usize {
        return Err(InterchangeError::InputLimitExceeded);
    }
    Ok(())
}

fn collect_decoded(
    batches: impl Iterator<Item = Result<RecordBatch, arrow_schema::ArrowError>>,
    options: &DecodeOptions,
) -> Result<Vec<BatchSnapshot>, InterchangeError> {
    let mut output = Vec::new();
    let mut rows = 0_u32;
    for batch in batches {
        if output.len() >= options.max_batches as usize {
            return Err(InterchangeError::BatchLimitExceeded);
        }
        let batch = batch.map_err(|_| InterchangeError::InvalidData)?;
        rows = rows
            .checked_add(u32::try_from(batch.num_rows()).map_err(|_| InterchangeError::Overflow)?)
            .ok_or(InterchangeError::Overflow)?;
        if rows > options.max_rows {
            return Err(InterchangeError::RowLimitExceeded);
        }
        output.push(batch_to_snapshot(&batch)?);
    }
    if output.is_empty() {
        return Err(InterchangeError::InvalidData);
    }
    Ok(output)
}

impl Guest for DataInterchange {
    fn ipc_file_encode(
        values: Vec<BatchSnapshot>,
        options: EncodeOptions,
    ) -> Result<Vec<u8>, InterchangeError> {
        let batches = validate_encode(&values, &options)?;
        let exceeded = Arc::new(AtomicBool::new(false));
        let sink = BoundedWriter {
            bytes: Vec::new(),
            limit: options.max_output_bytes as usize,
            exceeded: exceeded.clone(),
        };
        let mut writer = FileWriter::try_new(sink, batches[0].schema().as_ref())
            .map_err(|_| encode_error(&exceeded))?;
        for batch in &batches {
            writer.write(batch).map_err(|_| encode_error(&exceeded))?;
        }
        writer
            .into_inner()
            .map(|writer| writer.bytes)
            .map_err(|_| encode_error(&exceeded))
    }

    fn ipc_file_decode(
        input: Vec<u8>,
        options: DecodeOptions,
    ) -> Result<Vec<BatchSnapshot>, InterchangeError> {
        validate_decode(&input, &options)?;
        let reader = FileReader::try_new(Cursor::new(input), None)
            .map_err(|_| InterchangeError::InvalidData)?;
        collect_decoded(reader, &options)
    }

    fn parquet_encode(
        values: Vec<BatchSnapshot>,
        options: EncodeOptions,
    ) -> Result<Vec<u8>, InterchangeError> {
        let batches = validate_encode(&values, &options)?;
        let exceeded = Arc::new(AtomicBool::new(false));
        let sink = BoundedWriter {
            bytes: Vec::new(),
            limit: options.max_output_bytes as usize,
            exceeded: exceeded.clone(),
        };
        let properties = WriterProperties::builder()
            .set_compression(Compression::UNCOMPRESSED)
            .build();
        let mut writer = ArrowWriter::try_new(sink, batches[0].schema(), Some(properties))
            .map_err(|_| encode_error(&exceeded))?;
        for batch in &batches {
            writer.write(batch).map_err(|_| encode_error(&exceeded))?;
        }
        writer
            .into_inner()
            .map(|writer| writer.bytes)
            .map_err(|_| encode_error(&exceeded))
    }

    fn parquet_decode(
        input: Vec<u8>,
        options: DecodeOptions,
    ) -> Result<Vec<BatchSnapshot>, InterchangeError> {
        validate_decode(&input, &options)?;
        let reader = ParquetRecordBatchReaderBuilder::try_new(Bytes::from(input))
            .map_err(|_| InterchangeError::InvalidData)?
            .with_batch_size(options.batch_rows as usize)
            .build()
            .map_err(|_| InterchangeError::InvalidData)?;
        collect_decoded(reader, &options)
    }
}

export!(DataInterchange);
