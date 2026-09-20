wit_bindgen::generate!({
    path: "wit",
    world: "csv",
    generate_all,
});

use crate::exports::wasmc::csv::parser::{CsvError, CsvOptions, Guest};
use crate::wasmc::data_core::types::{
    BatchSnapshot, Column, DataType as WitDataType, Field as WitField,
};
use arrow_array::{
    Array, BinaryArray, BooleanArray, Float64Array, Int64Array, RecordBatch, StringArray,
    UInt64Array,
};
use arrow_csv::ReaderBuilder;
use arrow_schema::{DataType as ArrowDataType, Field as ArrowField, Schema};
use std::io::Cursor;
use std::sync::Arc;

struct Csv;

fn arrow_type(value: WitDataType) -> Result<ArrowDataType, CsvError> {
    Ok(match value {
        WitDataType::Boolean => ArrowDataType::Boolean,
        WitDataType::Int64 => ArrowDataType::Int64,
        WitDataType::Uint64 => ArrowDataType::UInt64,
        WitDataType::Float64 => ArrowDataType::Float64,
        WitDataType::Utf8 => ArrowDataType::Utf8,
        WitDataType::Binary => return Err(CsvError::UnsupportedType),
    })
}

fn schema_from_fields(fields: &[WitField]) -> Result<Arc<Schema>, CsvError> {
    if fields.is_empty() {
        return Err(CsvError::InvalidOptions);
    }
    let arrow_fields = fields
        .iter()
        .map(|field| {
            if field.name.is_empty() {
                return Err(CsvError::InvalidOptions);
            }
            Ok(ArrowField::new(
                field.name.clone(),
                arrow_type(field.data_type)?,
                field.nullable,
            ))
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Arc::new(Schema::new(arrow_fields)))
}

fn batch_to_snapshot(batch: &RecordBatch, fields: &[WitField]) -> Result<BatchSnapshot, CsvError> {
    if batch.num_columns() != fields.len() {
        return Err(CsvError::InvalidData);
    }

    let mut columns = Vec::with_capacity(fields.len());
    for (field, array) in fields.iter().zip(batch.columns()) {
        let column = match field.data_type {
            WitDataType::Boolean => {
                let values = array
                    .as_any()
                    .downcast_ref::<BooleanArray>()
                    .ok_or(CsvError::InvalidData)?;
                Column::BooleanColumn(
                    (0..values.len())
                        .map(|index| {
                            if values.is_null(index) {
                                None
                            } else {
                                Some(values.value(index))
                            }
                        })
                        .collect(),
                )
            }
            WitDataType::Int64 => {
                let values = array
                    .as_any()
                    .downcast_ref::<Int64Array>()
                    .ok_or(CsvError::InvalidData)?;
                Column::Int64Column(
                    (0..values.len())
                        .map(|index| {
                            if values.is_null(index) {
                                None
                            } else {
                                Some(values.value(index))
                            }
                        })
                        .collect(),
                )
            }
            WitDataType::Uint64 => {
                let values = array
                    .as_any()
                    .downcast_ref::<UInt64Array>()
                    .ok_or(CsvError::InvalidData)?;
                Column::Uint64Column(
                    (0..values.len())
                        .map(|index| {
                            if values.is_null(index) {
                                None
                            } else {
                                Some(values.value(index))
                            }
                        })
                        .collect(),
                )
            }
            WitDataType::Float64 => {
                let values = array
                    .as_any()
                    .downcast_ref::<Float64Array>()
                    .ok_or(CsvError::InvalidData)?;
                Column::Float64Column(
                    (0..values.len())
                        .map(|index| {
                            if values.is_null(index) {
                                None
                            } else {
                                Some(values.value(index))
                            }
                        })
                        .collect(),
                )
            }
            WitDataType::Utf8 => {
                let values = array
                    .as_any()
                    .downcast_ref::<StringArray>()
                    .ok_or(CsvError::InvalidData)?;
                Column::Utf8Column(
                    (0..values.len())
                        .map(|index| {
                            if values.is_null(index) {
                                None
                            } else {
                                Some(values.value(index).to_owned())
                            }
                        })
                        .collect(),
                )
            }
            WitDataType::Binary => {
                let _ = array
                    .as_any()
                    .downcast_ref::<BinaryArray>()
                    .ok_or(CsvError::UnsupportedType)?;
                return Err(CsvError::UnsupportedType);
            }
        };
        columns.push(column);
    }

    Ok(BatchSnapshot {
        rows: u32::try_from(batch.num_rows()).map_err(|_| CsvError::InvalidData)?,
        fields: fields.to_vec(),
        columns,
    })
}

impl Guest for Csv {
    fn parse(
        input: Vec<u8>,
        fields: Vec<WitField>,
        options: CsvOptions,
    ) -> Result<Vec<BatchSnapshot>, CsvError> {
        if options.batch_rows == 0
            || options.delimiter == 0
            || matches!(options.delimiter, b'\r' | b'\n')
        {
            return Err(CsvError::InvalidOptions);
        }

        let schema = schema_from_fields(&fields)?;
        let reader = ReaderBuilder::new(schema)
            .with_header(options.has_header)
            .with_header_validation(options.validate_header)
            .with_delimiter(options.delimiter)
            .with_batch_size(options.batch_rows as usize)
            .build(Cursor::new(input))
            .map_err(|_| CsvError::InvalidData)?;

        reader
            .map(|batch| {
                let batch = batch.map_err(|_| CsvError::InvalidData)?;
                batch_to_snapshot(&batch, &fields)
            })
            .collect()
    }
}

export!(Csv);
